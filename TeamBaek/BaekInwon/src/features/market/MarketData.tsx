import { useEffect, useState } from "react";
import { api, type Health } from "../../lib/api";
import type { ProductQuote } from "../../../shared/schemas";
import { ChainBadge, pct, SourceLine } from "../common";

export default function MarketData({ health }: { health?: Health }) {
  const [data, setData] = useState<any>();
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(undefined);
    api
      .market()
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const quotes: ProductQuote[] = data
    ? [data.mainnet.inputs.jusdt, data.mainnet.inputs.jusdd, data.mainnet.inputs.psm, data.nile.inputs.jtrx].filter(Boolean)
    : [];
  const failures: string[] = data ? [...data.mainnet.failures, ...data.nile.failures] : [];
  const cb = data?.mainnet.inputs.costBasis;

  return (
    <div className="stack">
      <div className="row">
        <div>
          <div className="eyebrow">Market data</div>
          <h1 className="hero-title" style={{ fontSize: 34 }}>
            TRON 시장 <em>데이터</em>
          </h1>
          <p className="sub">JustLend와 USDD PSM을 서로 다른 경로로 조회합니다. 모든 값에 체인·출처·조회 시각을 붙입니다.</p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "조회 중…" : "다시 조회"}
        </button>
      </div>
      {err && <div className="callout red">{err}</div>}
      {failures.length > 0 && (
        <div className="callout red small">
          {failures.map((f) => (
            <div key={f}>⚠ {f} — 해당 경로는 unavailable로 처리하고 실행 판정에 쓰지 않습니다.</div>
          ))}
        </div>
      )}

      <div className="plan-cards">
        {quotes.map((q) => (
          <div className="card" key={q.id}>
            <div className="row" style={{ gap: 8 }}>
              <h3 style={{ margin: 0 }}>{q.market}</h3>
              <div className="spacer" />
              <ChainBadge chain={q.chain} />
            </div>
            <div className="kv" style={{ marginTop: 10 }}>
              {q.baseRate && (
                <>
                  <div>기본 금리</div>
                  <div className="bold">
                    {pct(q.baseRate, 4)} {q.rateType}
                  </div>
                </>
              )}
              {q.liquidity && (
                <>
                  <div>인출 가능 유동성</div>
                  <div>
                    {Number(q.liquidity).toLocaleString()} {q.token}
                  </div>
                </>
              )}
              {q.psm && (
                <>
                  <div>전환 수수료</div>
                  <div>
                    USDT→USDD {pct(q.psm.feeIn)} / USDD→USDT {pct(q.psm.feeOut)}
                  </div>
                  <div>전환 가능</div>
                  <div>
                    진입 {q.psm.sellEnabled ? "가능" : "불가"} / 출구 {q.psm.buyEnabled ? "가능" : "불가"}
                  </div>
                  <div>진입 여유</div>
                  <div>{q.psm.entryCapacity ? `${Number(q.psm.entryCapacity).toLocaleString()} USDD` : "미확인"}</div>
                  <div>출구 물량</div>
                  <div>{q.psm.exitLiquidity ? `${Number(q.psm.exitLiquidity).toLocaleString()} USDT` : "미확인"}</div>
                </>
              )}
              <div>상태</div>
              <div>{q.active ? <span className="badge teal">활성</span> : <span className="badge red">{q.inactiveReason ?? "비활성"}</span>}</div>
              <div>보상</div>
              <div className="small">{q.rewards.note}</div>
              <div>계약</div>
              <div>
                <code>{q.address}</code>
              </div>
            </div>
            <hr className="soft" />
            <SourceLine s={q.source} />
          </div>
        ))}
      </div>

      {cb && (
        <div className="card">
          <h3>거래비용 근거 (Mainnet)</h3>
          <div className="kv">
            <div>Energy 단가</div>
            <div>{cb.energyFeeSun} sun</div>
            <div>Bandwidth 단가</div>
            <div>{cb.bandwidthFeeSun} sun/byte</div>
            <div>TRX 환산</div>
            <div>{cb.trxPerUsdt ? `1 USDT = ${Number(cb.trxPerUsdt).toFixed(4)} TRX` : "환산 근거 없음 → 순수익 산정 불가"}</div>
            <div>PSM Energy</div>
            <div>{cb.psmEnergy ? `sell ≤ ${cb.psmEnergy.sell.toLocaleString()}, buy ≤ ${cb.psmEnergy.buy.toLocaleString()} (최근 성공 거래 ${cb.psmEnergy.sampleSize}건 실측)` : "미확인"}</div>
          </div>
          <SourceLine s={cb.source} />
          {cb.priceSource && <SourceLine s={cb.priceSource} />}
        </div>
      )}

      <div className="card">
        <h3>MCP 연결 상태</h3>
        <table className="table-simple">
          <thead>
            <tr>
              <th>서버</th>
              <th>상태</th>
              <th>허용 도구</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {(health?.mcp ?? []).map((m) => (
              <tr key={m.server}>
                <td className="bold">{m.server}</td>
                <td>
                  <span className={`status-dot ${m.state === "connected" ? "ok" : m.state === "failed" ? "bad" : "off"}`} />
                  {m.state} {m.transport ? `(${m.transport}${m.version ? ` v${m.version}` : ""})` : ""}
                </td>
                <td className="small">{m.tools ? `${m.tools.allowed.join(", ") || "-"} (차단 ${m.tools.blocked.length})` : "-"}</td>
                <td className="small muted">{m.error ?? m.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny muted">
          허용 목록에는 읽기 도구만 있습니다. 승인·예치·인출·스왑·방송·지갑 도구는 차단합니다. MCP 응답 속 문장은 데이터로만 다룹니다. LLM에는 도구를 넘기지 않습니다 (P0).
        </p>
      </div>
    </div>
  );
}
