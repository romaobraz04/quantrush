# QuantRush

QuantRush is a fast, game-like mental arithmetic trainer with focused practice and an 80 in 8 Hardcore Mode.

Cloudflare address: https://quantrush.pages.dev/

Legacy site (kept for progress transfers): https://romaobraz04.github.io/quantrush/

Public promotion is on hold. See [BETA-RELEASE.md](BETA-RELEASE.md) for verified checks and remaining provider setup.

## Run locally

Use Node 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium webkit
pnpm check
pnpm dev
```

Open http://localhost:3000/. If that port is occupied, use `pnpm dev --port 3001`.
The server uses the application-only build in `dist/site`, including its security policy. Opening `index.html` directly is not recommended for accounts.

## Hosting

The build copies only application assets into `dist/site`; never publish the source repository root, `sources`, test output, backups, or credentials. GitHub Pages uses GitHub Actions. After tests pass, the workflow deploys the verified artifact to the legacy site and commits the same assets to the generated `cloudflare-pages` branch. Cloudflare's Git integration deploys only that branch, with previews disabled. No separate Cloudflare API token is needed. Set `LEGACY_DEPLOY_ENABLED=false` only when the migration is complete and the old site can stop receiving updates.

`site-config.mjs` contains only public addresses, the public Turnstile site key, and recorded release checks. The Supabase browser key is publishable; Row Level Security enforces access. SMTP credentials and the Turnstile secret belong only in Supabase.

`pnpm release:check` is the public-promotion gate. It intentionally fails while public email delivery, hosting, production Turnstile, real account checks, or physical-device checks remain unverified. Test deployments require the automated suite but can precede promotion, so real-device and account checks can happen on the deployed address. A passing automated suite does not mark those checks complete.

## Accounts and backups

Account includes password recovery, confirmation resend, retry/loading states, and device-local sign-out. New and reset passwords need eight characters; existing shorter passwords still reach the sign-in service. The recovery screen verifies the signed-in identity before changing a password. Expired callback messages do not reflect arbitrary URL content.

Progress backup exports the history currently available in this browser. Signed-in players should sync first to include all their cloud sessions; they can also recover history on another origin by signing in again. Exported guest backups can be imported at the new address without changing the original browser's data. Import validates the version, dates, question/attempt shape and size, strips unknown fields, and merges by session ID without replacing existing sessions. Account backups can only be imported while signed in to that same account. Limits are 20 MB and 5,000 sessions; failed imports leave existing history intact. Keep backup files private.

## Feedback and analytics

The Google Form belongs to your Google owner account. Home, Account and completed-session screens link to it; timed play does not. The Admin area links to all responses, summary charts, individual responses and the linked private spreadsheet. Hiding the admin links is not the privacy boundary: Google access permissions protect the responses themselves.

- [Send feedback](https://docs.google.com/forms/d/e/1FAIpQLSefoHo00WgEJzz_vnK2DuCl29FL5e6RBKxcN_TCwypMC7twOQ/viewform)
- [Owner responses and charts](https://docs.google.com/forms/d/1smNv8CzJ7hF2yAVvj2Cqk-YNYGqUGi4trJJtB9SFmRE/edit#responses)
- [Owner response spreadsheet](https://docs.google.com/spreadsheets/d/16QrN794-54ODKzV2Eh8LSTw0ad3hVK5AS5NFe5zZ0hE/edit)

The form requires category and message. Device/browser, run date/time/time zone, and reply email are optional. Email collection, file uploads, sign-in requirements and public response summaries are off. There is one explicitly labeled release-test response; exclude it when reviewing player feedback. Access/deletion requests require verification of account ownership before any action. The in-app Privacy view describes progress, providers and this request channel.

## Hardcore and readiness

The current question mix is `structured-v5`. It combines signed integers, exact division, decomposition-based multiplication, decimal scaling, fractions, mixed notation, and missing-operand identities. It is a training blueprint, not a claim to reproduce a private assessment. Both answer formats use the same generator.

Finished simulations store all 80 questions in the existing session `config` JSON field. History includes date/time, answer format, skipping, question version, net score, and question review. Best/recent comparisons are grouped by matching format, skipping and question version. Missing legacy settings are explicitly unknown. Earlier runs retain their original records; unreached questions cannot be recovered from versions that never saved them. Quit and Restart discard unfinished runs.

The lobby's Allow skipping toggle is off by default. When enabled, Skip, the choice-mode S key, and blank Enter in typed mode advance for zero points. The setting is locked during the run and saved with its configuration. Restart and Try again preserve that run's setting; a fresh page load defaults to off.

Readiness is a heuristic, not a pass probability. Baseline eligibility is unchanged. Confidence grows gradually with difficulty-weighted evidence, with diminishing credit for repeated identical questions. Recent simulation net scores contribute 35% of the index once simulations exist; earlier, easier mixes receive lower confidence weight. Original stored scores and answers are retained; history displays net scores from correct and wrong answers.

## Verification

`pnpm check` runs all unit tests, builds the site, exercises full simulated runs, and tests account/backup flows in desktop Chromium, phone Chromium and tablet WebKit. Browsers and storage are isolated; Supabase is mocked. These tests never create real accounts or submit real feedback. Reports/screenshots are ignored and never deployed. `BROWSER_CHANNEL` optionally changes the standalone game test's Chromium channel.

`node scripts/verify-feedback.mjs` verifies anonymous form access and private owner URLs. Add `--submit-test` only for a deliberate manual release check; it sends one clearly labeled response, never player data. Confirm receipt in the owner's form and spreadsheet. It is not part of CI.

`pnpm calibration path/to/voluntarily-shared-backup.json` compares Hardcore results within matching settings/version groups. It does not query other players, alter readiness, or upload the supplied file. Keep the current baseline, scoring and question mix unchanged during the first measurement round; other simulators are comparison points, not an official specification.
