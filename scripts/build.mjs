import { mkdir, copyFile, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist/site');
if (output !== path.join(root, 'dist', 'site')) throw new Error('Unsafe build output path.');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
const files = ['index.html', 'redesign.css', 'beta.css', 'training-core.mjs', 'beta-core.mjs', 'turnstile.mjs', 'site-config.mjs', '.nojekyll'];
for (const file of files) await copyFile(path.join(root, file), path.join(output, file));
for (const file of await readdir(path.join(root, 'assets'))) {
  if (!/\.(svg|woff2)$/.test(file)) throw new Error(`Unexpected public asset: ${file}`);
  await copyFile(path.join(root, 'assets', file), path.join(output, 'assets', file));
}
const html = (await readFile(path.join(output, 'index.html'), 'utf8')).replace(/\r\n?/g, '\n');
await writeFile(path.join(output, 'index.html'), html);
const inlineScript = html.split('<script type="module">')[1].split('</script>')[0];
const hash = createHash('sha256').update(inlineScript).digest('base64');
const policy = `default-src 'self'; script-src 'self' 'sha256-${hash}' https://cdn.jsdelivr.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://oixhuaaktwwzhcboueqj.supabase.co wss://oixhuaaktwwzhcboueqj.supabase.co https://cdn.jsdelivr.net https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
await writeFile(path.join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: ${policy}\n  Cache-Control: no-cache\n/assets/*\n  Cache-Control: public, max-age=86400\n`);
console.log(`Built application assets only: ${output}`);
