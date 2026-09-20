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

**The config file is [`data/config.yaml`](data/config.yaml).** Edit it, reload the
page, done — no rebuild, no code. The main menu shows that path too, so nobody has
to go looking.

Rounds and difficulty can also be changed without touching the file, from the game
picker:

```
↑ ↓   move between games
← →   difficulty of the highlighted game
− +   rounds of the highlighted game
```

Those override the file for the session; the file supplies the defaults.

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

Difficulty is set **per game**, in the game picker: `↑` `↓` moves between games,
`←` `→` changes the difficulty of the highlighted one. Quiz Relâmpago can sit on
Expert while Verdade ou Lorota stays on Easy.

| Preset | Tiers | Should be answerable by |
|---|---|---|
| Everything | 1-5 | |
| Easy | 1-2 | anyone in the room |
| Medium | 2-3 | most adults, after a moment |
| Hard | 3-4 | someone who paid attention at school |
| Expert | 4-5 | someone who studied the subject |

The Expert tier is university-level: Cp/Cv for a monatomic ideal gas, the
hybridisation of carbon in carbonate, how many groups of order 4 exist up to
isomorphism, which treaty ended the Thirty Years' War. Distractors are all
plausible, so half-knowing the field does not get you there.

### The questions get harder as a game goes on

With `content.curve: ramp` (the default), a game opens on the easiest tier you
allow and climbs to the hardest, spread across however many rounds you chose. The
five pips beside the round counter show the current question's tier, so the climb
is visible rather than theoretical:

```
Rodada 1 de 3   ●○○○○   O acarajé é um prato típico de qual estado?
Rodada 2 de 3   ●●●○○   Qual é o país mais populoso da África?
Rodada 3 de 3   ●●●●●   O teorema da incompletude de Gödel afirma que...
```

Set `curve: flat` to draw anywhere in range instead.

Two further knobs, in `config.yaml`:

- **`games.<id>.rounds`** sets each game's default round count (the picker's − +
  overrides it for the session, from 1 to 20).
- **`difficulty_bonus`** pays more for harder items: at the default `0.25` a
  level-5 question is worth double a level-1, so a hard bank rewards you.

Each game may also pin its own default with `games.<id>.difficulty: [4, 5]`.

Difficulty is skipped entirely for the four social games (Quem Diria, Tribunal,
Histórias Malucas, Legendas) — there is no hard version of "who would lose their
phone" — so putting the knowledge games on Expert never empties the pack.

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
