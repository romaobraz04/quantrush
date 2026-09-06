# Public Beta Release Record

Status: deployed for controlled testing at https://quantrush.pages.dev/; public promotion is blocked. No paid services, subscriptions, domains or security upgrades have been purchased.

## Verified on 2026-09-04

- Existing Supabase project: `oixhuaaktwwzhcboueqj`, Free plan, preserved.
- Email confirmation remains enabled. Minimum new-password length changed to 8 and verified in the Auth dashboard. Existing sign-in passwords are not length-filtered by the app.
- The owner's existing account is email-confirmed and has the server-controlled `app_metadata.role = admin` role.
- RLS restricts writes to a player's own rows. Admin reads use `app_metadata`, not player-editable user metadata. No schema or player-session edits were required.
- Custom SMTP is off: the project still uses the default mailer. It is not suitable for public signup/recovery.
- Google Form owned by your signed-in Google account; editor access Restricted; responder access Anyone with the link. Linked spreadsheet is private to the same owner.
- Required message/category; optional device, run timestamp/time zone and reply email. No sign-in requirement, automatic email collection, file uploads or public summaries.
- A signed-out Chromium context submitted the labeled test `QuantRush release check 2026-09-04T15:11:44.720Z`. It is visible in the owner response view and category chart. Anonymous requests to the editor and response spreadsheet do not reveal responses. Retain or remove this test deliberately; exclude it from player analysis.
- Automated regression tests cover generator identities, equivalent fractions, decimal precision, missing operands, final-digit distractors, unchanged readiness, scoring, complete reviews, account isolation, backups and recovery.
- Browser scenarios cover desktop/phone Chromium and tablet WebKit. These are simulated accounts/devices, not proof of real delivery or physical Safari compatibility.

## Email and Auth Gate

Supabase's default mailer limits delivery to project-team addresses and has restrictive quotas. Public promotion must wait for a verified, zero-cost sending configuration and controlled tests outside the team. Do not turn off confirmation, add players as project members, or buy an upgrade as a workaround.

1. Select and configure a legitimate no-cost SMTP sender. Its sender/domain verification and limits must suit this app. No working public sender has been established yet.
2. Test signup/confirmation with a controlled address outside the project team, then recovery, expired links and resend. Do not store passwords, tokenized links or email bodies in the repo or test reports.
3. Confirm a second browser/device restores the same saved history. Exercise failed upload, reconnect, duplicate prevention, sign-out, a second account and guest migration with these real controlled accounts.
4. Set `emailDeliveryVerified` and `realAccountChecksPassed` only after recording actual successful tests, not merely receiving a successful API response.

The only current security-advisor warning is compromised-password detection being disabled. This feature requires a paid Supabase plan and is intentionally not enabled for the no-new-cost beta. Eight-character minimums and Turnstile do not replace breached-password detection.

References: [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp), [password security and plan limitation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Turnstile Gate

On 2026-09-06, a Free managed Turnstile widget was created for `quantrush.pages.dev` and `romaobraz04.github.io`. Its public site key was deployed to both matching live artifacts before the private secret was entered in Supabase. CAPTCHA enforcement is enabled with Cloudflare Turnstile and remained enabled after the Supabase dashboard was reloaded. The secret is stored only by Supabase and is not present in the repository.

Automated tests verify short-lived token handling, expiry, retry, widget errors and forwarding a fresh token through sign-up, sign-in, password recovery and confirmation resend. Both live origins load the matching client. A real fresh-browser challenge and each live authentication submission still need to be exercised before public promotion; the owner's existing browser sessions were deliberately left signed in.

Reference: [Supabase CAPTCHA integration](https://supabase.com/docs/guides/auth/auth-captcha).

## Hosting Gate

The existing site remains available at `https://romaobraz04.github.io/quantrush/`. The owner authorized Cloudflare for `romaobraz04/quantrush` and requested deployment. Cloudflare deployed `https://quantrush.pages.dev/` on 2026-09-04.

- Source commit: `53d1ca27bd87a012c69b3b9ddf276914ad233151`; generated asset commit: `ea362b297c5ba6868f245ead39d547b48dd88b13`.
- [GitHub verification and legacy deployment](https://github.com/romaobraz04/quantrush/actions/runs/33893636668) passed. All 31 unit tests, 27 browser scenarios and the full-game checks passed locally; the same suite passed in CI.
- Cloudflare deployment: `6d9b5a8e-29c1-4910-809d-d7d2e9feb5f5`. Both live origins return HTTP 200 and their HTML hashes match the tested artifact. Cloudflare serves the generated CSP, frame restrictions and other security headers.
- Full guest gameplay checks passed against the actual Cloudflare address: typed/choice runs, timeout, optional skipping, net score, all-question review, history, coach action and mobile layout. Live account/help views were inspected with the real SDK loaded and no console errors. These checks do not verify real email delivery or cross-device account sync.
- Reference, documentation and test paths return the app fallback, not the underlying files. The published branch contains only the 13 allowlisted application files/assets.
- The old site displays the migration notice and still shows the owner's existing saved history. No history was removed or copied between accounts.
- Supabase Site URL is now `https://quantrush.pages.dev/`. Its allowlist retains the two existing entries and adds seven exact root/index/recovery callbacks for the Cloudflare and GitHub sites. Saved settings were read back successfully; actual confirmation/recovery delivery remains unverified.

GitHub Pages Source was changed from **Deploy from a branch** to **GitHub Actions** before pushing. The workflow runs tests and publishes only the verified `dist/site` artifact. Legacy updates remain enabled unless repository variable `LEGACY_DEPLOY_ENABLED=false` is set after migration.

Cloudflare Pages uses the same repository with production branch `cloudflare-pages`. The workflow writes only the already-tested artifact to this generated branch, preserving its commit history. Framework None, output directory `.`, and build command `test "$CF_PAGES_BRANCH" = cloudflare-pages` are configured. Automatic production deployments remain enabled. Disabling automatic preview branches awaits the owner's approval after browser action review requested confirmation; no workaround was used. The active branch check prevents accidental source-branch publication even while preview builds remain enabled. There is no Cloudflare API token and no second independent build pipeline that can bypass tests.

Deployment for controlled testing and public promotion are distinct: automated checks gate each deployment; `pnpm release:check` gates broader promotion. The latter remains blocked until real email, account, Turnstile and physical-device checks pass. Deploying now does not change those recorded flags.

Use the actual assigned `pages.dev` URL for `productionUrl`; do not invent it. The old site's migration notice appears only once that address is set. Do not automatically redirect guests: they need access to Account > Export progress first. A successful import does not change the old browser's history. Signed-in players can sign in at the new origin to restore cloud history. Keep the old site until transfer and account checks pass.

In Supabase URL Configuration, set the new production site URL only after it exists. Retain old redirect entries and add the new site's root and `index.html` callbacks, with and without `?auth=recovery`. Verify each exact callback on both sites. Keep old confirmation links functional throughout the transition; do not remove the old allowlist entries prematurely.

Reference: [Cloudflare static hosting](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [Pages with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

## Physical Devices and Promotion

Still required: the owner's Samsung browser and iPad Safari. Check practice and Hardcore gameplay, typed/choice controls, optional skipping, recovery, confirmation, sync, sign-out, guest backup transfer, feedback and private owner links. Browser emulation does not mark these complete.

Set `deviceChecksPassed=true` only after those tests. Run `pnpm check` and `pnpm release:check` from the exact commit to be promoted. Confirm a private feedback submission and final production headers/redirects. Broader public sharing remains on hold until all gates pass. Mobile installation and monetization remain out of this release.
