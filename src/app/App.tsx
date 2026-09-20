import { useCallback, useEffect, useMemo, useState } from 'react'
import { configureAudio, play, unlockAudio } from '../engine/audio'
import { loadConfig, type ConfigIssue } from '../engine/config'
import type { AppConfig, Lang } from '../engine/configSchema'
import { loadContent, type ContentIndex } from '../engine/content'
import {
  DIFFICULTY_PRESETS,
  PRESET_ORDER,
  itemsAtDifficulty,
  presetFor,
  type DifficultyPreset,
} from '../engine/difficulty'
import type { BaseItem } from '../engine/contentSchema'
import { toggleFullscreen, useKeyboard } from '../engine/input'
import { buildPartyQueue, type PartyLeg } from '../engine/party'
import { browserStore, createPicker } from '../engine/picker'
import { playersFromConfig, type Player } from '../engine/players'
import { mergeBoards, ranked, type Scoreboard } from '../engine/scoring'
import { GAMES, getGame, itemSchemas } from '../games/registry'
import { DIFFICULTY_FREE_GAMES } from '../games/schemas'
import { LANGUAGE_NAMES, setLanguage, useI18n } from '../i18n'
import { KeyHints, MenuList, PlayerBadge, Scoreboard as ScoreTable, Screen, type MenuEntry } from '../ui/components'
import { ErrorOverlay } from './ErrorOverlay'
import { PlayerSetup } from './PlayerSetup'
import { useMenuNav } from './useMenuNav'

type Route =
  | { name: 'boot' }
  | { name: 'menu' }
  | { name: 'pick' }
  | { name: 'players' }
  | { name: 'playing'; gameId: string }
  | { name: 'results'; gameId: string; board: Scoreboard }
  | { name: 'party'; legs: PartyLeg[]; index: number; totals: Scoreboard; stage: 'playing' | 'break' }
  | { name: 'podium'; totals: Scoreboard }

export function App() {
  const { lang } = useI18n()
  const [route, setRoute] = useState<Route>({ name: 'boot' })
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [content, setContent] = useState<ContentIndex | null>(null)
  const [fatal, setFatal] = useState<ConfigIssue[] | null>(null)
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    void (async () => {
      const result = await loadConfig()
      if (!result.ok) return setFatal(result.issues)

      const loaded = result.config
      setLanguage(loaded.language)
      configureAudio(loaded.audio)
      document.documentElement.classList.toggle('big-text', loaded.display.big_text)
      setConfig(loaded)
      setPlayers(playersFromConfig(loaded))
      setContent(await loadContent(loaded, itemSchemas()))
      setRoute({ name: 'menu' })
    })()
  }, [])

  const switchLanguage = useCallback(() => {
    if (!config) return
    const order: Lang[] = ['pt-BR', 'en']
    const next = order[(order.indexOf(lang) + 1) % order.length] ?? 'en'
    const updated = { ...config, language: next }
    setLanguage(next)
    setConfig(updated)
    void loadContent(updated, itemSchemas()).then(setContent)
    play('move')
  }, [config, lang])

  useKeyboard(
    useCallback((action) => {
      if (action.type === 'fullscreen') void toggleFullscreen()
    }, []),
  )

  /**
   * Difficulty is chosen per game: the knowledge games can sit on Expert while
   * the social games stay untouched. Falls back to the game's own config block,
   * then to the global default.
   */
  const [chosen, setChosen] = useState<Record<string, number[]>>({})

  const difficultyFor = useCallback(
    (gameId: string): number[] => {
      const override = (config?.games[gameId] as { difficulty?: number[] } | undefined)?.difficulty
      return chosen[gameId] ?? override ?? config?.content.filters.difficulty ?? [1, 2, 3, 4, 5]
    },
    [chosen, config],
  )

  const cycleDifficulty = useCallback(
    (gameId: string, delta: number) => {
      const current = presetFor(difficultyFor(gameId)) ?? 'all'
      const at = PRESET_ORDER.indexOf(current)
      const next = PRESET_ORDER[(at + delta + PRESET_ORDER.length) % PRESET_ORDER.length] ?? 'all'
      setChosen((prev) => ({ ...prev, [gameId]: [...DIFFICULTY_PRESETS[next]] }))
      play('move')
    },
    [difficultyFor],
  )

  /** Enabled in config, has content for this language, and has enough players. */
  const playability = useMemo(() => {
    const map = new Map<
      string,
      { count: number; reason: 'ok' | 'disabled' | 'players' | 'empty'; preset: DifficultyPreset | null; usesDifficulty: boolean }
    >()
    for (const game of GAMES) {
      const usesDifficulty = !DIFFICULTY_FREE_GAMES.has(game.id)
      const count = itemsAtDifficulty(
        content?.byGame.get(game.id) ?? [],
        difficultyFor(game.id),
        usesDifficulty,
      ).length
      const enabled = (config?.games[game.id] as { enabled?: boolean } | undefined)?.enabled !== false
      const reason = !enabled ? 'disabled' : players.length < game.minPlayers ? 'players' : count === 0 ? 'empty' : 'ok'
      map.set(game.id, { count, reason, preset: presetFor(difficultyFor(game.id)), usesDifficulty })
    }
    return map
  }, [content, config, players.length, difficultyFor])

  const playableIds = useMemo(
    () => GAMES.filter((g) => playability.get(g.id)?.reason === 'ok').map((g) => g.id),
    [playability],
  )

  if (fatal) return <ErrorOverlay issues={fatal} />

  if (route.name === 'boot' || !config || !content) {
    return (
      <Screen>
        <h1 className="title">Game Machine</h1>
      </Screen>
    )
  }

  /** Instantiates a game module with its validated settings and its own picker. */
  const renderGame = (gameId: string, multiplier: number, onFinish: (earned: Scoreboard) => void) => {
    const game = getGame(gameId)
    if (!game) return <ErrorOverlay issues={[{ path: gameId, message: 'unknown game' }]} />

    const settings = game.settingsSchema.safeParse(config.games[gameId] ?? {})
    if (!settings.success) {
      return (
        <ErrorOverlay
          issues={settings.error.issues.map((issue) => ({
            path: `games.${gameId}.${issue.path.join('.')}`,
            message: issue.message,
          }))}
        />
      )
    }

    const allowed = difficultyFor(gameId)
    const picker = createPicker<BaseItem>(
      `${gameId}:${lang}`,
      itemsAtDifficulty(content.byGame.get(gameId) ?? [], allowed, !DIFFICULTY_FREE_GAMES.has(gameId)),
      { policy: config.content.repeat, store: browserStore() },
    )

    return (
      <game.Component
        config={config}
        settings={settings.data}
        players={players}
        picker={picker}
        multiplier={multiplier}
        difficulty={{ allowed, curve: config.content.curve }}
        onFinish={onFinish}
        onExit={() => setRoute({ name: 'menu' })}
      />
    )
  }

  switch (route.name) {
    case 'menu':
      return (
        <MainMenu
          config={config}
          players={players}
          partyReady={playableIds.length > 0}
          contentIssues={content.issues}
          onPick={() => setRoute({ name: 'pick' })}
          onParty={() => {
            const legs = buildPartyQueue({ config, playable: playableIds })
            if (legs.length === 0) return
            unlockAudio()
            play('fanfare')
            setRoute({ name: 'party', legs, index: 0, totals: {}, stage: 'break' })
          }}
          onPlayers={() => setRoute({ name: 'players' })}
          onLanguage={switchLanguage}
          onResetContent={() => {
            for (const game of GAMES) {
              createPicker(`${game.id}:${lang}`, [], { store: browserStore() }).reset()
            }
            play('correct')
          }}
        />
      )

    case 'pick':
      return (
        <GamePicker
          playability={playability}
          onAdjust={cycleDifficulty}
          onStart={(gameId) => {
            unlockAudio()
            play('reveal')
            setRoute({ name: 'playing', gameId })
          }}
          onBack={() => setRoute({ name: 'menu' })}
        />
      )

    case 'players':
      return <PlayerSetup players={players} onChange={setPlayers} onDone={() => setRoute({ name: 'menu' })} />

    case 'playing':
      return renderGame(route.gameId, 1, (earned) =>
        setRoute({ name: 'results', gameId: route.gameId, board: earned }),
      )

    case 'results':
      return (
        <Results
          gameId={route.gameId}
          players={players}
          board={route.board}
          onAgain={() => setRoute({ name: 'playing', gameId: route.gameId })}
          onMenu={() => setRoute({ name: 'menu' })}
        />
      )

    case 'party': {
      const leg = route.legs[route.index]
      if (!leg) return <Podium players={players} totals={route.totals} onMenu={() => setRoute({ name: 'menu' })} />

      if (route.stage === 'break') {
        return (
          <PartyBreak
            legs={route.legs}
            index={route.index}
            players={players}
            totals={route.totals}
            onStart={() => setRoute({ ...route, stage: 'playing' })}
            onQuit={() => setRoute({ name: 'menu' })}
          />
        )
      }

      return renderGame(leg.gameId, leg.multiplier, (earned) => {
        const totals = mergeBoards(route.totals, earned)
        const nextIndex = route.index + 1
        if (nextIndex >= route.legs.length) setRoute({ name: 'podium', totals })
        else setRoute({ name: 'party', legs: route.legs, index: nextIndex, totals, stage: 'break' })
      })
    }

    case 'podium':
      return <Podium players={players} totals={route.totals} onMenu={() => setRoute({ name: 'menu' })} />

    default:
      return null
  }
}

// ─── Screens ────────────────────────────────────────────────────────────────

function MainMenu({
  config,
  players,
  partyReady,
  contentIssues,
  onPick,
  onParty,
  onPlayers,
  onLanguage,
  onResetContent,
}: {
  config: AppConfig
  players: Player[]
  partyReady: boolean
  contentIssues: ConfigIssue[]
  onPick: () => void
  onParty: () => void
  onPlayers: () => void
  onLanguage: () => void
  onResetContent: () => void
}) {
  const { t, lang, tRandom } = useI18n()
  const [showIssues, setShowIssues] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const greeting = useMemo(() => tRandom('host.welcome'), [tRandom])

  const entries: MenuEntry[] = [
    { id: 'play', label: t('menu.play') },
    { id: 'party', label: t('menu.party'), meta: `${config.party_mode.games}`, disabled: !partyReady },
    { id: 'players', label: t('menu.players'), meta: `${players.length}` },
    { id: 'language', label: t('menu.language'), meta: LANGUAGE_NAMES[lang] },
    { id: 'reset', label: t('menu.resetContent') },
  ]

  const choose = (index: number) => {
    unlockAudio()
    switch (entries[index]?.id) {
      case 'play': onPick(); break
      case 'party': onParty(); break
      case 'players': onPlayers(); break
      case 'language': onLanguage(); break
      case 'reset': onResetContent(); setResetDone(true); break
      default: break
    }
  }

  const { index } = useMenuNav(entries, choose, { enabled: !showIssues })

  if (showIssues) {
    return (
      <div onClick={() => setShowIssues(false)}>
        <ErrorOverlay issues={contentIssues} variant="warning" />
      </div>
    )
  }

  return (
    <Screen bottom={<KeyHints hints={[t('keys.navigate'), t('keys.advance'), t('keys.fullscreen')]} />}>
      <div className="center">
        <h1 className="title title--huge">{t('app.title')}</h1>
        <p className="subtitle">{greeting}</p>
      </div>

      <MenuList entries={entries} activeIndex={index} onSelect={(_, i) => choose(i)} />

      {resetDone ? <p className="faint">{t('menu.resetContentDone')}</p> : null}

      {contentIssues.length > 0 ? (
        <button type="button" className="btn btn--ghost" onClick={() => setShowIssues(true)}>
          ⚠ {contentIssues.length} — {t('errors.contentTitle')}
        </button>
      ) : null}
    </Screen>
  )
}

interface Playability {
  count: number
  reason: 'ok' | 'disabled' | 'players' | 'empty'
  preset: DifficultyPreset | null
  usesDifficulty: boolean
}

function GamePicker({
  playability,
  onStart,
  onAdjust,
  onBack,
}: {
  playability: Map<string, Playability>
  onStart: (gameId: string) => void
  onAdjust: (gameId: string, delta: number) => void
  onBack: () => void
}) {
  const { t } = useI18n()

  const entries: MenuEntry[] = GAMES.map((game) => {
    const state = playability.get(game.id)

    // Difficulty sits in the meta column, so it is adjustable right where you
    // pick the game rather than hidden behind a global setting.
    const difficulty = !state?.usesDifficulty
      ? null
      : state.preset
        ? t(`difficulty.${state.preset}`)
        : t('difficulty.custom')

    const status =
      state?.reason === 'disabled' ? t('menu.disabled')
      : state?.reason === 'players' ? t('errors.needPlayers', { count: game.minPlayers })
      : state?.reason === 'empty' ? t('menu.contentEmpty')
      : t('menu.itemsAvailable', { count: state?.count ?? 0 })

    return {
      id: game.id,
      label: t(`games.${game.id}.name`),
      meta: difficulty ? `${difficulty}  ·  ${status}` : status,
      disabled: state?.reason !== 'ok',
    }
  })

  const { index } = useMenuNav(
    entries,
    (i) => {
      const entry = entries[i]
      if (entry && !entry.disabled) onStart(entry.id)
    },
    {
      onBack,
      onAdjust: (i, delta) => {
        const entry = entries[i]
        if (entry && playability.get(entry.id)?.usesDifficulty) onAdjust(entry.id, delta)
      },
    },
  )

  const highlighted = entries[index]

  return (
    <Screen bottom={<KeyHints hints={[t('keys.navigate'), t('keys.adjust'), t('keys.advance'), t('keys.pause')]} />}>
      <h1 className="title">{t('menu.play')}</h1>
      <MenuList
        entries={entries}
        activeIndex={index}
        onSelect={(id) => {
          const entry = entries.find((e) => e.id === id)
          if (entry && !entry.disabled) onStart(id)
        }}
      />
      {highlighted ? (
        <p className="subtitle center" style={{ maxWidth: '62ch' }}>{t(`games.${highlighted.id}.rules`)}</p>
      ) : null}
    </Screen>
  )
}

function Results({
  gameId,
  players,
  board,
  onAgain,
  onMenu,
}: {
  gameId: string
  players: Player[]
  board: Scoreboard
  onAgain: () => void
  onMenu: () => void
}) {
  const { t, tRandom } = useI18n()
  const line = useMemo(() => tRandom('host.gameEnd'), [tRandom])

  useKeyboard(
    useCallback(
      (action) => {
        if (action.type === 'advance') onAgain()
        if (action.type === 'pause') onMenu()
      },
      [onAgain, onMenu],
    ),
  )

  return (
    <Screen bottom={<KeyHints hints={[t('keys.advance'), t('keys.pause')]} />}>
      <div className="center">
        <div className="eyebrow">{t(`games.${gameId}.name`)}</div>
        <h1 className="title">{t('common.finalScores')}</h1>
        <p className="subtitle">{line}</p>
      </div>

      <ScoreTable players={players} board={board} />

      <div className="row row--center">
        <button type="button" className="btn btn--primary" onClick={onAgain}>{t('common.playAgain')}</button>
        <button type="button" className="btn" onClick={onMenu}>{t('common.backToMenu')}</button>
      </div>
    </Screen>
  )
}

function PartyBreak({
  legs,
  index,
  players,
  totals,
  onStart,
  onQuit,
}: {
  legs: PartyLeg[]
  index: number
  players: Player[]
  totals: Scoreboard
  onStart: () => void
  onQuit: () => void
}) {
  const { t } = useI18n()
  const leg = legs[index]

  useKeyboard(
    useCallback(
      (action) => {
        if (action.type === 'advance') onStart()
        if (action.type === 'pause') onQuit()
      },
      [onStart, onQuit],
    ),
  )

  if (!leg) return null

  return (
    <Screen bottom={<KeyHints hints={[t('keys.advance'), t('keys.pause')]} />}>
      <div className="center">
        <div className="eyebrow">
          {t('party.leg', { current: index + 1, total: legs.length })}
        </div>
        <h1 className="title">{t(`games.${leg.gameId}.name`)}</h1>
        {leg.isFinale ? (
          <p className="subtitle" style={{ color: 'var(--accent)', fontWeight: 800 }}>
            {t('party.finale', { multiplier: leg.multiplier })}
          </p>
        ) : (
          <p className="subtitle" style={{ maxWidth: '62ch' }}>{t(`games.${leg.gameId}.rules`)}</p>
        )}
      </div>

      {index > 0 ? (
        <>
          <div className="eyebrow">{t('party.standings')}</div>
          <ScoreTable players={players} board={totals} />
        </>
      ) : (
        <div className="row row--center">
          {legs.map((entry, i) => (
            <span key={`${entry.gameId}-${i}`} className="tag">
              {i + 1}. {t(`games.${entry.gameId}.name`)}
              {entry.isFinale ? ` ×${entry.multiplier}` : ''}
            </span>
          ))}
        </div>
      )}
    </Screen>
  )
}

function Podium({
  players,
  totals,
  onMenu,
}: {
  players: Player[]
  totals: Scoreboard
  onMenu: () => void
}) {
  const { t, tRandom } = useI18n()
  const line = useMemo(() => tRandom('host.gameEnd'), [tRandom])
  const standings = ranked(players, totals)
  const champions = standings.filter((entry) => entry.rank === 1)

  useKeyboard(
    useCallback(
      (action) => {
        if (action.type === 'advance' || action.type === 'pause') onMenu()
      },
      [onMenu],
    ),
  )

  return (
    <Screen bottom={<KeyHints hints={[t('keys.advance')]} />}>
      <div className="center">
        <div className="eyebrow">{t('menu.party')}</div>
        <h1 className="title title--huge">
          {champions.length > 1 ? t('common.winners') : t('common.winner')}
        </h1>
        <div className="row row--center" style={{ marginTop: 8 }}>
          {champions.map(({ player, score }) => (
            <PlayerBadge key={player.id} player={player} score={score} active />
          ))}
        </div>
        <p className="subtitle" style={{ marginTop: 12 }}>{line}</p>
      </div>

      <ScoreTable players={players} board={totals} />

      <button type="button" className="btn btn--primary" onClick={onMenu}>{t('common.backToMenu')}</button>
    </Screen>
  )
}
