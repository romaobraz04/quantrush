import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, mergeProgress, cohortStats, runSettings, feedbackUrl, releaseBlockers, authCallbackInfo } from '../beta-core.mjs';
import { appHarness } from './app-harness.mjs';

function savedRun(id = 'saved-run', extra = {}) {
  return { id, mode: '80in8', startedAt: '2026-09-04T09:00:00.000Z', endedAt: '2026-09-04T09:08:00.000Z', durationSec: 480, score: 1, config: { blueprint: 'structured-v5', answerMode: 'choice', allowSkip: false, questions: Array.from({ length: 80 }, (_, i) => ({ op: 'add', prompt: `${i} + 1`, answer: i + 1, format: 'number', choices: [] })) }, attempts: [{ op: 'add', prompt: '0 + 1', answer: 1, correct: true, firstTry: true, input: '1', ms: 2500 }], ...extra };
}
test('versioned backups preserve all questions, settings, and guest records', () => {
  const source = [savedRun()], backup = createBackup(source), restored = parseBackup(JSON.stringify(backup));
  assert.equal(backup.version, 1);assert.equal(restored[0].config.questions.length, 80);
  assert.equal(restored[0].config.allowSkip, false);assert.equal(restored[0].attempts[0].ms, 2500);
  assert.deepEqual(source, [savedRun()]);
});
test('backups reject other accounts, malformed records, unsupported versions, and oversized inputs', () => {
  const backup = createBackup([savedRun()], 'owner');
  assert.throws(() => parseBackup(JSON.stringify(backup)), /Sign in/);
  assert.throws(() => parseBackup(JSON.stringify(backup), 'other'), /Sign in/);
  assert.equal(parseBackup(JSON.stringify(backup), 'owner').length, 1);
  for (const change of [b => b.version = 99, b => b.sessions[0].attempts[0].ms = -1, b => b.sessions[0].config.questions.pop(), b => b.sessions[0].attempts[0].prompt = 'different', b => b.sessions[0].config.allowSkip = 'false', b => b.sessions[0].startedAt = 'bad']) {
    const data = createBackup([savedRun()]);change(data);assert.throws(() => parseBackup(JSON.stringify(data)));
  }
  assert.throws(() => parseBackup('{'), /JSON/);
  assert.throws(() => parseBackup('x'.repeat(20 * 1024 * 1024 + 1)), /20 MB/);
});
test('backups whitelist fields and never replace an existing session', () => {
  const backup = createBackup([savedRun()]);
  backup.sessions[0].user_id = 'other-user';backup.sessions[0].config.access_token = 'not-exported';
  const clean = parseBackup(JSON.stringify(backup));
  assert.equal(clean[0].user_id, undefined);assert.equal(clean[0].config.access_token, undefined);
  const existing = savedRun('saved-run', { score: 20 });
  const merged = mergeProgress([existing], [...clean, savedRun('second')]);
  assert.equal(merged.length, 2);assert.equal(merged.find(s => s.id === 'saved-run').score, 20);
  assert.equal(mergeProgress(merged, clean).length, 2);
});
test('history comparisons separate format, skipping, version, and unknown legacy settings', () => {
  const runs = [savedRun(), savedRun('b', { config: { blueprint: 'structured-v5', answerMode: 'choice', allowSkip: true } }), savedRun('c', { config: { blueprint: 'structured-v5', answerMode: 'typed', allowSkip: false } }), savedRun('d', { config: { blueprint: 'old', answerMode: 'choice', allowSkip: false } }), savedRun('e', { config: { blueprint: 'structured-v5', answerMode: 'choice' } })];
  assert.equal(cohortStats(runs).length, 5);
  assert.equal(runSettings(runs[4]).skipping, 'unknown');
  assert.ok(cohortStats(runs).every(g => g.best === 1 && g.count === 1));
});
test('public release cannot pass with missing email, private feedback, security, or device checks', () => {
  assert.equal(releaseBlockers({}).length, 6);
  assert.equal(feedbackUrl({ feedbackUrl: 'javascript:alert(1)' }), '');
  assert.equal(feedbackUrl({ feedbackUrl: 'https://evil.example/forms/' }), '');
  assert.ok(feedbackUrl({ feedbackUrl: 'https://forms.gle/test-only' }));
  const config = { productionUrl: 'https://test-only.pages.dev/', feedbackUrl: 'https://forms.gle/test-only', turnstileSiteKey: '0x-production-example', emailDeliveryVerified: true, realAccountChecksPassed: true, deviceChecksPassed: true, feedbackPrivacyVerified: true };
  assert.deepEqual(releaseBlockers(config), []);
  assert.equal(releaseBlockers({ ...config, turnstileSiteKey: '1x00000000000000000000AA' }).length, 1);
});
test('auth callback errors are not reflected into user-visible text', () => {
  const callback = authCallbackInfo('https://site.example/?auth=recovery#error=access_denied&error_code=otp_expired&error_description=%3Cscript%3E');
  assert.equal(callback.recovery, true);assert.match(callback.error, /expired/);assert.doesNotMatch(callback.error, /script/);
});
test('sign in accepts an existing short password but signup rejects one', async () => {
  const { run, context, get } = appHarness();let signedIn;
  context.auth = { signInWithPassword: async value => { signedIn = value;return { data: { session: null } }; } };
  run('supabase={auth}');get('email').value = 'tester@example.invalid';get('password').value = 'sixsix';
  await run('authAction()');assert.equal(signedIn.password, 'sixsix');
  run("setAuthMode('signup')");get('signupUsername').value = 'tester';get('password').value = 'sixsix';
  await run('authAction()');assert.match(get('authMsg').textContent, /8 characters/);
});
test('reset and resend use exact callbacks and generic replies with cooldown', async () => {
  const { run, context, get } = appHarness();const calls = [];
  context.auth = { resetPasswordForEmail: async (...args) => { calls.push(args);return {}; }, resend: async value => { calls.push(value);return {}; } };
  run("supabase={auth};openEmailHelp('reset')");get('helpEmail').value = 'tester@example.invalid';
  await run('sendAccountEmail()');assert.equal(calls[0][1].redirectTo, 'http://localhost/index.html?auth=recovery');assert.match(get('emailHelpMsg').textContent, /^If this address/);
  await run('sendAccountEmail()');assert.equal(calls.length, 1);assert.match(get('emailHelpMsg').textContent, /wait/);
  run("openEmailHelp('resend')");get('helpEmail').value = 'tester@example.invalid';await run('sendAccountEmail()');
  assert.equal(calls[1].type, 'signup');assert.equal(calls[1].options.emailRedirectTo, 'http://localhost/index.html');
});
test('failed recovery requests restore retry controls and do not lose progress', async () => {
  const { run, context, get } = appHarness();context.auth = { resetPasswordForEmail: async () => ({ error: { message: 'Failed to fetch' } }) };
  run("supabase={auth};sessions=[{id:'kept'}];openEmailHelp('reset')");get('helpEmail').value = 'tester@example.invalid';
  await run('sendAccountEmail()');assert.match(get('emailHelpMsg').textContent, /connection/);assert.equal(get('emailHelpSubmit').disabled, false);assert.equal(run('sessions[0].id'), 'kept');
});
test('password recovery verifies identity and rejects mismatched passwords', async () => {
  const { run, context, get } = appHarness();let updated = 0;
  context.auth = { getUser: async () => ({ data: { user: { id: 'owner' } } }), updateUser: async () => { updated++;return {}; } };
  run("supabase={auth};currentUser={id:'owner'};recoveryVerifiedUserId='owner';openRecovery('owner')");get('newPassword').value = 'a-long-new-password';get('confirmPassword').value = 'different-password';
  await run('saveRecoveredPassword()');assert.equal(updated, 0);assert.match(get('recoveryMsg').textContent, /match/);
  get('confirmPassword').value = get('newPassword').value;await run('saveRecoveredPassword()');assert.equal(updated, 1);assert.equal(run('authView'), 'account');assert.equal(get('newPassword').value, '');
});
test('changing accounts during recovery verification does not change the next account password', async () => {
  const { run, context, get } = appHarness();let resolve, updated = 0;
  context.auth = { getUser: () => new Promise(r => { resolve = r; }), updateUser: async () => { updated++;return {}; } };
  run("supabase={auth};currentUser={id:'owner'};recoveryVerifiedUserId='owner';openRecovery('owner')");get('newPassword').value = get('confirmPassword').value = 'a-long-new-password';
  const pending = run('saveRecoveredPassword()');run("applyAuthUser({id:'different'})");resolve({ data: { user: { id: 'owner' } } });await pending;
  assert.equal(updated, 0);assert.equal(run('authView'), 'account');assert.equal(get('savePassword').disabled, false);
});
test('failed overlapping syncs do not retry forever and keep locally saved progress', async () => {
  const { run, context, storage } = appHarness();let attempts = 0, resolve;
  context.cloud = { from: () => ({ upsert: () => { attempts++;return new Promise(r => { resolve = r; }); } }) };
  run("supabase=cloud;currentUser={id:'owner'};sessions=[{id:'kept',attempts:[]}]");
  const one = run('syncAll()'), two = run('syncAll()');resolve({ error: { message: 'Offline' } });await one;await two;
  assert.equal(attempts, 1);assert.equal(run('syncTask'), null);assert.equal(JSON.parse(storage.get('quanttempo_user_sessions_v5_owner'))[0].id, 'kept');
});
test('import aborts on account changes and storage errors without overwriting history', async () => {
  const { run, context, storage, get } = appHarness();let resolve;
  context.file = { size: 50, text: () => new Promise(r => { resolve = r; }) };
  const pending = run('importProgressFile(file)');run("applyAuthUser({id:'different'})");resolve(JSON.stringify(createBackup([savedRun()])));await pending;
  assert.equal(run('sessions.length'), 0);
  context.file = { size: 50, text: async () => JSON.stringify(createBackup([savedRun()])) };
  storage.set('quanttempo_user_sessions_v5_different', '[]');context.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  await run('importProgressFile(file)');assert.equal(run('sessions.length'), 0);assert.match(get('transferMsg').textContent, /unchanged/);
});
test('multiplication and division final-digit shortcuts remain limited in each run', () => {
  const { run } = appHarness();
  run(`let seed=12940;Math.random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/2**32);for(const op of ['mul','div'])for(const simulation of [false,true]){state.mulShortcutCount=0;state.divShortcutCount=0;let shortcuts=0;for(let i=0;i<500;i++){const p=genFor(op,'hard',{simulation,signed:simulation&&i%3===0}),opts=makeChoices(p),units=Math.abs(p.ans)%10;if(opts.filter(o=>Math.abs(o.value)%10===units).length===1)shortcuts++;}if(shortcuts>2)throw Error(op+': '+shortcuts+' shortcuts');}`);
});
test('typed answers accept equivalent signed fractions and precise decimals', () => {
  const { run } = appHarness();
  for (const [answer, expected] of [['6/10', .6], ['-6/10', -.6], ['-6/-10', .6], ['0,00625', .00625], ['.000002', .000002]]) assert.equal(run(`correct(${JSON.stringify(answer)},{ans:${expected}})`), true);
  for (const answer of ['1/0', 'Infinity', '0/0', '1/2/3', '1e3']) assert.equal(run(`correct(${JSON.stringify(answer)},{ans:1})`), false);
});
