import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { siteConfig } from '../site-config.mjs';

// A manual release check; never submit live feedback from CI.
const submit = process.argv.includes('--submit-test');
const browser = await chromium.launch();
const marker = `QuantRush release check ${new Date().toISOString()}`;
let page;
try {
  const context = await browser.newContext({ locale: 'en-US' }); page = await context.newPage();
  const formUrl = new URL(siteConfig.feedbackUrl); formUrl.searchParams.set('hl', 'en');
  await page.goto(formUrl.href);
  const body = await page.locator('body').innerText();
  assert.match(body, /QuantRush feedback/);
  assert.doesNotMatch(body, /You need permission|Request access|You must be signed in/);
  assert.equal(await page.locator('input[type="file"]').count(), 0);
  await mkdir('dist/checks', { recursive: true });
  await page.screenshot({ path: 'dist/checks/feedback-anonymous.png', fullPage: true });
  if (submit) {
    const message = page.getByRole('listitem').filter({ hasText: /^Message/ });
    await message.getByRole('textbox').fill(`${marker}. Controlled test submission from a signed-out browser; no player data.`);
    const category = page.getByRole('listitem').filter({ hasText: /^Category/ });
    await category.getByRole('radio', { name: 'Bug report', exact: true }).check();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await page.getByText('Your response has been recorded', { exact: false }).waitFor();
    assert.equal(await page.getByRole('link', { name: /previous responses|summary|see results/i }).count(), 0);
    await writeFile('dist/checks/feedback-test.json', JSON.stringify({ marker, submittedAt: new Date().toISOString() }, null, 2));
    console.log(`Submitted one clearly labeled test response: ${marker}`);
  }
  for (const [name, url] of [['editor', siteConfig.feedbackResultsUrl], ['sheet', siteConfig.feedbackSheetUrl]]) {
    const checkUrl = new URL(url); checkUrl.searchParams.set('hl', 'en'); await page.goto(checkUrl.href);
    const content = await page.locator('body').innerText();
    const finalUrl = new URL(page.url());
    const readOnlyForm = name === 'editor' && finalUrl.pathname.endsWith('/viewform') && finalUrl.searchParams.get('edit_requested') === 'true';
    assert.ok(readOnlyForm || /accounts\.google\.com|Sign in|You need access|You need permission|Request access/i.test(page.url() + content));
    assert.doesNotMatch(content, /QuantRush release check \d{4}-/);
    console.log(`Anonymous ${name} access is blocked.`);
  }
  console.log('Anonymous feedback access and private results checked. Verify the test in the owner view before marking the release gate passed.');
} catch (error) {
  if (page) { await page.screenshot({ path: 'dist/checks/feedback-verification-error.png', fullPage: true }); console.error(await page.locator('body').innerText()); }
  throw error;
} finally { await browser.close(); }
