import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DecimalBase from 'decimal.js';
import type { MarketSnapshot } from '../shared/markets';
import { estimateYield, previewLiquidity } from '../shared/planning';
import { connectWallet, getWalletState, watchWallet } from './wallet';
import './style.css';

const Decimal = DecimalBase.clone({ precision: 128 });

type Profile = {
  holdings: string;
  horizonDays: string;
  expense: string;
  expenseDay: string;
  reserve: string;
  risk: 'conservative' | 'balanced' | 'growth';
};
type NileStatus = { block: number; blockTime: string; fetchedAt: string; source: string; network: 'nile' };
type Route = '/' | '/needs' | '/plans' | '/markets' | '/connections';

const routeTitles: Record<Route, string> = {
  '/': '개요', '/needs': '요구 분석', '/plans': '계획 미리보기',
  '/markets': '시장 데이터', '/connections': '연결 상태',
};
const routes = Object.keys(routeTitles) as Route[];

function currentRoute(): Route {
  const path = window.location.pathname;
  if (routes.includes(path as Route)) {
    const legacyHash = `/${window.location.hash.slice(1)}`;
    return path === '/' && routes.includes(legacyHash as Route) ? legacyHash as Route : path as Route;
  }
  return '/';
}

const initialProfile: Profile = {
  holdings: '1000', horizonDays: '30', expense: '200', expenseDay: '7', reserve: '0', risk: 'balanced',
};

function money(value: string, places = 2) {
  const [whole, fraction] = new Decimal(value).toFixed(places).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
function formatRate(value: string) {
  return new Decimal(value).times(100).toFixed(4);
}
function kst(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
async function read<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}

function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [snapshot, setSnapshot] = useState<MarketSnapshot>();
  const [marketError, setMarketError] = useState('');
  const [loading, setLoading] = useState(false);
  const [nile, setNile] = useState<NileStatus>();
  const [nileError, setNileError] = useState('');
  const [wallet, setWallet] = useState(getWalletState);
  const [walletMessage, setWalletMessage] = useState('주소 조회만 요청하며 거래 서명은 요청하지 않습니다.');
  const [marketQuery, setMarketQuery] = useState('');

  useEffect(() => {
    if (window.location.pathname !== route || window.location.hash) {
      window.history.replaceState(null, '', route);
    }
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    document.title = `${routeTitles[route]} · GWDC TRON 자산 계획`;
  }, [route]);

  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, next: Route) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (next !== route) {
      window.history.pushState(null, '', next);
      setRoute(next);
    }
    window.scrollTo(0, 0);
  };

  const updateProfile = (field: keyof Profile, value: string) => {
    setProfile(current => ({ ...current, [field]: value }));
  };
  const refreshMarkets = async () => {
    setLoading(true);
    setMarketError('');
    setSnapshot(undefined);
    try { setSnapshot(await read<MarketSnapshot>('/api/markets')); }
    catch (error) { setMarketError(error instanceof Error ? error.message : '시장 조회에 실패했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void refreshMarkets();
    void read<NileStatus>('/api/nile').then(setNile)
      .catch(error => setNileError(error instanceof Error ? error.message : 'Nile RPC 연결 실패'));
    return watchWallet(() => setWallet(getWalletState()));
  }, []);
  const connect = async () => {
    try {
      setWallet(await connectWallet());
      setWalletMessage('주소 연결을 확인했습니다. 거래 기능은 아직 제공하지 않습니다.');
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : '지갑 연결이 취소되었습니다.');
    }
  };

  const planning = (() => {
    try {
      if (!/^\d+$/.test(profile.horizonDays) || !/^\d+$/.test(profile.expenseDay)) {
        throw new Error('운용 기간과 지출일을 정수로 입력해 주세요.');
      }
      return { result: previewLiquidity({
        holdings: profile.holdings, horizonDays: Number(profile.horizonDays),
        expense: profile.expense, expenseDay: Number(profile.expenseDay), reserve: profile.reserve,
      }), error: '' };
    } catch (error) {
      return { result: undefined, error: error instanceof Error ? error.message : '입력값을 확인해 주세요.' };
    }
  })();
  const investable = planning.result?.investableAmount;
  const jUsdt = snapshot?.markets.find(market => market.symbol === 'jUSDT');
  const jUsdd = snapshot?.markets.find(market => market.symbol === 'jUSDD');
  const baseYield = jUsdt && investable && new Decimal(investable).gt(0)
    ? estimateYield({ principal: investable, days: Number(profile.horizonDays), baseApy: jUsdt.supplyRate,
      rewardApr: '0', totalCost: '0' }).baseYield
    : undefined;
  const visibleMarkets = snapshot?.markets.filter(market =>
    `${market.underlyingSymbol} ${market.symbol}`.toLowerCase().includes(marketQuery.trim().toLowerCase())) || [];
  const holdings = planning.result ? new Decimal(profile.holdings) : undefined;
  const investedPercent = holdings && holdings.gt(0)
    ? new Decimal(investable || '0').div(holdings).times(100).toFixed(2)
    : '0';
  const riskLabel = { conservative: '보수형', balanced: '균형형', growth: '성장형' }[profile.risk];

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" onClick={event => navigate(event, '/')} aria-label="GWDC 홈">
        <span className="brand-mark"><span /></span>
        <span className="brand-copy"><strong>GWDC</strong><small>TRON / CHALLENGE B</small></span>
      </a>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="주요 메뉴">
        <a className={route === '/' ? 'selected' : ''} aria-current={route === '/' ? 'page' : undefined} href="/" onClick={event => navigate(event, '/')}><span className="nav-glyph">◫</span> 개요 <span className="nav-index">01</span></a>
        <a className={route === '/needs' ? 'selected' : ''} aria-current={route === '/needs' ? 'page' : undefined} href="/needs" onClick={event => navigate(event, '/needs')}><span className="nav-glyph">◈</span> 요구 분석 <span className="nav-index">02</span></a>
        <a className={route === '/plans' ? 'selected' : ''} aria-current={route === '/plans' ? 'page' : undefined} href="/plans" onClick={event => navigate(event, '/plans')}><span className="nav-glyph">▤</span> 계획 미리보기 <span className="nav-index">03</span></a>
        <a className={route === '/markets' ? 'selected' : ''} aria-current={route === '/markets' ? 'page' : undefined} href="/markets" onClick={event => navigate(event, '/markets')}><span className="nav-glyph">▥</span> 시장 데이터 <span className="nav-index">04</span></a>
        <a className={route === '/connections' ? 'selected' : ''} aria-current={route === '/connections' ? 'page' : undefined} href="/connections" onClick={event => navigate(event, '/connections')}><span className="nav-glyph">◇</span> 연결 상태 <span className="nav-index">05</span></a>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="note-light" /> READ-ONLY MODE
          <p>현재 화면은 시연용 입력과 공식 시장 조회를 조합한 계획 초안입니다.</p>
        </div>
        <div className="sidebar-foot">GWDC 2026 <span>•</span> PROTOTYPE</div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb">WORKSPACE <span>/</span> <strong>{routeTitles[route]}</strong></div>
        <div className="topbar-right"><span className="mode-chip"><span /> 조회 전용</span><span className="topbar-date">TRON MAINNET DATA</span></div>
      </header>

      <div className="page-content">
        {route === '/' && <>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-kicker"><span className="kicker-line" /> THE LIQUIDITY-FIRST PLAN</p>
            <h1 id="hero-title">필요한 돈은 남기고,<br /><em>나머지의 가능성을 살펴보세요.</em></h1>
            <p className="hero-description">지출 일정부터 확인해 운용 가능한 금액을 계산합니다. 공식 시장 수익률과 아직 확인되지 않은 비용·위험을 함께 보여주는 조회용 화면입니다.</p>
            <a className="hero-action" href="/needs" onClick={event => navigate(event, '/needs')}>시연 사례 살펴보기 <span aria-hidden="true">↗</span></a>
          </div>
          <div className="hero-card" aria-label="시연 금액 요약">
            <div className="hero-card-top"><span>시연용 가상 입력</span><span className="hero-card-icon">↗</span></div>
            <div className="hero-card-main"><small>현재 운용 가능 상한</small><div><strong>{investable ? money(investable, 0) : '—'}</strong><span>USDT</span></div></div>
            <div className="hero-bar" role="img" aria-label={planning.result ? `보유액 중 운용 가능액 ${investedPercent}%` : '입력값 확인 필요'}>
              <span style={{ width: `${investedPercent}%` }} />
            </div>
            <div className="hero-card-bottom"><span>보유 {planning.result ? money(profile.holdings, 0) : '—'} USDT</span><span>확보 {planning.result ? money(planning.result.protectedAmount, 0) : '—'} USDT</span></div>
          </div>
        </section>
        <div className="overview-heading"><p className="overline">YOUR WORKFLOW</p><h2>세 단계로 살펴보세요</h2><p>입력한 조건은 페이지를 이동해도 유지됩니다. 모든 금액은 가상 시연 값입니다.</p></div>
        <div className="overview-grid">
          <a className="overview-card" href="/needs" onClick={event => navigate(event, '/needs')}><span>01 / 요구 분석</span><strong>지출 일정과<br />운용 상한 확인</strong><p>언제 얼마가 필요한지 입력하고 남겨둘 금액을 계산합니다.</p><b aria-hidden="true">↗</b></a>
          <a className="overview-card" href="/plans" onClick={event => navigate(event, '/plans')}><span>02 / 계획 비교</span><strong>같은 조건에서<br />경로 나란히 보기</strong><p>JustLend, USDD 후보와 보유 기준선의 확인 항목을 비교합니다.</p><b aria-hidden="true">↗</b></a>
          <a className="overview-card" href="/markets" onClick={event => navigate(event, '/markets')}><span>03 / 시장 데이터</span><strong>공식 조회값과<br />출처 살펴보기</strong><p>Mainnet 시장의 기본 금리와 조회 시각을 확인합니다.</p><b aria-hidden="true">↗</b></a>
        </div>
        <div className="overview-status"><span><i /> JustLend {snapshot ? `${snapshot.markets.length}개 시장 조회` : marketError ? '조회 실패' : '조회 중'}</span><span>Nile {nile ? `블록 #${nile.block.toLocaleString('ko-KR')}` : nileError ? '연결 확인 필요' : '연결 확인 중'}</span><a href="/connections" onClick={event => navigate(event, '/connections')}>연결 상태 보기 ↗</a></div>
        </>}

        {route === '/needs' && <>
        <section className="section-intro">
          <div><p className="overline">01 / NEEDS ANALYSIS</p><h2>지출 계획부터 정리합니다</h2><p>아래 값은 가상 시연 입력이며, 지갑 잔고나 실제 사용자 자산이 아닙니다.</p></div>
          <span className="section-badge">대화형 AI 분석은 준비 중</span>
        </section>

        <div className="planning-grid">
          <section className="surface input-panel" aria-label="시연 입력">
            <div className="panel-head"><div><span className="panel-step">01</span><h3>내 조건 입력</h3></div><button className="text-button" onClick={() => setProfile(initialProfile)}>시연 값으로 초기화 ↺</button></div>
            <div className="form-grid">
              <label className="field wide"><span>보유 자산</span><div className="static-input"><span className="asset-symbol">₮</span><strong>USDT</strong><small>가상 잔고</small></div></label>
              <label className="field"><span>보유 금액</span><div className="field-control"><input value={profile.holdings} onChange={event => updateProfile('holdings', event.target.value)} inputMode="decimal" aria-label="보유 금액" /><b>USDT</b></div></label>
              <label className="field"><span>운용 기간</span><div className="field-control"><input value={profile.horizonDays} onChange={event => updateProfile('horizonDays', event.target.value)} inputMode="numeric" aria-label="운용 기간" /><b>일</b></div></label>
              <label className="field"><span>예정 지출액</span><div className="field-control"><input value={profile.expense} onChange={event => updateProfile('expense', event.target.value)} inputMode="decimal" aria-label="예정 지출액" /><b>USDT</b></div></label>
              <label className="field"><span>지출까지 남은 기간</span><div className="field-control"><input value={profile.expenseDay} onChange={event => updateProfile('expenseDay', event.target.value)} inputMode="numeric" aria-label="지출까지 남은 기간" /><b>일</b></div></label>
              <label className="field"><span>추가 비상 예비액</span><div className="field-control"><input value={profile.reserve} onChange={event => updateProfile('reserve', event.target.value)} inputMode="decimal" aria-label="추가 비상 예비액" /><b>USDT</b></div></label>
              <label className="field"><span>위험 성향</span><select value={profile.risk} onChange={event => updateProfile('risk', event.target.value)} aria-label="위험 성향"><option value="conservative">보수형</option><option value="balanced">균형형</option><option value="growth">성장형</option></select></label>
            </div>
            <div className="scenario-picker"><span>지출일 빠르게 비교</span><div><button className={profile.expenseDay === '7' ? 'on' : ''} onClick={() => updateProfile('expenseDay', '7')}>7일 뒤</button><button className={profile.expenseDay === '45' ? 'on' : ''} onClick={() => updateProfile('expenseDay', '45')}>45일 뒤</button></div></div>
          </section>

          <section className="surface outcome-panel" aria-label="유동성 계산 결과">
            <div className="panel-head"><div><span className="panel-step dark">02</span><h3>유동성 계산</h3></div><span className="read-only-tag">자동 계산</span></div>
            {planning.error ? <div className="input-error" role="alert"><strong>입력값을 확인해 주세요</strong><p>{planning.error}</p></div> : <>
              <div className="outcome-amount"><small>운용 가능 금액의 상한</small><div><strong>{money(investable!)}</strong><span>USDT</span></div><p>{planning.result!.dueWithinHorizon ? `지출이 운용 종료 전인 ${profile.expenseDay}일 뒤 예정되어 있어 금액을 먼저 확보합니다.` : `지출이 ${profile.horizonDays}일 운용 기간 이후라 지출액을 현재 확보액에서 제외합니다.`}</p></div>
              <div className="allocation-bar" aria-hidden="true"><span style={{ width: `${investedPercent}%` }} /></div>
              <div className="allocation-key"><span><i className="key-invest" />운용 가능 상한 <b>{money(investable!)} USDT</b></span><span><i className="key-held" />먼저 확보 <b>{money(planning.result!.protectedAmount)} USDT</b></span></div>
              <div className="reason-box"><span className="reason-icon">✦</span><p><strong>이번 계산의 근거</strong><br />{planning.result!.dueWithinHorizon ? `${profile.expense} USDT 지출과 ${profile.reserve} USDT 예비액을 별도로 남깁니다.` : `${profile.reserve} USDT 예비액을 남깁니다. 지출 예정액은 운용 종료 후 필요합니다.`} 위험 성향은 {riskLabel}으로 기록했습니다.</p></div>
            </>}
            <p className="micro-note">출금 시점과 거래비용은 아직 검증되지 않았습니다. 위 금액은 예치 권고나 실행 가능 금액이 아닙니다.</p>
          </section>
        </div>
        <div className="page-next"><div><span>다음 단계</span><strong>입력한 조건으로 후보 경로를 비교해 보세요.</strong></div><a href="/plans" onClick={event => navigate(event, '/plans')}>계획 미리보기 ↗</a></div>
        </>}

        {route === '/plans' && <>
        <div className="plan-context"><div><span>현재 시연 조건</span><strong>{planning.result ? `${money(profile.holdings)} USDT 보유 · ${profile.horizonDays}일 운용 · 운용 가능 상한 ${money(investable!)} USDT` : '입력값 확인이 필요합니다'}</strong><p>입력값은 가상이며 지갑 잔고가 아닙니다.</p></div><a href="/needs" onClick={event => navigate(event, '/needs')}>조건 수정 ↗</a></div>
        <section className="plans-section">
          <div className="section-intro compact"><div><p className="overline">02 / PLAN EXPLORER</p><h2>같은 조건, 다른 경로</h2><p>후보 경로를 나란히 보여줍니다. 활성 계약·왕복 비용·출금 조건을 확인하기 전에는 실행 계획으로 확정하지 않습니다.</p></div><span className="section-badge amber">계획 초안 · 거래 불가</span></div>
          <div className="plan-grid">
            <article className="plan-card primary-plan"><div className="plan-card-top"><span className="plan-letter">A</span><span className="status-pill neutral">조건 검증 전</span></div><p className="plan-route">USDT → JustLend</p><h3>USDT 예치 경로</h3><p className="plan-copy">지출 예정액을 남기고, 남은 USDT를 jUSDT 시장에 예치하는 후보입니다.</p><div className="plan-divider" /><div className="plan-metric"><small>예치 검토 상한</small><strong>{investable ? `${money(investable)} USDT` : '—'}</strong></div><div className="plan-metric"><small>기본 수익률 <em>현재 조회값</em></small><strong>{jUsdt ? `${formatRate(jUsdt.supplyRate)}% APY` : '조회 필요'}</strong></div><div className="plan-metric"><small>기간 기본 이자 <em>고정 APY 가정</em></small><strong>{baseYield ? `${money(baseYield, 4)} USDT` : '계산 대기'}</strong></div><div className="plan-warning">인센티브·진입/출구 비용·시장 활성 상태·출금 가능성 미확인. 순수익과 실행 여부는 판단하지 않습니다.</div></article>
            <article className="plan-card"><div className="plan-card-top"><span className="plan-letter light">B</span><span className="status-pill caution">경로 확인 필요</span></div><p className="plan-route">USDT → USDD → JustLend</p><h3>USDD 전환 경로</h3><p className="plan-copy">PSM 전환 후 jUSDD 예치를 검토하는 후보입니다. 독립적인 USDD 경로 확인이 필요합니다.</p><div className="plan-divider" /><div className="plan-metric"><small>전환 검토 상한</small><strong>{investable ? `${money(investable)} USDT` : '—'}</strong></div><div className="plan-metric"><small>jUSDD 기본 수익률 <em>Mainnet 조회값</em></small><strong>{jUsdd ? `${formatRate(jUsdd.supplyRate)}% APY` : '조회 필요'}</strong></div><div className="plan-metric"><small>예상 순수익</small><strong>산출 보류</strong></div><div className="plan-warning">PSM 왕복 견적·가용량·비용·USDD 가격 위험과 출금 조건이 확인되지 않았습니다.</div></article>
            <article className="plan-card baseline-plan"><div className="plan-card-top"><span className="plan-letter plain">—</span><span className="status-pill simple">비교 기준</span></div><p className="plan-route">USDT 보유</p><h3>보유 기준선</h3><p className="plan-copy">예치하지 않고 자산을 보유합니다. 지출 일정과 비용을 비교할 때의 기준입니다.</p><div className="plan-divider" /><div className="plan-metric"><small>보유 금액</small><strong>{planning.result ? `${money(profile.holdings)} USDT` : '—'}</strong></div><div className="plan-metric"><small>예치 기본 이자</small><strong>0 USDT</strong></div><div className="plan-metric"><small>시장·계약 실행</small><strong>없음</strong></div><div className="plan-warning quiet">비용이 기본 이자보다 크다면 거래 보류를 검토할 기준선입니다.</div></article>
          </div>
          <p className="plan-footnote">기본 이자 = 원금 × ((1 + APY)^(기간/365) − 1). 화면의 APY는 조회 시점 값이며 기간 동안 유지된다는 가정입니다. 보상 APR과 수수료는 미확인으로 남깁니다.</p>
        </section>
        <div className="page-next"><div><span>근거 확인</span><strong>시장 데이터의 출처와 조회 시각을 확인하세요.</strong></div><a href="/markets" onClick={event => navigate(event, '/markets')}>시장 데이터 ↗</a></div>
        </>}

        {route === '/markets' && <>
        <section className="surface markets-panel">
          <div className="market-header"><div><p className="overline">03 / LIVE MARKET DATA</p><h2>공식 시장 데이터</h2><p>JustLend V1 Mainnet 시장 조회값입니다. 인센티브 수익률은 포함되지 않습니다.</p></div><div className="market-actions"><label className="search"><span aria-hidden="true">⌕</span><input value={marketQuery} onChange={event => setMarketQuery(event.target.value)} placeholder="자산 검색" aria-label="자산 검색" /></label><button className="refresh-button" onClick={() => void refreshMarkets()} disabled={loading}>{loading ? '조회 중…' : '↻ 다시 조회'}</button></div></div>
          {loading && <div className="market-state" role="status">공식 API에서 시장을 조회하고 있습니다…</div>}
          {marketError && <div className="market-state error" role="alert"><strong>실시간 시장 조회 실패</strong><span>{marketError}</span></div>}
          {snapshot && <><div className="market-meta"><span className="live-indicator"><i /> LIVE · MAINNET</span><span>{visibleMarkets.length} / {snapshot.markets.length}개 시장</span><span>조회 시각 {kst(snapshot.fetchedAt)} KST</span></div><div className="table-scroll"><table><thead><tr><th>시장</th><th>기본 예치 APY</th><th>대출 APY</th><th>시장 현금 · 원자산 단위</th></tr></thead><tbody>{visibleMarkets.map(market => <tr key={market.address}><td><span className="market-symbol">{market.underlyingSymbol.slice(0, 1)}</span><span className="market-name"><strong>{market.underlyingSymbol}</strong><small>{market.symbol}</small></span></td><td className="positive">{formatRate(market.supplyRate)}%</td><td>{formatRate(market.borrowRate)}%</td><td>{money(market.cash)}</td></tr>)}</tbody></table>{visibleMarkets.length === 0 && <p className="empty-market">일치하는 시장이 없습니다.</p>}</div><div className="market-source"><a href={snapshot.source} target="_blank" rel="noreferrer">공식 API 원문 ↗</a><span>원천 갱신 시각: {snapshot.sourceUpdatedAt ?? '제공되지 않음'} · 활성/legacy 여부 미확인</span></div></>}
        </section>
        <div className="page-next"><div><span>데이터 범위</span><strong>Mainnet 시장과 Nile 개발 지갑은 별도 환경입니다.</strong></div><a href="/connections" onClick={event => navigate(event, '/connections')}>연결 상태 ↗</a></div>
        </>}

        {route === '/connections' && <>
        <div className="section-intro"><div><p className="overline">04 / CONNECTION STATUS</p><h2>개발 환경 연결 상태</h2><p>지갑은 주소 조회만 요청합니다. Mainnet 시장 데이터와 Nile 테스트넷은 분리해 표시합니다.</p></div><span className="section-badge">거래 기능 미구현</span></div>
        <section className="connections-grid">
          <div className="surface connection-card"><span className="connection-icon">◇</span><div><p className="overline">DEVELOPMENT WALLET</p><h3>TronLink 주소 연결</h3><p>{wallet.address ? `${wallet.network} · ${wallet.address}` : walletMessage}</p>{wallet.address && <small>{walletMessage}</small>}</div><button onClick={() => void connect()}>{wallet.address ? '다시 확인' : '주소 연결'} ↗</button></div>
          <div className="surface connection-card"><span className="connection-icon nile">▦</span><div><p className="overline">NILE RPC / TEST NETWORK</p><h3>{nile ? `블록 #${nile.block.toLocaleString('ko-KR')}` : nileError ? '연결 확인 필요' : '연결 확인 중'}</h3><p>{nile ? `블록 시각 ${kst(nile.blockTime)} KST` : nileError || 'Nile 테스트넷 최신 블록을 조회하고 있습니다.'}</p></div><span className={`connection-status ${nile ? 'connected' : ''}`}>{nile ? '연결됨' : '확인 중'}</span></div>
        </section>
        <div className="next-steps"><span>다음 구현 단계</span><p>독립 USDD 데이터와 왕복 비용 확인 → 실행 가능한 계획 검증 → 사용자 승인·거래 → 같은 포지션 추적</p></div>
        </>}
        <footer><span>© 2026 GWDC · TRON Challenge B</span><span>시연 입력은 가상 · 시장 데이터는 Mainnet 조회 · Nile은 별도 테스트 환경</span></footer>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
