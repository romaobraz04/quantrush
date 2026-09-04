import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaptcha } from '../turnstile.mjs';

test('security widgets recover from navigation during loading and expire their tokens', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  let script, renders = 0, removes = 0, options;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = { createElement: () => ({ remove() {} }), head: { append(value) { script = value; } } };
  try {
    const captcha = createCaptcha('0x-test-key', {});
    const first = captcha.mount(); captcha.remove(); const second = captcha.mount();
    window.turnstile = { render(_, config) { renders++; options = config; return 'widget'; }, reset() { options['expired-callback'](); }, remove() { removes++; } };
    script.onload(); await first; await second;
    assert.equal(renders, 1); assert.throws(() => captcha.token(), /Complete/);
    options.callback('short-lived-token'); assert.equal(captcha.token(), 'short-lived-token');
    options['expired-callback'](); assert.throws(() => captcha.token(), /Complete/);
    options['error-callback'](); assert.throws(() => captcha.token(), /failed/);
    captcha.reset(); captcha.remove(); assert.equal(removes, 1);
    await captcha.mount(); assert.equal(renders, 2); captcha.remove();
    const disabled = createCaptcha('', {}); await disabled.mount(); assert.equal(disabled.token(), undefined);
  } finally { globalThis.window = oldWindow; globalThis.document = oldDocument; }
});
