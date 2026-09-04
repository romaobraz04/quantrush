import { siteConfig } from '../site-config.mjs';
import { releaseBlockers } from '../beta-core.mjs';
const blockers = releaseBlockers(siteConfig);
if (blockers.length) { console.error('Public beta is on hold:\n' + blockers.map(message => '- ' + message).join('\n')); process.exitCode = 1; }
else console.log('Recorded public-beta release gates passed.');
