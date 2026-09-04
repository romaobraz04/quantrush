# QuantRush

QuantRush is a fast, game-like mental arithmetic trainer with focused practice and an 80 in 8 Hardcore Mode.

Live beta: https://romaobraz04.github.io/quantrush/

## Run locally

Serve this folder with any static web server, then open `index.html`. Opening the file directly is not recommended because account features import the Supabase client from a CDN.

## Hosting

The app is published from the repository root with GitHub Pages. It contains no private server credentials. The Supabase key in the browser code is a public publishable key; database access is enforced by Row Level Security.

## Hardcore and readiness

The current question mix is `structured-v5`. It combines signed integers, exact division, decomposition-based multiplication, decimal scaling, fractions, mixed notation, and missing-operand identities. It is a training blueprint, not a claim to reproduce a private assessment. Both answer formats use the same generator.

Finished simulations store all 80 questions in the existing session `config` JSON field. History includes date/time, answer format, net score, and question review. Earlier runs retain their original records; unreached questions cannot be recovered from versions that never saved them. Quit and Restart discard unfinished runs.

The lobby's Allow skipping toggle is off by default. When enabled, Skip, the choice-mode S key, and blank Enter in typed mode advance for zero points. The setting is locked during the run and saved with its configuration. Restart and Try again preserve that run's setting; a fresh page load defaults to off.

Readiness is a heuristic, not a pass probability. Baseline eligibility is unchanged. Confidence grows gradually with difficulty-weighted evidence, with diminishing credit for repeated identical questions. Recent simulation net scores contribute 35% of the index once simulations exist; earlier, easier mixes receive lower confidence weight. Original stored scores and answers are retained; history displays net scores from correct and wrong answers.

## Verification

Run `node --test tests/training.test.mjs` for generator, scoring, history, index and account-isolation checks. `tests/browser.cjs` uses Playwright with Microsoft Edge against a static server on port 4173. Set `QUANTRUSH_URL` or `BROWSER_CHANNEL` to override. Its browser and storage are isolated and its account client is mocked; it never creates real user sessions. Screenshots go to ignored `dist/checks/`.
