import { readFile } from 'node:fs/promises';
import { parseBackup, cohortStats } from '../beta-core.mjs';
const files = process.argv.slice(2);
if (!files.length) { console.error('Provide voluntarily shared QuantRush backup files. This command does not query any user accounts.'); process.exitCode = 1; }
for (const file of files) {
  const raw = await readFile(file, 'utf8'), source = JSON.parse(raw), sessions = parseBackup(raw, source.accountId || null);
  console.log(JSON.stringify({ file, sessions: sessions.length, groups: cohortStats(sessions.filter(s => s.mode === '80in8')).map(({ runs, ...group }) => group) }, null, 2));
}
