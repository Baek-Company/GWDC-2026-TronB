# GWDC 4인 역할 분담

작성 기준: 2026-09-29. 구현 순서와 세부 규칙은 [IMPLEMENTATION_WORKFLOW.md](./IMPLEMENTATION_WORKFLOW.md), 제품 요구사항은 [PROJECT_PLAN.md](./PROJECT_PLAN.md)를 따른다. 이 문서는 **역할별 구현 범위, 기술 스택, MCP, 발급받을 키**만 정리한다.

## 0. 공통 사항 (전원)

### 공통 기술 스택

| 영역 | 기술 |
| --- | --- |
| 언어 | TypeScript (Node v24, npm으로 통일) |
| 화면 | React + Vite |
| 로컬 API | Node.js + Express, loopback 바인딩 |
| 검증 | Zod |
| 금액 계산 | decimal.js (금액은 문자열로 전달, 온체인 최소 단위는 BigInt) |
| 저장 | 브라우저 localStorage + JSON 내보내기 |
| 명령 | `npm run dev` / `typecheck` / `test` / `build` / `doctor` |

### 공통 계약 (단계 0에서 먼저 고정, 스키마 변경은 ①이 취합)

- `shared/schemas.ts`: `UserNeeds`, `ProductQuote`, `Plan`, `ActionPreview`, `ExecutionRecord`, `Observation`
- 모든 외부 값에 붙일 메타데이터: `sourceUrl`, `chain`, `fetchedAt`, `sourceUpdatedAt?`, `mode: live | snapshot | synthetic`
- `fixtures/`: 고정 시연 입력과 synthetic quote. 네 명 모두 이걸로 입출력을 맞춘다.

### 전원이 지킬 규칙

- API 키는 `.env.local`에만 둔다. `VITE_` 접두사 변수에 비밀 값을 넣지 않는다.
- 개인키와 복구 구문은 어디에도 저장하지 않는다.
- Mainnet 분석 결과와 Nile 실거래 결과를 섞지 않는다.

### 공통 키

- **TronGrid API Key** ([trongrid.io](https://www.trongrid.io/)): 무료이므로 각자 발급해 개인 `.env.local`에 넣는다.

---

## ① 화면 · AI · 통합

### 구현할 것

- `src/App.tsx`: 한 페이지 골격 (대화/요약, 계획 비교, Nile 실행, 검토 영역)
- `src/features/conversation`
  - 입력 폼, 추가 질문, 요약 확인
  - 대화 상태 전이: `collecting → awaiting_confirmation → confirmed → comparing`
  - 확인한 뒤 입력을 수정하면 기존 확인과 선택을 무효화
- `src/features/plans`: A/B/보유 기준선 비교 카드. 수치는 코드가 렌더링하고, 데이터 모드와 체인 배지를 표시
- `server/index.ts`: Express 엔트리, `/api/health`, `/api/chat`, `/api/plans` 연결, 입력 검증과 오류 응답
- `server/llm/`
  - `provider.ts`: 공통 계약 `extractNeeds(messages, currentNeeds)`, `explainPlans(verifiedPlans)`
  - `nim.ts`: 비스트리밍, 30초 타임아웃, JSON 오류 시 1회 보정, 429 제한 재시도
  - `template.ts`: 키가 없거나 LLM 장애일 때 쓰는 질문·설명 템플릿
  - `tron.ts`: TRON LLM 명세를 받은 뒤 추가
- 공통 스키마 조정과 최종 통합, README 작성

### MCP

없음. MCP 호출은 ②의 데이터 어댑터를 통해서만 한다.

### 발급받을 키

- **NVIDIA NIM API Key** ([build.nvidia.com](https://build.nvidia.com/)): `NIM_API_KEY`
- NIM 모델 ID: 한국어 구조화 추출로 테스트한 뒤 `NIM_MODEL`에 고정
- (대기) TRON LLM API: `TRON_LLM_BASE_URL`, `TRON_LLM_API_KEY`, `TRON_LLM_MODEL`

### 먼저 넘겨줄 것

공통 스키마 초안, 화면 골격, NIM 추출 결과 예시

### 완료 기준

- 키가 없어도 입력 → 확인 → 비교 → 저장이 동작한다.
- NIM을 실제로 한 번 이상 호출해 확인한다.
- 잘못된 키, 타임아웃, JSON 오류가 나도 흐름이 유지된다.
- 브라우저 번들과 네트워크 응답에 키가 없다.

---

## ② MCP · 상품 데이터

### 구현할 것

- `server/mcp/clients.ts`
  - MCP 연결과 종료 (stdio / Streamable HTTP)
  - 시작할 때 `tools/list`로 도구 스키마 확인
  - 제한시간, 제한된 재시도, `isError` 처리
- `server/mcp/registry.ts`
  - 서버별 **읽기 도구 허용 목록**
  - approve, supply, withdraw, swap, 방송, 지갑 생성 도구는 차단
- `server/data/justlend.ts`
  - jUSDT/jUSDD의 기본 공급 금리, 시장 현금, 환율, 활성 상태
  - 보상은 기본 금리와 분리하고, 확인되지 않은 보상은 `미확인`
- `server/data/usdd.ts`: PSM 상태, 수수료, 양방향 가용량, 활성 상태
- `server/data/tron-rpc.ts`: MCP로 안 되는 것만 직접 RPC로 보완
- `ProductQuote` 정규화
  - `accessMethod: mcp | direct`, `serverId`, `toolName`, 서버 버전 기록
  - 조회에 실패하면 `unavailable`과 원인 반환
  - 과거 스냅샷은 실행 판정에 쓰지 않음
- `fixtures/`: 출처가 붙은 snapshot quote

### MCP

| 우선순위 | MCP | 사용할 도구 | 연결 방식 |
| --- | --- | --- | --- |
| P0 | **JustLend full MCP** | `get_all_markets`, `get_market_data`, `get_account_summary`, `check_allowance`, `estimate_lending_energy`, `get_mining_rewards`, `get_usdd_mining_config` | 공식 저장소를 버전 고정해 로컬 stdio로 실행 |
| P0 | **USDD MCP** | `get_protocol_overview`, `get_psm_status`, `get_psm_metrics` (`market: "PSM-USDT"`, `network: "tron"`) | 로컬 stdio. **시작할 때 지갑 자동 초기화 여부를 먼저 확인** |
| P1 | TronGrid MCP | JustLend와 겹치지 않는 체인·거래 조회 | `https://mcp.trongrid.io/mcp` (Streamable HTTP) |

### 발급받을 키

- TronGrid API Key: TronGrid MCP의 `TRON-PRO-API-KEY` 헤더와 JustLend MCP에 사용
- MCP 설정에 **개인키나 니모닉을 넣지 않는다.**

### 먼저 넘겨줄 것

MCP 연결 결과(성공/실패/미확인), 허용 목록, A/B 정규화 quote, 실패 사유

### 완료 기준

- 초기화, 도구 발견, 실제 읽기 호출을 확인한다.
- 응답의 체인, 단위, 기본/보상 금리 구분을 검증한다.
- 허용 목록 밖의 도구는 거부된다.
- MCP별 초기 진단은 30~60분으로 제한하고, 막히면 직접 조회로 대체한 뒤 그 사유를 기록한다.

---

## ③ 계산 · 기록

### 구현할 것

- `shared/units.ts`: 토큰 정밀도, 최소 단위 ↔ 표시 금액 변환
- `shared/planning.ts`
  - 지출 재원과 여유액을 먼저 확보 (지출 재원은 처음부터 예치하지 않음)
  - 이자 계산: APY는 `원금 × ((1+APY)^(일수/365) − 1)`, APR은 따로 계산
  - `순수익 = 기본 수익 + 검증된 보상 − 진입·보유·출구 비용`
  - 비용: 승인, 전환, 예치, 인출, 재전환, 청구의 Energy/Bandwidth와 TRX 환산 근거. 근거가 없으면 `산정 불가`
  - 손익분기 기간
  - USDD 가치 변동은 별도 스트레스 결과로 표시
- `shared/eligibility.ts`: 경로 실행 조건 판정
  - PSM 물량 부족, 비활성 시장, 체인 불일치, 오래된 데이터, 지출 초과, 음수 순익
  - USDD 위험을 받아들이지 않으면 B 제외
- Nile 계획 계산: `예치액 ≤ 총잔고 − 지출 재원 − 여유액 − 거래비용 예산`. 100 TRX 기준 80/20과 50/50 비교
- `src/lib/storage.ts`
  - `schemaVersion`을 붙여 저장, 새로고침 복원, JSON 내보내기, 초기화
  - 원계획은 덮어쓰지 않고 새 버전으로 추가
- `src/features/review`
  - 원계획, txID, 확정 여부, 실제 비용, 관측값 표시
  - 예상 vs 실제 비교는 같은 자산·체인·기간일 때만
- `tests/`: 계산, 검증, 상태 전이 단위 테스트

### MCP

없음. ②가 넘겨주는 `ProductQuote`만 입력으로 받는다.

### 발급받을 키

없음. synthetic fixture로 개발할 수 있다.

### 먼저 넘겨줄 것

가상 quote 기준 `Plan`, 계산 테스트, 저장 포맷

### 완료 기준

- 같은 입력과 스냅샷이면 같은 결과가 나온다. LLM 공급자를 바꿔도 동일하다.
- 지출일을 7일 뒤에서 45일 뒤로 옮기면 투자 가능액이 800에서 1,000 USDT로 바뀐다.
- 새로고침해도 원계획과 txID가 복원되고, 중복 거래가 생기지 않는다.

---

## ④ 지갑 · Nile 거래

### 구현할 것

- `src/features/execution`
  - TronLink 연결, 계정과 체인(Nile) 확인, TRX 잔고 조회
  - jTRX 계약 검증: 공식 배포 자료와 온체인 코드·상태로 확인
  - `ActionPreview`: 지갑, 체인, 자산, 최소 단위 금액, 계약·메서드, 승인 범위, 비용 상한, 위험, 유효 시각
  - 서명 직전 재확인: 값이 바뀌면 미리보기를 무효화하고 다시 확인받음
  - 거래 상태 전이: `preview → awaiting_signature → submitted → pending → confirmed | failed`, 추가로 `rejected`, `unknown`
- txID를 받는 즉시 저장한다. 확정 영수증과 계약 실행 결과까지 확인해야 성공으로 표시한다.
- 새로고침 후 미확정 txID를 재조회한다. **자동으로 다시 서명시키지 않는다.**
- 확정 후 jTRX 잔고와 환율을 재조회해 `Observation`으로 기록한다.
- 인출도 같은 흐름으로 구현한다 (P1).
- 서버 쪽: `POST /api/observe`, `GET /api/transactions/:txId?chain=nile`

### MCP

P0는 **없음**. 서명은 브라우저 TronLink DApp으로 한다.

- Nile 조회는 TronWeb과 Nile RPC(`https://nile.trongrid.io`)로 직접 한다.
- TronLink MCP는 쓰지 않는다 (선택 사항).

### 추가 기술 스택

TronWeb, TronLink 확장

### 발급받을 것

- TronGrid API Key
- **TronLink 개발 전용 지갑 + Nile 테스트 TRX** ([Nile Faucet](https://nileex.io/join/getJoinPage)). 복구 구문은 본인만 보관한다.

### 먼저 넘겨줄 것

Nile jTRX 가용성 결과(가장 먼저), `ActionPreview`, 실제 `ExecutionRecord`

### 완료 기준

- P0: 선택한 Nile 계획으로 예치해서 txID, 확정 결과, 실제 비용, 같은 포지션 재조회까지 확인한다.
- 지갑 거부, 네트워크 변경, 잔고 부족, 미확정 상태를 서로 구분한다.
- P1: 인출도 같은 기준으로 확인한다.

---

## 역할별 요약

| 역할 | 키 / 계정 | MCP | 추가 스택 |
| --- | --- | --- | --- |
| ① 화면·AI·통합 | **NIM API Key**, TronGrid, (대기) TRON LLM | — | fetch 기반 LLM 어댑터 |
| ② MCP·데이터 | TronGrid | **JustLend MCP, USDD MCP**, (P1) TronGrid MCP | MCP 클라이언트 SDK |
| ③ 계산·기록 | — | — | decimal.js 집중 사용 |
| ④ 지갑·거래 | TronGrid, **TronLink 지갑 + Nile TRX** | — (직접 RPC) | TronWeb, TronLink |

## 통합 지점

- **① ↔ ②, ③**: `/api/plans` = ②가 quote 조회 → ③이 계산 → ①이 설명 생성. 서버는 브라우저가 보낸 Plan을 믿지 않고, 자기가 조회한 quote로 다시 계산한다.
- **③ ↔ ④**: 같은 Nile Plan ID로 `Plan → ActionPreview → ExecutionRecord → Observation`을 연결한다. **첫 통합 증거는 이 연결**로 만든다.
- **병렬 진행**: Nile 거래는 NIM이나 Mainnet 데이터가 끝나기를 기다리지 않는다.
