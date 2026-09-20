# Writing content

Everything the games say lives in this folder as YAML. Nothing here is compiled:
edit a file, reload the page, and the change is live. Run `npm run validate`
afterwards to check it.

## How a pack gets loaded

1. Write a `.yaml` file under the folder for its game.
2. Add one line to `manifest.yaml`.
3. Reload. That's it.

```yaml
# manifest.yaml
packs:
  - { id: quiz-filmes, game: quiz, lang: pt-BR, file: quiz/filmes.pt-BR.yaml, title: "Cinema", auto: true }
```

`auto: true` means the pack loads whenever `config.yaml` has `content.packs: [auto]`
(the default). Set it to `false` to keep a pack on the shelf until it is named
explicitly in `config.yaml`.

## Pack file shape

```yaml
id: quiz-filmes        # shared by the pt-BR and en versions of the SAME pack
game: quiz             # must match the manifest entry
lang: pt-BR            # pt-BR | en
title: Cinema
version: 1
items:
  - id: f001
    ...
```

## Fields every item has

| Field | Default | What it does |
|---|---|---|
| `id` | required | Unique inside the pack. Also how the anti-repeat memory tracks it, so never reuse an id for different content. |
| `category` | `geral` | Free label, handy for your own organisation. |
| `difficulty` | `3` | 1–5, and it matters: see the scale below. |
| `audience` | `family` | `family`, `teen` or `adult`. Filtered by `content.filters.audience`, which ships excluding `adult`. |
| `tags` | `[]` | Free tags. `content.filters.exclude_tags` drops anything carrying one; `include_tags`, if set, keeps *only* items carrying one. |

## Pitching difficulty

The menu cycles presets over this scale, and `content.curve: ramp` walks a game from the
bottom of the allowed range to the top, so be honest with the number:

| | Should be answerable by |
|---|---|
| **1** | anyone in the room, instantly |
| **2** | general knowledge, no thought needed |
| **3** | most adults, after a moment |
| **4** | someone who paid attention at school |
| **5** | someone who studied the subject |

`difficulty_bonus` in `config.yaml` pays more for harder items, so inflating a 2 to a 5
does not just misjudge the room — it hands out points the question did not earn.

Difficulty is ignored entirely for `quemdiria`, `tribunal`, `historias` and `legendas`
(listed in `src/games/schemas.ts` as `DIFFICULTY_FREE_GAMES`). Set it to anything there;
nothing reads it.

## Bilingual packs vs language-native packs

Two different things, both useful:

- **Bilingual core.** Two files, one per language, sharing the same `id:` in the
  file header *and* the same item ids. `npm run validate` checks that neither
  side is missing an item. Use this for content that survives translation.
- **Language-native.** A pack that exists in one language only, like
  `quiz/brasil.pt-BR.yaml` or `quiz/anglo.en.yaml`. It simply never appears in
  the other language. Use this for culture-specific material, which usually dies
  in translation — that is the whole reason the option exists.

## Per-game item shapes

### `quiz` — Quiz Relâmpago
```yaml
- id: q001
  question: "Qual é a capital do Japão?"
  options: ["Quioto", "Osaka", "Tóquio", "Nagoia"]
  answer: 2            # zero-based index into options
  note: "Opcional. Aparece na tela de resposta."
```

### `ordem` — Ordem Certa
```yaml
- id: or001
  prompt: "Do menor ao maior"
  entries:             # WRITE THEM IN THE CORRECT ORDER; the game shuffles
    - { label: "Portugal", detail: "92 mil km²" }
    - { label: "Japão",    detail: "378 mil km²" }
    - { label: "Brasil",   detail: "8,5 mi km²" }
```
3 to 6 entries. `detail` is optional and is revealed during scoring.

### `lorota` — Verdade ou Lorota
```yaml
- id: lo001
  topic: "Polvos"
  lie:
    text: "Têm ossos flexíveis dentro do manto"
    note: "Polvos não têm osso nenhum."
  truths:              # list MORE than a round needs: the game samples them,
    - { text: "Têm três corações" }        # so the same item replays differently
    - { text: "O sangue deles é azul" }
    - { text: "Mudam de cor e textura" }
```

### `quemdiria` — Quem Diria
```yaml
- id: qd001
  prompt: "Quem é mais provável de perder o celular numa festa?"
```

### `proibida` — Palavra Proibida
```yaml
- id: pr001
  word: "Praia"
  forbidden: ["mar", "areia", "sol", "verão"]   # 1 to 6 words
```
Remember the inversion: the card is shown to the whole room and the *guesser*
turns their back. Forbidden words are the ones the describers may not say.

### `tribunal` — Tribunal
One pack holds both kinds, separated by `kind`:
```yaml
- id: tb001
  kind: motion
  text: "Pizza de abacaxi deveria ser crime federal"
- id: cb001
  kind: curveball
  text: "Agora você precisa citar sua avó"
```
Curveballs are thrown mid-argument at the rate set by
`games.tribunal.curveballs.chance`.

### `historias` — Histórias Malucas
```yaml
- id: hi001
  title: "A entrevista de emprego"
  template: "Vi que você trabalhou como {1} por {2} anos."
  slots:
    - { prompt: "Uma profissão" }
    - { prompt: "Um número" }
```
`{1}`, `{2}`… are 1-based and must match `slots` position for position — the
validator rejects a template with a missing placeholder. Players never see the
template, only the slot prompts, so keep the prompts generic ("um verbo no
passado") and let the template do the comedy.

### `legendas` — Legendas
```yaml
- id: le001
  prompt: "O que o cachorro está pensando quando você sai de casa"
```

## Checking your work

```bash
npm run validate
```

It reports malformed items, duplicate ids, packs listed in the manifest but
missing on disk, gaps between the two halves of a bilingual pack, and how many
items each game actually has to play with after `config.yaml`'s filters are
applied. A game with zero playable items is reported as an error, because it
would show up empty in the menu.
