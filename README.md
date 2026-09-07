# Iron Log

An offline-first gym tracker. Log sets, track body weight, and get calorie and
macro targets that adapt to your own logged data rather than sticking to a fixed
formula.

It is a static progressive web app: no build step, no runtime dependencies, no
server. It runs from GitHub Pages and works offline once loaded.

## Features

- **Workout logging** — exercise, weight, reps and set count, with autocomplete
  from exercises you have already used.
- **History** — every set grouped by day.
- **Progress** — estimated one-rep max (Epley) over time, per exercise.
- **Nutrition** — barcode scanning and name search against
  [Open Food Facts](https://world.openfoodfacts.org/), with macros per entry.
- **Adaptive targets** — body weight is smoothed into a trend, then expenditure
  is back-calculated from logged intake versus that trend. Until roughly ten
  overlapping days of weight and food data exist, a Mifflin-St Jeor estimate is
  used instead.

## Running it

The app uses ES modules, so it must be served over HTTP. Opening `index.html`
directly from the filesystem will not work — browsers block module loading over
`file://`.

```sh
# any static server will do
npx --yes serve .
# or
python3 -m http.server 8000
```

Then open the address it prints.

Deployment is GitHub Pages pointed at the default branch; there is nothing to
build.

## Project layout

```
index.html            Markup only — no inline styles, scripts or handlers
css/app.css           All styling, driven by custom properties
service-worker.js     Offline caching
manifest.json         PWA metadata
js/
  main.js             Entry point: event wiring and first render
  config.js           Constants, storage keys, endpoints, tunables
  utils.js            Pure helpers (dates, ids, 1RM)
  storage.js          Defensive localStorage wrapper
  state.js            Application data and the only place it is mutated
  dom.js              Node-building helpers used instead of innerHTML
  ui.js               Toasts and accessible dialog handling
  charts.js           Shared sparkline renderer
  coaching.js         Pure weight-trend and TDEE maths
  food-api.js         Open Food Facts client
  workouts.js         Log and History views
  progress.js         Progress view
  nutrition.js        Food search, scanning and today's food
  targets.js          Weight card, targets card and profile dialog
```

Data flows one way: views read through `state.js` getters, mutate through its
actions, and re-render. Nothing else touches `localStorage`.

## Conventions

- **No `innerHTML`.** Nodes are built with the helpers in `js/dom.js` and text
  is set with `textContent`, so exercise names and third-party product names
  cannot inject markup. ESLint enforces this via `no-restricted-properties`.
- **No inline event handlers or inline styles.** All behaviour is bound in
  `main.js`; all styling lives in the stylesheet. This keeps the app compatible
  with a strict Content-Security-Policy.
- **No `alert()`.** Status messages go through the live region in `js/ui.js`.
  ESLint enforces this too.
- **Pure maths stays pure.** `coaching.js` and `utils.js` take data and return
  data, with no DOM or storage access, so they can be checked in isolation.
- **JSDoc on exported functions**, describing units where they matter (kg, kcal,
  ISO date strings).

## Linting

The repository has no `package.json` on purpose: the linters are pinned in CI
and fetched on demand, so there is nothing to install and nothing to keep in
sync. Run the same checks locally with:

```sh
npx --yes eslint@9 .
npx --yes -p stylelint@16 -p stylelint-config-standard@36 stylelint "css/**/*.css"
npx --yes htmlhint@1 index.html
npx --yes prettier@3 --check .      # add --write to fix
```

All four run on every push and pull request via
`.github/workflows/lint.yml`. `.editorconfig` keeps indentation and line endings
consistent across editors.

## Accessibility

The tab bar implements the ARIA tablist pattern with roving focus and arrow-key
navigation. Dialogs set `aria-modal`, trap Tab, close on Escape, and restore
focus to whatever opened them. Charts carry text alternatives, status messages
are announced through a polite live region, and pinch-zoom is not disabled.

## Known limitations

- **Data lives only in this browser.** There is no export, sync or backup yet.
  Clearing site data loses your log. This is the most useful thing to add next.
- **Barcode scanning needs a connection.** The decoder is loaded on demand from
  a CDN, so it is unavailable offline; name search needs the network too.
- **Adaptive TDEE counts any day with food logged as a complete day.** A day
  where you logged breakfast and then forgot will drag the estimate down.
- **Maskable icons are the standard icons.** They should ideally be redrawn with
  the ~20% safe-area padding maskable icons expect, or they will be cropped on
  some Android launchers.
- **Metric only.** Weights are kilograms and heights centimetres throughout.

## Licence

MIT.
