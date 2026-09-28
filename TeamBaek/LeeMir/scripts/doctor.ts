import { readMarkets, readNileBlock } from '../server/data';

const results = await Promise.allSettled([readMarkets(true), readNileBlock()]);
const checks = results.map((result, index) => ({
  name: ['JustLend mainnet market data', 'Nile latest block'][index],
  ok: result.status === 'fulfilled',
  detail: result.status === 'fulfilled'
    ? ('markets' in result.value ? { marketCount: result.value.markets.length, fetchedAt: result.value.fetchedAt } : result.value)
    : (result.reason instanceof Error ? result.reason.message : 'Connection failed'),
}));
console.log(JSON.stringify({ node: process.versions.node, architecture: process.arch,
  rpcKeyConfigured: Boolean(process.env.TRONGRID_API_KEY), checks }, null, 2));
if (checks.some(check => !check.ok) || process.versions.node.split('.')[0] !== '24') process.exitCode = 1;
