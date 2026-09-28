import { createServer } from 'node:http';
import { readMarkets, readNileBlock } from './data';

const port = Number(process.env.API_PORT || 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid API_PORT');
const server = createServer(async (req, res) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET') { send(405, { error: 'GET only' }); return; }
  try {
    if (path === '/api/health') send(200, { ok: true, node: process.versions.node, stage: 'preparation', executionEnabled: false });
    else if (path === '/api/markets') send(200, await readMarkets());
    else if (path === '/api/nile') send(200, await readNileBlock());
    else send(404, { error: 'Not found' });
  } catch (error) {
    console.error(`[${path}] ${error instanceof Error ? error.name : 'Error'}`);
    send(502, { error: '공식 데이터 조회에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 조회해 주세요. 라이브 데이터로 대체 표시한 샘플은 없습니다.' });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`GWDC read API: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exit(1); });
process.on('SIGTERM', () => server.close());
