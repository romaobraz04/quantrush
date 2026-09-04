import { spawn } from 'node:child_process';
import { startServer } from './serve.mjs';
const server = await startServer();
try {
  const exit = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tests/browser.cjs'], { stdio: 'inherit', env: { ...process.env, QUANTRUSH_URL: `http://127.0.0.1:${server.address().port}/index.html` } });
    child.once('error', reject); child.once('exit', resolve);
  });
  if (exit) process.exitCode = exit;
} finally { await new Promise(resolve => server.close(resolve)); }
