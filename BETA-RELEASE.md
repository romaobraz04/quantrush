# Public Beta Release Record

Status: implementation prepared; public promotion is blocked. No paid services, subscriptions, domains or security upgrades have been purchased.

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

The client integration is implemented and tested with a simulated widget; no production key or server secret is configured yet.

1. Create a Free Turnstile widget for the production Pages hostname and the retained GitHub hostname. Restrict hostnames rather than allowing arbitrary domains. Add localhost only when needed for controlled local checks.
2. Put only its public site key in `site-config.mjs`. Store its secret in Supabase Auth CAPTCHA settings; never commit it or send it in a client request.
3. Deploy the matching client to both sites before enabling Supabase enforcement, so old-site sign-in does not break during the transition.
4. Verify signup, sign-in, password recovery and confirmation resend, including token expiry, retry, blocked-script failure and server rejection of requests without a valid token.

Reference: [Supabase CAPTCHA integration](https://supabase.com/docs/guides/auth/auth-captcha).

## Hosting Gate

The existing site remains available at `https://romaobraz04.github.io/quantrush/`. The owner authorized Cloudflare for `romaobraz04/quantrush` and requested deployment. Cloudflare's setup assigns `https://quantrush.pages.dev/`; live verification is required after deployment.

GitHub Pages Source was changed from **Deploy from a branch** to **GitHub Actions** before pushing. The workflow runs tests and publishes only the verified `dist/site` artifact. Legacy updates remain enabled unless repository variable `LEGACY_DEPLOY_ENABLED=false` is set after migration.

For Cloudflare Pages Free, use the same repository with production branch `cloudflare-pages`. The workflow writes only the already-tested artifact to this generated branch, preserving its commit history. Configure framework None, output directory `.`, build command `test "$CF_PAGES_BRANCH" = cloudflare-pages`, and disable preview branches. The branch check also prevents accidental source-branch publication. There is no Cloudflare API token and no second independent build pipeline that can bypass tests.

Deployment for controlled testing and public promotion are distinct: automated checks gate each deployment; `pnpm release:check` gates broader promotion. The latter remains blocked until real email, account, Turnstile and physical-device checks pass. Deploying now does not change those recorded flags.

Use the actual assigned `pages.dev` URL for `productionUrl`; do not invent it. The old site's migration notice appears only once that address is set. Do not automatically redirect guests: they need access to Account > Export progress first. A successful import does not change the old browser's history. Signed-in players can sign in at the new origin to restore cloud history. Keep the old site until transfer and account checks pass.

In Supabase URL Configuration, set the new production site URL only after it exists. Retain old redirect entries and add the new site's root and `index.html` callbacks, with and without `?auth=recovery`. Verify each exact callback on both sites. Keep old confirmation links functional throughout the transition; do not remove the old allowlist entries prematurely.

Reference: [Cloudflare static hosting](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [Pages with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

## Physical Devices and Promotion

Still required: the owner's Samsung browser and iPad Safari. Check practice and Hardcore gameplay, typed/choice controls, optional skipping, recovery, confirmation, sync, sign-out, guest backup transfer, feedback and private owner links. Browser emulation does not mark these complete.

Set `deviceChecksPassed=true` only after those tests. Run `pnpm check` and `pnpm release:check` from the exact commit to be promoted. Confirm a private feedback submission and final production headers/redirects. Broader public sharing remains on hold until all gates pass. Mobile installation and monetization remain out of this release.
