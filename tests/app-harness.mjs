import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../training-core.mjs';
import * as beta from '../beta-core.mjs';
import { siteConfig } from '../site-config.mjs';

export function appHarness() {
  const elements = new Map(), storage = new Map();
  const get = id => {
    if (!elements.has(id)) {
      const classes = new Set(['hidden']);
      elements.set(id, { value: '', textContent: '', innerHTML: '', disabled: false, classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), toggle(n, force) { if (force ?? !classes.has(n)) classes.add(n); else classes.delete(n); }, contains: n => classes.has(n) }, style: { setProperty() {} }, querySelector() { return get('child'); }, querySelectorAll() { return []; }, focus() {}, setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; }, reportValidity() { return true; } });
    }
    return elements.get(id);
  };
  const context = vm.createContext({ ...core, ...beta, siteConfig, createCaptcha: () => ({ mount: async () => {}, token: () => undefined, reset() {}, remove() {} }), TextEncoder, URL, URLSearchParams, Blob, document: { getElementById: get, querySelectorAll: () => [] }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, v) => storage.set(key, v), removeItem: key => storage.delete(key) }, console, setTimeout: () => 0, clearInterval() {}, setInterval: () => 0, crypto: { randomUUID: () => 'test-run' }, confirm: () => true, Intl, location: { href: 'http://localhost/index.html', protocol: 'http:', origin: 'http://localhost', pathname: '/index.html' } });
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.split('<script type="module">')[1].split('</script>')[0];
  const code = script.slice(script.indexOf('const SUPABASE_URL'), script.indexOf("\nqsa('.navbtn')")).split('\n').filter(line => !line.startsWith('try{const mod=await import(')).join('\n');
  vm.runInContext(code, context);
  const run = code => vm.runInContext(code, context);
  run('renderAll=()=>{};renderAuth=()=>{};renderAdmin=()=>{};renderProblem=()=>{};renderGameStats=()=>{};renderRunDetail=()=>{};');
  return { run, context, get, storage };
}
