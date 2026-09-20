# Game Machine

A local party game pack for one screen, one keyboard, and a room full of people.
Inspired by the Jackbox Party Pack — but the part worth copying is the **shared
common screen**, not the phone controller.

There are no phones, no second devices, no controllers, and no per-player key
clusters. Every game is one of:

- **zero input** — the app is purely the host: it poses the question, runs the
  clock and keeps score while people talk and argue out loud;
- **collective input** — the room decides together and one person enters the
  single group answer;
- **turn-based input** — the keyboard passes to one player at a time.

Nothing is hidden between players, either. There is no pass-the-keyboard
hot-seat and no masked typing: people type in full view of the room. Where a
game genuinely needs a secret, it belongs either to the *app* (Histórias Malucas
knows a story nobody has read yet) or it is *inverted* so the room sees it and
one player turns their back (Palavra Proibida).

## Running it

```bash
npm install
npm run dev          # opens http://localhost:5173
```

For a game night, press **Shift+F** for fullscreen and put it on the TV.

```bash
npm run build && npm run preview   # static, fully offline build
npm run validate                   # check config.yaml and every content pack
npm test                           # engine tests
```

## The eight games

| Game | | How it plays |
|---|---|---|
| **Quiz Relâmpago** | Quiz Blitz | Multiple choice on your turn, speed bonus, and the next player can steal what you miss. |
| **Ordem Certa** | Line 'Em Up | The room argues four to six things into the right order; every correct slot scores. |
| **Verdade ou Lorota** | Fact or Fake | Three statements, one invented. You decide alone — while everyone else tries to talk you into the wrong one. |
| **Quem Diria** | Who Would | You predict who the room will pick; the room votes with a show of hands. |
| **Palavra Proibida** | Taboo Rush | Inverted Taboo: the word is on screen for everyone, one player turns their back, the room describes it. |
| **Tribunal** | Kangaroo Court | Two players get opposite sides of an absurd motion and a ticking clock. The app throws curveballs. The room delivers the verdict. |
| **Histórias Malucas** | Mad Tales | The app asks for stray words without showing the story, then reads the damage out loud. |
| **Legendas** | Caption This | Everyone captions the same absurd setup, then the room votes. |

## Tuning it

Everything lives in **`data/`**, which is served as-is — edit, reload, done. No
rebuild, no code.

- **`data/config.yaml`** — language, players, teams, audio, content filters,
  repeat policy, and a block per game where every number in its rules is a key:
  round counts, timers, point values, speed bonuses, steal rules, skip
  allowances, curveball frequency.
- **`data/content/`** — every question, card, motion and story, as YAML. See
  [`data/content/README.md`](data/content/README.md) for the authoring guide.

A bad value in `config.yaml` produces a readable full-screen error naming the
key, what it received and what was allowed — not a blank page.

## Languages

Full English and Brazilian Portuguese, switchable from the menu or by setting
`language:` in `config.yaml`. Two kinds of content pack sit behind that:

- **bilingual core packs**, where both languages carry the same items (the
  validator enforces the parity), and
- **language-native packs** — Brazilian culture in pt-BR, English-language pop
  culture in en — which load only for their own language, because culturally
  specific trivia rarely survives translation.

## Difficulty

Every content item carries a difficulty from 1 to 5, and **Dificuldade / Difficulty**
in the menu cycles the slice in play:

| Preset | Tiers |
|---|---|
| Everything | 1-5 |
| Easy | 1-2 |
| Medium | 2-3 |
| Hard | 3-4 |
| Expert | 4-5 |

The hard tiers are school-curriculum and early-university material — physics, chemistry,
biology, maths, history, geography, literature and astronomy — not pop culture.

Two things make difficulty more than a filter:

- **`content.curve: ramp`** (the default) opens a game on the easiest allowed tier and
  climbs to the hardest, so a round of Quiz Relâmpago warms up and then bites. Set it to
  `flat` to draw anywhere in range.
- **`difficulty_bonus`** pays more for harder items: at the default `0.25`, a level-5
  question is worth double a level-1. A hard bank rewards you rather than punishing you.

Difficulty is skipped for the four social games (Quem Diria, Tribunal, Histórias Malucas,
Legendas) — there is no hard version of "who would lose their phone" — so choosing Expert
narrows the knowledge games without emptying half the pack.

## Keeping it fresh

The content banks are large and tagged, and the picker remembers what the room
has already seen (in `localStorage`, per game and language), so questions do not
come back until a bank is exhausted. *Zerar histórico de conteúdo* in the menu
clears that memory. `content.repeat` in `config.yaml` switches the policy between
`avoid-until-exhausted`, `never-repeat` and `random`.

## Adding a game

1. `src/games/<id>/schema.ts` — a zod schema for its content items and one for
   its `config.yaml` block. Kept separate from the component so the validate CLI
   can import it without React.
2. `src/games/<id>/index.tsx` — the component, wrapped in `defineGame`.
3. Register it in `src/games/registry.ts` and `src/games/schemas.ts`.
4. Add its content packs and list them in `data/content/manifest.yaml`.
5. Add its strings under `games.<id>` in `src/i18n/en.yaml` and `pt-BR.yaml`.

The host owns players, scoring, content and navigation; a game module owns only
its own round loop.

## Controls

The same in every game, so anyone can pick up the keyboard:

`Space` continue · `1`–`6` choose · `←` `→` adjust · `Enter` confirm ·
`Backspace` skip · `Esc` menu · `Shift+F` fullscreen
