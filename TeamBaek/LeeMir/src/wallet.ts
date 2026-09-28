type WalletWeb = { defaultAddress?: { base58?: string | false }; fullNode?: { host?: string } };
type Provider = {
  request(args: { method: string }): Promise<unknown>;
  tronWeb?: WalletWeb | false;
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};
declare global { interface Window { tron?: Provider; tronLink?: Provider; tronWeb?: WalletWeb } }
export function getWalletState() {
  const web = window.tron?.tronWeb || window.tronLink?.tronWeb || window.tronWeb;
  const address = web?.defaultAddress?.base58;
  const host = web?.fullNode?.host || '';
  const network = host.includes('nile') ? 'Nile 테스트넷' : host.includes('shasta') ? 'Shasta 테스트넷'
    : host.includes('api.trongrid.io') ? 'Mainnet' : '네트워크 확인 필요';
  return { address: typeof address === 'string' ? address : '', network };
}
export async function connectWallet() {
  const provider = window.tron || window.tronLink;
  if (!provider) throw new Error('Chrome에서 TronLink를 설치한 뒤 페이지를 새로고침해 주세요.');
  await provider.request({ method: window.tron ? 'eth_requestAccounts' : 'tron_requestAccounts' });
  const state = getWalletState();
  if (!state.address) throw new Error('지갑 잠금 해제와 연결 승인을 완료해 주세요.');
  return state;
}
export function watchWallet(listener: () => void) {
  const provider = window.tron;
  const events = ['accountsChanged', 'chainChanged', 'disconnect', 'connect'];
  events.forEach(event => provider?.on?.(event, listener));
  const legacy = (event: MessageEvent) => {
    if (event.source === window && event.data?.message?.action) listener();
  };
  window.addEventListener('message', legacy);
  return () => {
    events.forEach(event => provider?.removeListener?.(event, listener));
    window.removeEventListener('message', legacy);
  };
}
