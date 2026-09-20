# Game Machine

A local party game pack: eight Jackbox-inspired games that run in the browser for a
group sharing **one screen**. Vite + React + TypeScript.

## Commands

```bash
npm run dev        # localhost:5173
npm run build      # tsc --noEmit && vite build
npm run validate   # schema-check data/ and report per-game content coverage
npm test           # vitest
```

## Design constraints — do not violate

These were settled explicitly with the user and every earlier alternative was rejected.

1. **One screen, one keyboard/mouse.** No phones, no second devices, no gamepads, no
   per-player key clusters. All three were proposed and rejected.
2. **Every game phase is one of three modes**: `none` (the app hosts while players talk
   out loud), `collective` (the room agrees, one person enters the single answer), or
   `turn` (the keyboard passes to one player).
3. **No secrecy between players.** No pass-the-keyboard hot-seat, no masked typing, no
   "everyone look away" cards. People type in full view of the room.

Rule 3 leaves only two legitimate ways to hide anything, and every game uses one:

- **The app holds the secret.** Histórias Malucas collects words for a story nobody has
  read. Nothing is hidden *between players*.
- **Invert who's in the dark.** Palavra Proibida shows the word to the whole room and
  has one player turn their back — the Heads Up! format. No hidden UI state.

A game that cannot be built one of those two ways does not belong in the pack.

## Layout

```
data/               # the ENTIRE user-editable surface; served as publicDir
  config.yaml       #   every number in every game's rules
  content/          #   all questions, cards, motions, stories + manifest.yaml
src/engine/         # config, content, picker, input, scoring, timer, audio, party, rng
src/games/          # types.ts, registry.ts, schemas.ts, <id>/{schema.ts,index.tsx}
src/ui/             # components.tsx, GameFrame.tsx, TextEntry.tsx, styles.css
src/app/            # App.tsx (routing + boot), ErrorOverlay, PlayerSetup, useMenuNav
src/i18n/           # en.yaml, pt-BR.yaml, index.ts  (loaded via ?raw + js-yaml)
tools/validate.ts   # the validate CLI
```

## Conventions

- **`data/` is never compiled.** `vite.config.ts` sets `publicDir: 'data'`, so editing
  a file there changes the game on reload — no rebuild. Keep it that way: anything a
  non-developer should be able to tune belongs in `config.yaml`, not in code.
- **Game schemas live in `<id>/schema.ts`, apart from the component.** `tools/validate.ts`
  imports them in plain Node; pulling in `index.tsx` would drag in React and the
  Vite-only `?raw` i18n import and break the CLI.
- **The host owns players, scoring, content and navigation.** A game module owns only its
  own round loop, and receives everything through `GameContext` (see `src/games/types.ts`).
- **Config and content are both validated with zod**, and errors are rendered for a human
  who may not be a developer — naming the key, what arrived, and what was allowed.
- Host banter lives in `src/i18n` as lists and is drawn with `tRandom`; **memoise it per
  round**, or it rerolls on every render and the host appears to change its mind.

## Adding a game

1. `src/games/<id>/schema.ts` — zod item schema + settings schema.
2. `src/games/<id>/index.tsx` — component wrapped in `defineGame`.
3. Register in `src/games/registry.ts` **and** `src/games/schemas.ts`.
4. Content packs under `data/content/<id>/`, listed in `data/content/manifest.yaml`.
5. Strings under `games.<id>` in **both** `src/i18n/en.yaml` and `pt-BR.yaml`.

`npm run validate` warns about a `games.<id>` config block with no registered game, which
is a useful check that you did step 3.

## Content

Bilingual core packs share item ids across the two language files and the validator
enforces parity. Language-native packs (`brasil.pt-BR`, `anglo.en`) load only for their
own language, because culture-specific trivia does not survive translation. Authoring
guide: `data/content/README.md`.

## Gotchas already paid for

- **Don't map letter keys to option selection.** `A`–`F` once did, and collided with the
  typing games. Only the number keys are bound, and only they are advertised in the UI.
- **Only `pause` may pass through while a text field has focus.** Fullscreen is Shift+F,
  which is exactly what the keyboard sends for a capital **F** — allowing it swallowed the
  F in "Fecha", "Festa", "Friday". There is a regression test in `src/engine/input.test.ts`.
- **zod v4: use `.prefault({})`, not `.default({})`** on nested config objects. `.default`
  wants the full output type; `prefault` applies before parsing so inner defaults fill in,
  which is what gives config.yaml its deep-merge-over-defaults behaviour.
- **js-yaml v5 throws on an empty document** instead of returning undefined. `parseConfig`
  short-circuits blank/comment-only files so a cleared config yields defaults, not an error.
- **Reset a text field by remounting it with a `key`, not from an effect**, and focus it in
  `useLayoutEffect`. See `src/ui/TextEntry.tsx`.
- **Never insert into the i18n YAML by matching a bare key name.** `  wrong:` exists under
  both `common:` and `host:`; a naive replace put the host banter inside `common:` and the
  UI rendered the literal string `host.correctHard`. Anchor to the section first.
  `src/i18n/i18n.test.ts` asserts placement and cross-language key parity.
- **motion writes `transform` inline, which beats any CSS `transform`.** Hover and active
  movement on `.option` and `.menu__item` therefore live in `whileHover`/`animate`, not in
  the stylesheet. Colour, shadow and border stay in CSS.
- **Difficulty is per game and applied when a game's picker is built**, not at load time
  and not globally. `passesFilters` deliberately ignores difficulty; `itemsAtDifficulty`
  does the slicing. Games in `DIFFICULTY_FREE_GAMES` ignore it entirely.
- **`↑`/`↓` navigate a list, `←`/`→` adjust the highlighted row.** They used to be the
  same `adjust` action; splitting them is what let the game picker carry a per-row
  difficulty control. `useMenuNav` takes an `onAdjust` for that.
- **Be honest about difficulty tiers.** The first "hard" pack was school-level recall
  ("largest prime under 100") tagged 4-5, which made Expert meaningless. Tier 5 must
  require having studied the subject; see the scale in `data/content/README.md`.
  `npm run validate` prints per-preset coverage and fails a game with an empty tier.

## Verifying a change

Play it — `npm run dev` — in **both** languages. The acceptance test for configurability is
editing only `data/config.yaml` (rounds, timers, `mode: teams`, a disabled game, a tag
filter), reloading, and confirming the behaviour changed with no code edit.
