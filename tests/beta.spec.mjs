import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createBackup, parseBackup } from '../beta-core.mjs';
import { siteConfig } from '../site-config.mjs';

const guestKey = 'quanttempo_guest_sessions_v5';
const userKey = id => `quanttempo_user_sessions_v5_${id}`;
const player = id => ({ id, email: `${id}@example.invalid`, user_metadata: { username: id }, app_metadata: {} });
function savedRun(id = 'guest-run', answerMode = 'choice', allowSkip = false, blueprint = 'structured-v5') {
  return { id, mode: '80in8', startedAt: '2026-09-04T09:00:00.000Z', endedAt: '2026-09-04T09:08:00.000Z', durationSec: 480, score: 1, config: { answerMode, allowSkip, blueprint, questions: Array.from({ length: 80 }, (_, i) => ({ op: 'add', prompt: `${i} + 1`, answer: i + 1, format: 'number', choices: [] })) }, attempts: [{ op: 'add', prompt: '0 + 1', answer: 1, correct: true, firstTry: true, input: '1', ms: 2500 }] };
}

async function mockAccount(page, options = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ options, guestKey }) => {
    if (!sessionStorage.getItem('beta-fixture')) {
      for (const [key, value] of Object.entries(options.storage || {})) localStorage.setItem(key, JSON.stringify(value));
      if (options.guests) localStorage.setItem(guestKey, JSON.stringify(options.guests));
      sessionStorage.setItem('beta-fixture', '1');
    }
    let listener;
    const state = window.qrTest = { user: options.user || null, calls: [], rows: options.cloud || [], failSync: !!options.failSync, emailFails: options.emailFails || 0, holdEmail: !!options.holdEmail };
    const session = () => state.user ? { user: state.user } : null;
    const reply = async type => { state.calls.push({ type }); if (state.holdEmail) await new Promise(r => { state.releaseEmail = r; }); if (state.emailFails-- > 0) return { error: { message: 'Failed to fetch' } }; return {}; };
    const query = table => {
      let owner, payload, selection;
      const result = () => {
        if (table === 'user_profiles') return { data: { display_name: state.user?.user_metadata.username || 'Player' }, count: 1 };
        if (payload) {
          if (state.failSync) return { error: { message: 'Offline test upload' } };
          for (const row of Array.isArray(payload) ? payload : [payload]) {
            const old = state.rows.findIndex(r => r.id === row.id);
            if (old >= 0) state.rows[old] = row; else state.rows.push(row);
          }
          return { data: [] };
        }
        return { data: state.rows.filter(r => !owner || r.user_id === owner), count: state.rows.length };
      };
      const chain = { select(value) { selection = value; return this; }, eq(_, value) { owner = value; return this; }, order() { return this; }, limit() { return this; }, range: async () => result(), maybeSingle: async () => result(), single: async () => result(), upsert(value) { payload = value; return this; }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } };
      return chain;
    };
    window.qrMockClient = { from: query, auth: {
      onAuthStateChange(fn) { listener = fn; },
      getSession: async () => ({ data: { session: session() } }),
      getUser: async () => ({ data: { user: state.user } }),
      async signInWithPassword(value) { state.calls.push({ type: 'signin', ...value }); const id = value.email.split('@')[0]; state.user = { id, email: value.email, user_metadata: { username: id }, app_metadata: {} }; listener('SIGNED_IN', session()); return { data: { session: session() } }; },
      async signUp(value) { state.calls.push({ type: 'signup', ...value }); return { data: { session: null } }; },
      async resetPasswordForEmail(email, options) { state.calls.push({ type: 'reset-args', email, options }); return reply('reset'); },
      async resend(value) { state.calls.push({ ...value, type: 'resend-args', emailType: value.type }); return reply('resend'); },
      async updateUser(value) { state.calls.push({ type: 'update', ...value }); return { data: { user: state.user } }; },
      async signOut(value) { state.calls.push({ type: 'signout', ...value }); state.user = null; listener('SIGNED_OUT', null); return {}; },
    } };
  }, { options, guestKey });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**', route => route.fulfill({ contentType: 'text/javascript', body: 'export function createClient(){return window.qrMockClient;}' }));
  await page.route('**/site-config.mjs', route => route.fulfill({ contentType: 'text/javascript', body: `export const siteConfig=${JSON.stringify({ ...siteConfig, turnstileSiteKey: '', ...options.config })};` }));
  return errors;
}
async function openAccount(page) { await page.locator('#accountPill').click(); await expect(page.locator('#page-account')).toHaveClass(/active/); }
async function fits(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

test('old passwords sign in; new accounts require eight characters', async ({ page }, info) => {
  const errors = await mockAccount(page);
  await page.goto('/'); await openAccount(page);
  await expect(page.locator('#password')).not.toHaveAttribute('minlength');
  await page.locator('#email').fill('playerA@example.invalid'); await page.locator('#password').fill('sixsix'); await page.locator('#authButton').click();
  await expect(page.locator('#signedIn')).toBeVisible(); await expect(page.locator('#syncStatus')).toHaveText('All progress synced.');
  await page.locator('#signOut').click(); await expect(page.locator('#accountPill')).toHaveText('Guest');
  expect(await page.evaluate(() => qrTest.calls.find(c => c.type === 'signout').scope)).toBe('local');
  await page.locator('[data-auth="signup"]').click(); await page.locator('#signupUsername').fill('NewPlayer');
  await expect(page.locator('#password')).toHaveAttribute('minlength', '8');
  await page.locator('#password').fill('short'); await page.locator('#authButton').click();
  expect(await page.evaluate(() => qrTest.calls.some(c => c.type === 'signup'))).toBe(false);
  await page.locator('#password').fill('test-password-only'); await page.locator('#authButton').click();
  await expect(page.locator('#authMsg')).toContainText('Check your email');
  await fits(page); await page.screenshot({ path: info.outputPath('account-signup.png'), fullPage: true }); expect(errors).toEqual([]);
});

test('email recovery shows loading, retry, generic success and cooldown', async ({ page }, info) => {
  await mockAccount(page, { emailFails: 1, holdEmail: true }); await page.goto('/'); await openAccount(page);
  await page.locator('#forgotPassword').click(); await page.locator('#helpEmail').fill('player@example.invalid'); await page.locator('#emailHelpSubmit').click();
  await expect(page.locator('#emailHelpSubmit')).toBeDisabled();
  await page.evaluate(() => { qrTest.holdEmail = false; qrTest.releaseEmail(); });
  await expect(page.locator('#emailHelpMsg')).toContainText('Check your connection');
  await expect(page.locator('#emailHelpSubmit')).toBeEnabled(); await page.locator('#emailHelpSubmit').click();
  await expect(page.locator('#emailHelpMsg')).toContainText('If this address has an account'); await page.locator('#emailHelpSubmit').click();
  await expect(page.locator('#emailHelpMsg')).toContainText('Please wait');
  expect(await page.evaluate(() => qrTest.calls.filter(c => c.type === 'reset').length)).toBe(2);
  expect(await page.evaluate(() => qrTest.calls.find(c => c.type === 'reset-args').options.redirectTo)).toBe('http://127.0.0.1:4174/?auth=recovery');
  await page.locator('#emailHelpBack').click(); await page.locator('#resendConfirmation').click();
  await page.locator('#helpEmail').fill('player@example.invalid'); await page.locator('#emailHelpSubmit').click();
  await expect(page.locator('#emailHelpMsg')).toContainText('If this address needs confirmation');
  await fits(page); await page.screenshot({ path: info.outputPath('resend-confirmation.png'), fullPage: true });
});

test('expired callbacks offer a fresh link and remove URL secrets', async ({ page }) => {
  await mockAccount(page); await page.goto('/?auth=recovery#error=access_denied&error_code=otp_expired&error_description=untrusted');
  await expect(page.locator('#authLinkMsg')).toContainText('expired'); await expect(page.locator('#emailHelp')).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:4174/'); await expect(page.locator('#newPassword')).toBeHidden();
});

test('verified recovery opens a new-password screen and clears passwords after saving', async ({ page }, info) => {
  const errors = await mockAccount(page, { user: player('owner') }); await page.goto('/?auth=recovery#access_token=test-only&type=recovery');
  await expect(page.locator('#passwordRecovery')).toBeVisible(); await expect(page.locator('#newPassword')).toHaveAttribute('minlength', '8');
  await page.locator('#newPassword').fill('new-test-password'); await page.locator('#confirmPassword').fill('different-password'); await page.locator('#savePassword').click();
  await expect(page.locator('#recoveryMsg')).toContainText('do not match'); await fits(page);
  await page.screenshot({ path: info.outputPath('password-recovery.png'), fullPage: true });
  await page.locator('#confirmPassword').fill('new-test-password'); await page.locator('#savePassword').click();
  await expect(page.locator('#accountMsg')).toHaveText('Password updated.'); await expect(page.locator('#newPassword')).toHaveValue('');
  expect(page.url()).toBe('http://127.0.0.1:4174/'); expect(errors).toEqual([]);
});

test('backups transfer guest history, preserve originals, and reject invalid files', async ({ page, browser }) => {
  const source = [savedRun()]; await mockAccount(page, { guests: source }); await page.goto('/'); await openAccount(page);
  const downloaded = page.waitForEvent('download'); await page.locator('#exportProgress').click(); const download = await downloaded;
  const raw = await readFile(await download.path(), 'utf8'); expect(parseBackup(raw)).toHaveLength(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), guestKey)).toEqual(source);
  const secondContext = await browser.newContext(), second = await secondContext.newPage();
  try {
    await mockAccount(second); await second.goto('http://127.0.0.1:4174/'); await openAccount(second);
    const payload = { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) };
    await second.locator('#progressFile').setInputFiles(payload); await expect(second.locator('#transferMsg')).toContainText('Imported 1 sessions');
    await second.locator('#progressFile').setInputFiles(payload); await expect(second.locator('#transferMsg')).toContainText('1 duplicates left unchanged');
    await second.locator('#progressFile').setInputFiles({ ...payload, buffer: Buffer.from('{"app":"malformed"}') });
    await expect(second.locator('#transferMsg')).toContainText('not supported');
    expect(await second.evaluate(key => JSON.parse(localStorage.getItem(key)).length, guestKey)).toBe(1);
  } finally { await secondContext.close(); }
});

test('failed uploads reconnect once, deduplicate, and isolate switched accounts', async ({ page, browser }) => {
  await mockAccount(page, { user: player('playerA'), guests: [savedRun()], failSync: true }); await page.goto('/'); await openAccount(page);
  await expect(page.locator('#syncStatus')).toContainText('Sync incomplete');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, userKey('playerA'))).toBe(1);
  await page.evaluate(() => { qrTest.failSync = false; window.dispatchEvent(new Event('online')); }); await expect(page.locator('#syncStatus')).toHaveText('All progress synced.');
  await page.locator('#syncNow').click(); await expect(page.locator('#syncStatus')).toHaveText('All progress synced.');
  const cloud = await page.evaluate(() => qrTest.rows); expect(cloud).toHaveLength(1);
  await page.locator('#signOut').click(); await expect(page.locator('#accountPill')).toHaveText('Guest');
  await page.locator('#email').fill('playerB@example.invalid'); await page.locator('#password').fill('test-password'); await page.locator('#authButton').click();
  await expect(page.locator('#syncStatus')).toHaveText('All progress synced.');
  await page.locator('[data-page="progress"]').click(); await expect(page.locator('#totalSessions')).toHaveText('0 sessions');
  const secondContext = await browser.newContext(), second = await secondContext.newPage();
  try {
    await mockAccount(second, { user: player('playerA'), cloud }); await second.goto('http://127.0.0.1:4174/'); await openAccount(second);
    await expect(second.locator('#syncStatus')).toHaveText('All progress synced.');
    await second.locator('[data-page="progress"]').click(); await expect(second.locator('#totalSessions')).toHaveText('1 session');
  } finally { await secondContext.close(); }
});

test('feedback analytics stay admin-only and support stays out of timed play', async ({ page }, info) => {
  const user = { ...player('owner'), app_metadata: { role: 'admin' } };
  await mockAccount(page, { user }); await page.goto('/'); await openAccount(page);
  await expect(page.locator('#feedbackResults')).toBeVisible(); await expect(page.locator('#feedbackSheet')).toHaveAttribute('href', siteConfig.feedbackSheetUrl);
  await fits(page); await page.screenshot({ path: info.outputPath('admin-feedback.png'), fullPage: true });
  await page.locator('#signOut').click(); await expect(page.locator('#feedbackResults')).toBeHidden(); await expect(page.locator('#feedbackLink')).toBeVisible();
  await page.locator('[data-page="sim"]').click(); await page.locator('#confirmSim').click(); await expect(page.locator('#supportLinks')).toBeHidden();
  await page.locator('#quitSim').click(); await page.locator('[data-page="home"]').click(); await expect(page.locator('#feedbackLink')).toBeVisible();
  await page.locator('#privacyLink').click(); await expect(page.locator('#page-privacy')).toBeVisible(); await fits(page);
});

test('history compares only matching formats, skip settings and question versions', async ({ page }, info) => {
  await mockAccount(page, { guests: [savedRun(), savedRun('typed', 'typed'), savedRun('skip', 'choice', true), savedRun('old', 'choice', false, 'older')] }); await page.goto('/');
  await page.locator('[data-page="sim"]').click(); await page.locator('#simHistoryTab').click(); await expect(page.locator('.cohort-row')).toHaveCount(4);
  await page.getByLabel('History answer format').selectOption('choice'); await page.getByLabel('History skipping').selectOption('off');
  await expect(page.locator('.history-run')).toHaveCount(2); await expect(page.locator('.cohort-row')).toHaveCount(2);
  await fits(page); await page.screenshot({ path: info.outputPath('history-cohorts.png'), fullPage: true });
  await page.locator('.history-run').first().click(); await expect(page.locator('.review-row')).toHaveCount(80); await expect(page.locator('#feedbackLink')).toBeVisible();
});

test('Turnstile requires a fresh token and passes it to the supported auth flows', async ({ page }) => {
  await mockAccount(page, { config: { turnstileSiteKey: '0x-test-fixture' } });
  await page.route('https://challenges.cloudflare.com/turnstile/**', route => route.fulfill({ contentType: 'text/javascript', body: `
    const widgets=new Map();let count=0;window.turnstile={render(container,options){const id=String(++count),button=document.createElement('button');button.type='button';button.textContent='Complete test security check';button.onclick=()=>options.callback('test-token-'+id);container.append(button);widgets.set(id,{container,options});return id},reset(id){widgets.get(id)?.options['expired-callback']()},remove(id){widgets.get(id)?.container.replaceChildren();widgets.delete(id)}};
  ` }));
  await page.goto('/'); await openAccount(page); await page.locator('#forgotPassword').click();
  await page.locator('#helpEmail').fill('player@example.invalid'); await page.locator('#emailHelpSubmit').click(); await expect(page.locator('#emailHelpMsg')).toContainText('Complete the security check');
  await page.getByRole('button', { name: 'Complete test security check', exact: true }).click(); await page.locator('#emailHelpSubmit').click(); await expect(page.locator('#emailHelpMsg')).toContainText('If this address');
  expect(await page.evaluate(() => qrTest.calls.find(c => c.type === 'reset-args').options.captchaToken)).toMatch(/^test-token-/);
  await page.locator('#emailHelpBack').click(); await page.locator('#resendConfirmation').click();
  await page.locator('#helpEmail').fill('player@example.invalid'); await page.getByRole('button', { name: 'Complete test security check', exact: true }).click();
  await page.locator('#emailHelpSubmit').click(); await expect(page.locator('#emailHelpMsg')).toContainText('If this address needs confirmation');
  expect(await page.evaluate(() => qrTest.calls.find(c => c.type === 'resend-args').options.captchaToken)).toMatch(/^test-token-/);
  await page.locator('#emailHelpBack').click(); await page.locator('[data-auth="signup"]').click();
  await page.locator('#signupUsername').fill('NewPlayer'); await page.locator('#email').fill('other@example.invalid'); await page.locator('#password').fill('test-password');
  await page.getByRole('button', { name: 'Complete test security check', exact: true }).click(); await page.locator('#authButton').click(); await expect(page.locator('#authMsg')).toContainText('Check your email');
  expect(await page.evaluate(() => qrTest.calls.find(c => c.type === 'signup').options.captchaToken)).toMatch(/^test-token-/);
  await page.locator('[data-auth="signin"]').click(); await page.locator('#password').fill('sixsix');
  await page.getByRole('button', { name: 'Complete test security check', exact: true }).click(); await page.locator('#authButton').click();
  await expect(page.locator('#signedIn')).toBeVisible();
  expect(await page.evaluate(() => qrTest.calls.find(c => c.type === 'signin').options.captchaToken)).toMatch(/^test-token-/);
});
