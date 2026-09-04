const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const output = path.join(__dirname, '..', 'dist', 'checks');
fs.mkdirSync(output, { recursive: true });
const number = text => text.includes('/') ? text.split('/').map(Number).reduce((a, b) => a / b) : Number(text);
function solve(prompt) {
  if (prompt.includes('% of')) { const [a, b] = prompt.split('% of').map(Number); return a * b / 100; }
  const [expression, rhs] = prompt.split(' = '), [left, op, right] = expression.split(' '), result = Number.isNaN(number(rhs || '')) ? 0 : number(rhs || '');
  const a = number(left), b = number(right);
  if (left === '?') return op === '+' ? result - b : op === '−' ? result + b : op === '×' ? result / b : result * b;
  if (right === '?') return op === '+' ? result - a : op === '−' ? a - result : op === '×' ? result / a : a / result;
  return op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
}
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('https://cdn.jsdelivr.net/npm/@supabase/**', route => route.fulfill({ contentType: 'application/javascript', body: 'export function createClient(){return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}}}}' }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(process.env.QUANTRUSH_URL || 'http://localhost:4173/index.html');
    await page.getByRole('button', { name: 'Enter simulation', exact: true }).click();
    assert.equal(await page.locator('#simAllowSkip').isChecked(), false);
    assert.doesNotMatch(await page.locator('#simFormatNote').textContent(), /Press S|Blank Enter|0 skipped/);
    await page.screenshot({ path: path.join(output, 'skip-toggle-desktop.png'), animations: 'disabled' });
    await page.locator('#confirmSim').click();
    assert.equal(await page.locator('#simGame [data-skip]').count(), 0);
    await page.locator('#simGame').press('s');
    assert.equal(await page.locator('#simAnswered').textContent(), '0 / 80');
    await page.locator('#quitSim').click();
    await page.locator('[data-sim-answer-format="typed"]').click();
    await page.locator('#confirmSim').click();
    assert.equal(await page.locator('#simGame [data-skip]').count(), 0);
    await page.getByRole('textbox', { name: 'Your answer' }).press('Enter');
    assert.equal(await page.locator('#simAnswered').textContent(), '0 / 80');
    assert.equal(await page.locator('#simScore').textContent(), '0');
    await page.locator('#quitSim').click();
    await page.locator('label[for="simAllowSkip"]').click();
    assert.equal(await page.locator('#simAllowSkip').isChecked(), true);
    assert.match(await page.locator('#simFormatNote').textContent(), /Blank Enter skips/);
    await page.locator('label[for="simHideScore"]').click();
    await page.locator('#confirmSim').click();
    assert.equal(await page.locator('#simScore').textContent(), '—');
    for (let i = 0; i < 39; i++) {
      const prompt = await page.locator('#simGame .problem').textContent(), answer = solve(prompt);
      assert.ok(Number.isFinite(answer), prompt);
      await page.getByRole('textbox', { name: 'Your answer' }).fill((answer + (i >= 30 ? 123 : 0)).toFixed(9));
      await page.getByRole('textbox', { name: 'Your answer' }).press('Enter');
    }
    await page.getByRole('textbox', { name: 'Your answer' }).press('Enter');
    await page.clock.runFor(481000);
    assert.equal(await page.locator('.result-score').textContent(), '21');
    assert.equal(await page.locator('#simScore').textContent(), '21');
    assert.equal(await page.locator('.review-row').count(), 80);
    assert.equal(await page.locator('.review-row.correct').count(), 30);
    assert.equal(await page.locator('.review-row.wrong').count(), 9);
    assert.equal(await page.locator('.review-row.skipped').count(), 1);
    assert.equal(await page.locator('.review-row.unreached').count(), 40);
    await page.screenshot({ path: path.join(output, 'result-desktop.png'), fullPage: true });
    await page.screenshot({ path: path.join(output, 'result-desktop-top.png') });
    await page.getByLabel('Question review filter').selectOption('wrong');
    assert.equal(await page.locator('.review-row').count(), 9);
    await page.getByRole('button', { name: 'All runs', exact: true }).click();
    assert.equal(await page.locator('.history-run').count(), 1);
    await page.reload();
    await page.getByRole('button', { name: 'Enter simulation', exact: true }).click();
    assert.equal(await page.locator('#simAllowSkip').isChecked(), false);
    await page.getByRole('tab', { name: 'Run history' }).click();
    assert.equal(await page.locator('.history-run').count(), 1);
    await page.locator('.history-run').click();
    assert.equal(await page.locator('.review-row').count(), 80);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'result-mobile.png'), fullPage: true });
    await page.screenshot({ path: path.join(output, 'result-mobile-top.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-coach]').click();
    assert.equal(await page.locator('#page-practice').evaluate(el => el.classList.contains('active')), true);
    await page.locator('#startPractice').click();
    assert.ok(await page.locator('#practiceGame .problem').textContent());
    await page.locator('#quitPractice').click();
    await page.getByRole('button', { name: '⚡ 80 in 8', exact: true }).click();
    await page.getByRole('tab', { name: 'Run history', exact: true }).click();
    await page.locator('#simHistory [data-run-again]').click();
    assert.equal(await page.locator('#simGame [data-skip]').count(), 1);
    await page.locator('#quitSim').click();
    await page.screenshot({ path: path.join(output, 'skip-toggle-mobile.png'), animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-sim-answer-format="choice"]').click();
    await page.locator('#confirmSim').click();
    await page.screenshot({ path: path.join(output, 'game-mobile.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const skipBox = await page.locator('[data-skip]').boundingBox();
    assert.ok(skipBox.y + skipBox.height < 766, 'Skip must sit above the mobile navigation');
    for (let i = 0; i < 80; i++) {
      if (i === 0) { await page.locator('#simGame').press('s'); continue; }
      if (i < 3) { await page.locator('[data-skip]').click(); continue; }
      const answer = solve(await page.locator('#simGame .problem').textContent());
      const labels = await page.locator('#simGame .choice > span:last-child').allTextContents();
      const index = labels.findIndex(label => Math.abs(number(label) - answer) < 1e-8);
      assert.ok(index >= 0, JSON.stringify({ answer, labels }));
      await page.locator('#simGame .choice').nth(index).click();
    }
    assert.equal(await page.locator('#simGame .result-score').textContent(), '77');
    assert.equal(await page.locator('#simAnswered').textContent(), '80 / 80');
    await page.getByRole('button', { name: 'All runs', exact: true }).click();
    assert.equal(await page.locator('.history-run').count(), 2);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(output, 'history-desktop.png'), fullPage: true });
    await page.locator('#theme').selectOption('dark');
    await page.locator('.history-run').first().click();
    await page.screenshot({ path: path.join(output, 'result-dark.png') });
    await page.getByRole('button', { name: '◎ Account', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'account-desktop.png') });
    const accountContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await accountContext.route('https://cdn.jsdelivr.net/npm/@supabase/**', route => route.fulfill({ contentType: 'application/javascript', body: `
      export function createClient(){let listener;const user={id:'test-player',email:'player@example.invalid',user_metadata:{username:'TestPlayer'}};let name='TestPlayer';const query=()=>({select(){return this},eq(){return this},order(){return this},range:async()=>({data:[]}),maybeSingle:async()=>({data:{display_name:name}}),single:async()=>({data:{display_name:name}}),upsert(data){if(data.display_name)name=data.display_name;return this},then(resolve){resolve({data:[]})}});return {from:query,auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange:fn=>{listener=fn},signOut:async({scope})=>{if(scope!=='local')throw Error('Wrong sign-out scope');listener('SIGNED_OUT',null);return{}}}}}
    ` }));
    const account = await accountContext.newPage();
    account.on('pageerror', error => errors.push(error.message));
    await account.goto('http://localhost:4173/index.html');
    await account.getByRole('button', { name: '◎ Account', exact: true }).click();
    await account.locator('#syncStatus').filter({ hasText: 'All progress synced.' }).waitFor();
    await account.locator('#profileUsername').fill('NewPlayer');
    await account.getByRole('button', { name: 'Save username', exact: true }).click();
    await account.getByText('Username saved.', { exact: true }).waitFor();
    assert.equal(await account.locator('#accountPill').textContent(), 'NewPlayer');
    await account.screenshot({ path: path.join(output, 'account-signed-in.png'), animations: 'disabled' });
    await account.getByRole('button', { name: 'Sign out on this device', exact: true }).click();
    await account.getByText('Signed out on this device. Saved account progress is kept.', { exact: true }).waitFor();
    assert.equal(await account.locator('#accountPill').textContent(), 'Guest');
    await accountContext.close();
    assert.deepEqual(errors, []);
    console.log('PASS: typed and choice runs, timeout, skip, net score, full review, history persistence, coach action, mobile layout, and no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
