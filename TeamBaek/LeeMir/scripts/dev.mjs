import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

if (process.versions.node.split('.')[0] !== '24') {
  console.error('Node 24가 필요합니다. ./scripts/run run dev 로 실행하세요.');
  process.exit(1);
}
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const env = { ...process.env, API_PORT: process.env.API_PORT || '8787' };
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env.local', '--watch', '--import', 'tsx', 'server/index.ts'], { stdio: 'inherit', env }),
  spawn(process.execPath, ['--env-file-if-exists=.env.local', 'node_modules/vite/bin/vite.js'], { stdio: 'inherit', env }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
children.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
});
