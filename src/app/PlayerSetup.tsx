import { useState } from 'react'
import { PLAYER_PALETTE, type Player } from '../engine/players'
import { useI18n } from '../i18n'
import { Screen, KeyHints } from '../ui/components'

/**
 * Players normally come from data/config.yaml, but a guest turning up mid-night
 * should not require a file edit -- so the roster is editable here too.
 */
export function PlayerSetup({
  players,
  onChange,
  onDone,
}: {
  players: Player[]
  onChange: (players: Player[]) => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')

  const addPlayer = () => {
    const name = draft.trim()
    if (!name) return
    const index = players.length
    onChange([
      ...players,
      {
        id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'player'}-${index}-${Date.now()}`,
        name,
        color: PLAYER_PALETTE[index % PLAYER_PALETTE.length],
      },
    ])
    setDraft('')
  }

  const rename = (id: string, name: string) =>
    onChange(players.map((p) => (p.id === id ? { ...p, name } : p)))

  const remove = (id: string) => onChange(players.filter((p) => p.id !== id))

  return (
    <Screen bottom={<KeyHints hints={[t('keys.pause')]} />}>
      <h1 className="title">{t('setup.title')}</h1>

      <div className="stack" style={{ width: 'min(620px, 92vw)' }}>
        {players.map((player) => (
          <div className="row" key={player.id}>
            <span className="badge__dot" style={{ color: player.color, fontSize: '1.6em' }} />
            <input
              className="input grow"
              value={player.name}
              maxLength={24}
              onChange={(event) => rename(player.id, event.target.value)}
            />
            <button type="button" className="btn btn--ghost" onClick={() => remove(player.id)}>
              {t('setup.remove')}
            </button>
          </div>
        ))}

        <div className="row">
          <input
            className="input grow"
            placeholder={t('setup.namePlaceholder')}
            value={draft}
            maxLength={24}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addPlayer()
              }
            }}
          />
          <button type="button" className="btn" onClick={addPlayer}>
            {t('setup.addPlayer')}
          </button>
        </div>

        <p className="faint" style={{ fontSize: '0.85em' }}>{t('setup.hint')}</p>

        <button
          type="button"
          className="btn btn--primary"
          disabled={players.length === 0}
          onClick={onDone}
        >
          {t('setup.start')}
        </button>
      </div>
    </Screen>
  )
}
