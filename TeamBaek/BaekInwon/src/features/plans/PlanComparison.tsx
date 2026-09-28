import type { Update } from "../../App";
import type { PersistedState } from "../../lib/storage";
import type { Plan, PlanningResult } from "../../../shared/schemas";
import { ChainBadge, EligibilityBadge, ModeBadge, Money, pct, SourceLine, timeKo } from "../common";
import { daysBetween, riskLabel } from "../../../shared/needs";

export default function PlanComparison({
  state,
  update,
  result,
  goNeeds,
  goNile,
}: {
  state: PersistedState;
  update: Update;
  result?: PlanningResult;
  goNeeds: () => void;
  goNile: () => void;
}) {
  if (!result) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <h2>아직 비교할 계획이 없어요</h2>
        <p className="muted">요구 분석에서 조건을 입력하고 요약을 확인하면 A/B/보유 기준선을 비교합니다.</p>
        <button className="btn primary" onClick={goNeeds}>
          조건 입력하러 가기
        </button>
      </div>
    );
  }
  const stale = result.needs.version !== state.needs.version || state.convState === "collecting" || state.convState === "awaiting_confirmation";
  const asset = result.needs.asset;
  const modes = [...new Set(result.quotes.map((q) => q.source.mode))];
  const rec = result.plans.find((p) => p.id === result.recommendation.planId)!;
  const plans = result.plans;

  return (
    <div className="stack">
      <div className="row">
        <div>
          <div className="eyebrow">Step 2 · Compare</div>
          <h1 className="hero-title" style={{ fontSize: 34 }}>
            지출을 먼저 확보하고, <em>출금까지</em> 비교했어요
          </h1>
          <div className="row" style={{ gap: 8 }}>
            <ChainBadge chain={result.chain} />
            <span className="badge amber">조건부 분석</span>
            {modes.map((m) => (
              <ModeBadge key={m} mode={m} />
            ))}
            <span className="tiny muted">
              입력 v{result.needs.version} · 계산 {timeKo(result.createdAt)} · {result.engineVersion}
            </span>
          </div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={goNeeds}>
          조건 바꾸기
        </button>
      </div>

      {stale && (
        <div className="callout amber small">
          요구사항이 이 분석 이후 바뀌었습니다 (분석 v{result.needs.version} → 현재 v{state.needs.version}). 요구 분석에서 다시 확인하면 새 계획을 계산합니다.
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="callout amber small">
          {result.warnings.map((w) => (
            <div key={w}>⚠ {w}</div>
          ))}
        </div>
      )}

      <div className="formula" style={{ marginTop: 0 }}>
        <div className="small muted">
          {result.needs.startDate} ~ {result.needs.endDate} ({result.plans[0].horizonDays}일) · 위험 성향 {riskLabel(result.needs.riskProfile)} · USDD 위험{" "}
          {result.needs.acceptUsddRisk ? "수용" : "미수용"}
        </div>
        <div className="fcard teal">
          <div>
            <div className="ttl">보유 자산</div>
            <div className="val">
              <Money v={result.needs.amount} dp={0} /> <small>{asset}</small>
            </div>
          </div>
        </div>
        <div className="op">−</div>
        <div className="fcard coral">
          <div>
            <div className="ttl">지출 확보</div>
            <div className="val">
              <Money v={result.reserved.total} dp={0} /> <small>{asset}</small>
            </div>
            <div className="desc">
              기간 안 지출 {result.reserved.expensesInHorizon} + 여유액 {result.reserved.buffer}
              {result.reserved.outsideHorizon.length > 0 && ` · 기간 밖 ${result.reserved.outsideHorizon.map((e) => `${e.date} ${e.amount}`).join(", ")} 제외`}
            </div>
          </div>
        </div>
        <div className="op">=</div>
        <div className="fcard result">
          <div>
            <div className="ttl">운용 가능액</div>
            <div className="val">
              <Money v={result.investable} dp={0} /> <small>{asset}</small>
            </div>
          </div>
        </div>
      </div>

      <div className={`callout ${rec.key === "HOLD" ? "coral" : "teal"}`}>
        <div className="row">
          <strong>추천: {rec.title}</strong>
          {rec.key === "HOLD" && <span className="badge red">거래 보류</span>}
        </div>
        <div className="small" style={{ marginTop: 4 }}>
          {result.recommendation.reason}
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h3>같은 자산·기간으로 비교 ({asset} 기준)</h3>
        <table className="plan-table">
          <thead>
            <tr>
              <th />
              {plans.map((p) => (
                <th key={p.id} className={p.recommended ? "rec" : ""}>
                  {p.title}
                  {p.recommended && <div className="badge teal" style={{ marginTop: 4 }}>추천</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="적격성" plans={plans} cell={(p) => <EligibilityBadge e={p.eligibility} />} />
            <Row label="예치 / 보유" plans={plans} cell={(p) => `${p.allocation.invested} / ${p.allocation.held}`} />
            <Row label="기본 금리" plans={plans} cell={(p) => (p.baseRate ? `${pct(p.baseRate, 4)} ${p.rateType}` : "-")} />
            <Row label="기본 수익" plans={plans} cell={(p) => <Money v={p.baseYield} dp={4} />} />
            <Row label="추가 보상" plans={plans} cell={(p) => (p.rewards.status === "unverified" ? <span className="badge amber">미확인 (제외)</span> : p.rewards.status === "none" ? "없음" : p.rewards.amount)} />
            <Row label="왕복 거래비용" plans={plans} cell={(p) => (p.costs.energy ? <span>{Number(p.costs.trx).toFixed(2)} TRX<br /><span className="tiny muted">≈ <Money v={p.costs.inAsset} dp={4} /> · {p.costs.energy.toLocaleString()} Energy</span></span> : "0")} />
            <Row label="전환 수수료" plans={plans} cell={(p) => <Money v={p.costs.conversionFees} dp={4} />} />
            <Row label="예상 순수익" plans={plans} cell={(p) => <strong><Money v={p.netReturn} dp={4} signed /></strong>} />
            <Row label="손익분기 기간" plans={plans} cell={(p) => (p.key === "HOLD" ? "-" : p.breakEvenDays ? `${Math.ceil(Number(p.breakEvenDays)).toLocaleString()}일` : "산정 불가")} />
          </tbody>
        </table>
        <p className="tiny muted">
          순수익 = 기본 수익 + 검증된 보상 − 진입·보유·출구 비용. 조회 시점 금리가 기간 내내 유지된다는 가정이며 수익을 보장하지 않습니다.
        </p>
      </div>

      {result.naiveComparison && (
        <div className="callout gray">
          <strong>비교: 최고 APY만 보고 골랐다면</strong>
          <div className="small">
            {result.naiveComparison.title} → 예상 순수익 <Money v={result.naiveComparison.netReturn} dp={4} signed /> {asset}. {result.naiveComparison.description}
          </div>
        </div>
      )}

      <div className="card">
        <div className="row">
          <h3>AI 설명</h3>
          <div className="spacer" />
          <span className={`badge ${result.explanation.source === "llm" ? "teal" : "gray"}`}>
            {result.explanation.source === "llm" ? `${result.explanation.provider} · ${result.explanation.model}` : `템플릿 대체${result.explanation.fallbackReason ? ` (${result.explanation.fallbackReason})` : ""}`}
          </span>
        </div>
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{result.explanation.text}</p>
        <p className="tiny muted">설명은 코드가 계산한 결과만 근거로 생성합니다. 금액·계약 카드는 코드가 렌더링합니다.</p>
      </div>

      <div className="plan-cards">
        {plans.map((p) => (
          <PlanCard key={p.id} p={p} asset={asset} selected={state.selectedPlanId === p.id} onSelect={() => update((s) => ({ ...s, selectedPlanId: p.id }))} disabled={stale} />
        ))}
      </div>

      <div className="callout coral small">
        Mainnet 계획은 <strong>조회 전용 조건부 분석</strong>입니다. 이 앱은 Mainnet 거래를 실행하지 않으며, Nile 테스트넷 실행은 별도의 요구사항과 계획으로 진행합니다 (Mainnet 예상 APY를 Nile 결과와 합산하지 않음).{" "}
        <button className="btn small" onClick={goNile}>
          Nile 실행 탭으로
        </button>
      </div>

      <div className="card">
        <h3>데이터 출처</h3>
        <div className="stack" style={{ gap: 10 }}>
          {result.quotes.map((q) => (
            <div key={q.id}>
              <div className="small bold">
                {q.market} <code>{q.address}</code> {!q.active && <span className="badge red">비활성: {q.inactiveReason}</span>}
              </div>
              {q.psm && (
                <div className="tiny muted">
                  수수료 in {pct(q.psm.feeIn)} / out {pct(q.psm.feeOut)} · 진입 여유 {q.psm.entryCapacity ? Number(q.psm.entryCapacity).toLocaleString() : "미확인"} USDD · 출구 물량{" "}
                  {q.psm.exitLiquidity ? Number(q.psm.exitLiquidity).toLocaleString() : "미확인"} USDT
                </div>
              )}
              {q.liquidity && <div className="tiny muted">인출 가능 유동성 {Number(q.liquidity).toLocaleString()} {q.token}</div>}
              <SourceLine s={q.source} />
            </div>
          ))}
          {result.costBasis && (
            <div>
              <div className="small bold">
                거래비용 근거: Energy {result.costBasis.energyFeeSun} sun · Bandwidth {result.costBasis.bandwidthFeeSun} sun
                {result.costBasis.trxPerUsdt && ` · 1 USDT = ${Number(result.costBasis.trxPerUsdt).toFixed(4)} TRX`}
                {result.costBasis.psmEnergy && ` · PSM Energy sell ${result.costBasis.psmEnergy.sell.toLocaleString()} / buy ${result.costBasis.psmEnergy.buy.toLocaleString()}`}
              </div>
              <SourceLine s={result.costBasis.source} />
              {result.costBasis.priceSource && <SourceLine s={result.costBasis.priceSource} />}
            </div>
          )}
        </div>
      </div>
      <p className="tiny muted">운용 기간 {daysBetween(result.needs.startDate, result.needs.endDate!)}일 · 날짜는 Asia/Seoul 기준</p>
    </div>
  );
}

function Row({ label, plans, cell }: { label: string; plans: Plan[]; cell: (p: Plan) => React.ReactNode }) {
  return (
    <tr>
      <td>{label}</td>
      {plans.map((p) => (
        <td key={p.id} className={p.recommended ? "rec" : ""}>
          {cell(p)}
        </td>
      ))}
    </tr>
  );
}

function PlanCard({ p, asset, selected, onSelect, disabled }: { p: Plan; asset: string; selected: boolean; onSelect: () => void; disabled: boolean }) {
  return (
    <div className={`card plan-card ${p.recommended ? "rec" : ""} ${p.eligibility === "ineligible" ? "ineligible" : ""}`}>
      <div className="row" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{p.title}</h3>
        <div className="spacer" />
        <EligibilityBadge e={p.eligibility} />
      </div>
      <div className="small" style={{ margin: "8px 0" }}>
        예상 순수익 <strong><Money v={p.netReturn} asset={asset} dp={4} signed /></strong>
      </div>
      {p.reasons.length > 0 && (
        <div className={`callout ${p.eligibility === "ineligible" ? "red" : "amber"} tiny`}>
          {p.reasons.map((r) => (
            <div key={r}>• {r}</div>
          ))}
        </div>
      )}
      <details>
        <summary>거래 단계 ({p.steps.length})</summary>
        {p.steps.map((s, i) => (
          <div className="step" key={i}>
            <span className="n">{i + 1}</span>
            <div>
              {s.label} · {s.amount} {s.asset}
              {s.energy > 0 && (
                <div className="tiny muted">
                  {s.energy.toLocaleString()} Energy · {s.bandwidth} bytes · {s.energySource}
                </div>
              )}
            </div>
          </div>
        ))}
      </details>
      <details>
        <summary>위험</summary>
        <ul className="clean small">
          {p.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
      {p.stress && (
        <details>
          <summary>스트레스 결과</summary>
          <ul className="clean small">
            {p.stress.map((s) => (
              <li key={s.label}>
                {s.label}: <Money v={s.netReturn} asset={asset} dp={2} signed />
              </li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary>가정</summary>
        <ul className="clean small">
          {p.assumptions.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
      <button className={`btn small ${selected ? "teal" : ""}`} style={{ marginTop: 8 }} disabled={disabled || p.eligibility === "ineligible"} onClick={onSelect}>
        {selected ? "선택됨 (분석 기록용)" : "이 계획 선택"}
      </button>
    </div>
  );
}
