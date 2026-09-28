# GWDC 2026 Challenge B — 한눈에 보기

> 작업하면서 옆에 띄워 두는 요약판이다. 세부 규칙은 원문 문서를 따른다.
>
> | 문서 | 볼 때 |
> | --- | --- |
> | [PROJECT_PLAN.md](./PROJECT_PLAN.md) | **무엇을 왜** 만드는가: 요구사항, 계획 알고리즘, 위험과 대안 |
> | [IMPLEMENTATION_WORKFLOW.md](./IMPLEMENTATION_WORKFLOW.md) | **어떤 순서로 어떻게** 만드는가: 구조, MCP, LLM, 단계별 완료 기준 |
> | [ROLES.md](./ROLES.md) | **누가** 무엇을 만드는가: 역할별 파일, 스택, MCP, 키 |

- **제출 기한: 2026-09-30 12:00 KST** (10:00 제출 고정, 이후 2시간은 장애 대응)
- **인원: 4명**
- **상태: 구현 전.** 문서의 기능을 구현 완료로 해석하지 않는다.

---

## 1. 무엇을 만드는가

사용자의 **지출 일정과 위험 성향**을 대화로 확인하고, **지출일에 쓸 돈을 먼저 확보한 뒤** 남은 돈을 TRON의 두 경로에 넣었을 때의 **출금까지 포함한 순수익**을 비교한다. 이후 사용자가 승인한 거래를 실행하고, 예상과 실제 결과를 추적한다.

### 두 흐름 (서로 연결하지 않음)

```text
[Mainnet 분석]  요구사항 확인 → A/B/보유 비교 → 지출일 변경 시 재계산
                (실데이터 조회, 거래 없음, "조건부 분석"으로 표시)

[Nile 실행]     별도 요구사항 확인 → Nile 계획 2개 비교·선택
                → 미리보기 → 사용자 확인 → TronLink 서명 → 확정 → 같은 포지션 재조회
```

**Mainnet 계획을 선택한 뒤 Nile 거래로 이어지는 흐름은 만들지 않는다.** Mainnet 예상 APY를 Nile 실제 수익과 합치지 않는다.

### 계획

| 체인 | 계획 | 내용 |
| --- | --- | --- |
| Mainnet | A. USDT 예치 | 지출 재원은 보유 + 나머지를 JustLend jUSDT에 예치 |
| Mainnet | B. USDD 경로 | 지출 재원은 보유 + 나머지를 USDD PSM에서 전환 → JustLend jUSDD에 예치. 출구는 역순 |
| Mainnet | 기준선 | 전액 보유 |
| Nile | 실행 계획 2개 | 100 테스트 TRX 기준 `80 예치 + 20 보유` vs `50 예치 + 50 보유` (jTRX) |

- PSM은 **전환 경로일 뿐 수익원이 아니다.** B의 이자는 jUSDD에서만 나온다.
- B의 계약, 물량, 왕복 비용이 확인되지 않으면 B는 `현재 실행 불가`로 표시한다.

### 고정 시연 사례

- **1,000 USDT, 30일, 7일 뒤 200 USDT 지출, 추가 여유액 0**
- 지출일을 45일 뒤로 옮기면 운용 기간 밖이 되므로 투자 가능액이 800에서 1,000 USDT로 바뀌어야 한다.
- USDD 가격 위험을 받아들이지 않으면 B를 추천에서 제외한다.

> ⚠️ **합의 필요:** 위험 성향이 PROJECT_PLAN §3에는 "보수적", WORKFLOW §3에는 "균형형"으로 되어 있다. 하나로 정한 뒤 두 문서와 `fixtures/`를 맞춘다.

---

## 2. 시간표와 담당

| KST 완료 시각 | 작업 (PROJECT_PLAN §7) | WORKFLOW 단계 | 주 담당 |
| --- | --- | --- | --- |
| **9/29 02:00** | 제출 형식 확인, 지갑·Nile TRX, jTRX 상태, Mainnet jUSDT/jUSDD·PSM 검증, 공통 타입 합의 | 단계 0 | 전원 (④ Nile, ② MCP) |
| **9/29 12:00** | AI API 키 사용 여부 확정, 네 영역 연결 가능 상태 | 단계 1·2·3 진행 | ① 키, 전원 |
| **9/29 13:00** | 담당별 첫 버전 완료, 단위 테스트 | 단계 1~4 | 전원 |
| **9/29 20:00** | 요구 분석 → 두 계획 비교 → 거래 전 확인 화면 통합 | 통합 | ① |
| **9/30 02:00** | Nile 소액 예치(·인출), txID 확정, 결과 저장, 예상·실제 비교 화면 | 단계 4·5 | ③·④ |
| **9/30 08:00** | 시연 대본, 영상, README, 한계 작성, 전체 테스트·빌드 | 단계 6 | ①, 전원 |
| **9/30 10:00** | 제출물 고정·제출 | — | ① |

단계 0 이후에는 **①, ②, ③, ④가 병렬로 진행**한다. Nile 거래는 NIM이나 Mainnet 데이터 완성을 기다리지 않는다.

---

## 3. 역할 요약

| 역할 | 핵심 구현 | 키 / 계정 | MCP |
| --- | --- | --- | --- |
| **① 화면·AI·통합** | 대화·요약·비교 화면, `server/index.ts`, `server/llm/*`(NIM, 템플릿), 스키마 취합, README | **NIM API Key**, TronGrid, (대기) TRON LLM | — |
| **② MCP·데이터** | `server/mcp/*`(연결, 허용 목록), `server/data/*`(JustLend, USDD, RPC 보완), quote 정규화 | TronGrid | **JustLend, USDD**, (P1) TronGrid MCP |
| **③ 계산·기록** | `shared/planning·eligibility·units`, `storage.ts`, 검토 화면, 테스트 | — | — |
| **④ 지갑·거래** | TronLink 연결, jTRX 검증, 미리보기, 서명, 확정, 재조회, `/api/observe`, `/api/transactions` | TronGrid, **TronLink + Nile TRX** | — (직접 RPC) |

세부 내용은 [ROLES.md](./ROLES.md)에 있다.

### 통합 지점

- `/api/plans` = ② quote 조회 → ③ 계산 → ① 설명. 서버는 브라우저가 보낸 Plan을 믿지 않고 자기가 조회한 quote로 다시 계산한다.
- ③ ↔ ④: 같은 **Nile Plan ID**로 `Plan → ActionPreview → ExecutionRecord → Observation`을 연결한다. **첫 통합 증거가 이 연결이다.**

---

## 4. 공통 계약

### 스택

TypeScript · React + Vite · Node.js + Express(loopback) · Zod · decimal.js · TronWeb · TronLink · localStorage

### 타입 (`shared/schemas.ts`)

| 타입 | 핵심 필드 |
| --- | --- |
| `UserNeeds` | 체인·자산, 문자열 금액, 시작/종료일, `expenses[]`(날짜·금액·자산), 여유액, 위험 성향, USDD 위험 수용 여부, 시간대, 확인된 입력 버전 |
| `ProductQuote` | 시장·토큰·체인, 기본 금리와 APR/APY 구분, 정밀도, 유동성, 전환 조건, 별도 보상, 출처 메타데이터 |
| `Plan` | 입력 버전, 배분, 경로 단계, 원금·기본 수익·보상·비용·순수익, 가정, 적격성과 제외 사유, 사용한 quote 스냅샷 |
| `ActionPreview` | 지갑, 체인, 자산, 최소 단위 금액, 계약·메서드, 승인 범위, 예상 비용·상한, 위험, 유효 시각 |
| `ExecutionRecord` | Plan ID·미리보기 ID, 체인·지갑, 원 txID, 상태, 제출/확정 시각, 영수증·실제 비용, 오류 |
| `Observation` | 포지션·원계획 ID, 관측 시각, 자산별 잔고·가치, 평가 기준, 출처, 데이터 모드 |

모든 외부 값에 `sourceUrl`, `chain`, `fetchedAt`, `sourceUpdatedAt?`, `mode: live | snapshot | synthetic`을 붙인다.

### 상태 전이

```text
대화: collecting → awaiting_confirmation → confirmed → comparing
      (확인 후 입력이 바뀌면 확인과 계획 선택을 무효화)

거래: preview → awaiting_signature → submitted → pending → confirmed | failed
      + rejected (서명 거부), unknown (방송 여부 불명)
      (pending / unknown에서는 원 txID를 조회하고 자동으로 다시 서명시키지 않음)
```

### 로컬 API

| 경로 | 담당 | 역할 |
| --- | --- | --- |
| `GET /api/health` | ① | 프로세스 상태, 비밀이 아닌 설정 여부 |
| `POST /api/chat` | ① | 자연어 추출 → 검증된 입력 패치·누락 항목 |
| `POST /api/plans` | ①②③ | 데이터 조회 → 계산 → 설명 (설명 실패 시 템플릿) |
| `POST /api/observe` | ④ | 현재 포지션 조회 |
| `GET /api/transactions/:txId?chain=nile` | ④ | 영수증·확정 상태 조회 |

---

## 5. 절대 규칙

**LLM과 계산**
- LLM은 **입력 추출과 설명만** 맡는다. 금액 계산, 적격성 판단, 거래 생성은 코드가 한다.
- 모델이 만든 금리, 비용, 계약 주소는 계획에 반영하지 않는다.
- P0에서는 모델이 조회 도구를 고르지 않고, 앱이 정해진 순서로 MCP를 호출한다.

**금액과 수익**
- 금액은 문자열 + Decimal/BigInt로 다룬다.
- `순수익 = 기본 수익 + 검증된 보상 − 진입·보유·출구 비용`
- 확인되지 않은 보상은 `미확인`, 비용이나 TRX 환산 근거가 없으면 `산정 불가`, 음수 순익이면 그대로 보여주고 보유를 권고한다.

**데이터**
- 과거 스냅샷을 현재 값처럼 표시하지 않는다.
- 재생이나 가상 데이터 구간에는 `시뮬레이션` 배지를 붙인다.

**거래**
- 방송 응답만으로 성공 처리하지 않는다. 원 txID로 확정 영수증을 확인해야 성공이다.
- 서명 직전에 체인, 계정, 금액, 계약, 비용을 다시 읽는다.

**MCP 보안**
- MCP 허용 목록은 **읽기 도구만** 포함한다.
- MCP 응답에 들어 있는 문장을 지시로 실행하지 않는다.
- MCP 설정에 개인키를 넣지 않는다.

**비밀 정보**
- 키는 `.env.local`에만 둔다.
- 소스, 번들, 로그, 내보낸 JSON에 키가 없어야 한다.

---

## 6. 환경 설정 체크리스트

### 발급·준비

- [ ] **NIM API Key + 모델 ID** (①): [build.nvidia.com](https://build.nvidia.com/)
- [ ] **TronGrid API Key** (전원): [trongrid.io](https://www.trongrid.io/)
- [ ] **TronLink 개발 지갑 + Nile 테스트 TRX** (④): [Nile Faucet](https://nileex.io/join/getJoinPage)
- [ ] **JustLend MCP, USDD MCP** 공식 저장소를 버전 고정해 받기 (②). USDD MCP는 지갑 자동 초기화 여부 확인
- [ ] (대기) **TRON LLM API** 명세와 키 (①)
- [ ] 저장소 위치 확정. OneDrive 밖 경로 권장 (예: `C:\dev\gwdc`)

### `.env.local`

```dotenv
LLM_PROVIDER=nim
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_API_KEY=
NIM_MODEL=
TRON_LLM_BASE_URL=
TRON_LLM_API_KEY=
TRON_LLM_MODEL=
DATA_MODE=synthetic            # 실데이터 연결 후 live
ENABLE_NILE_EXECUTION=false    # 지갑 준비 후 true
TRONGRID_API_KEY=
```

### 명령 (구현 후 package.json에서 제공)

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev          # 웹 + 로컬 API 동시 실행
npm run typecheck
npm test
npm run build
npm run doctor       # 외부 연결 진단
```

---

## 7. 통합 체크리스트 (요약)

전체 목록은 WORKFLOW §8에 있다.

- [ ] 날짜가 빠지면 질문하고, 사용자가 확인하기 전에는 계획을 확정하지 않는다.
- [ ] 지출일을 7일에서 45일로 바꾸면 투자 가능액이 바뀐다.
- [ ] USDD 위험 수용을 거부하면 B가 제외된다.
- [ ] NIM 정상 / 인증 실패 / 형식 오류 / 타임아웃에서 모두 흐름이 유지된다.
- [ ] PSM 물량 부족, 비활성 시장, 체인 불일치, 오래된 데이터에서는 실행이 제한된다.
- [ ] 같은 입력과 quote면 LLM 공급자가 달라도 결과가 같다.
- [ ] MCP 초기화, 도구 발견, 읽기 호출을 확인하고, 허용 목록 밖 도구는 거부된다.
- [ ] Nile 예치는 원 txID, 확정 영수증, 포지션 재조회로 확인한다.
- [ ] 새로고침으로 복원해도 중복 거래가 생기지 않는다.
- [ ] 모든 화면에서 시뮬레이션/과거/실데이터와 Mainnet/Nile 구분이 유지된다.
- [ ] 키가 소스, 응답, 번들, 로그, JSON에 없다.

---

## 8. 막혔을 때

| 막힘 | 대응 |
| --- | --- |
| 공식 API나 RPC 연결 실패 | 다른 팀원 환경에서 재검증. 과거 스냅샷은 `과거 데이터`로만 표시하고, 현재 금리를 확인할 수 없으면 실행 추천을 중단 |
| 지갑이나 Nile TRX 미확보 | 공식 Faucet 사용. 거래 시연이 불가능하면 실제 실행 기준 미달로 기록 |
| USDD PSM 확인 불가 | B를 `현재 실행 불가`로 표시하고 이유를 설명. 현금 비중이 다른 JustLend 안을 추가하되 USDD 경로를 완성한 것으로 세지 않음 |
| AI 키 지연이나 NIM 장애 | 템플릿으로 흐름을 완성하고, 발표에서 모델 호출 여부를 정확히 표기 |
| 거래가 확정되지 않음 | 원 txID를 재조회하고 `대기 중`으로 표시. 중복 서명을 요청하지 않음 |
| MCP 연결이 막힘 | 30~60분 안에 판단해서 필요한 읽기 기능만 직접 조회로 대체하고 사유를 기록 |

**시간이 부족할 때 미루는 순서:** 인출 → 최소 운용액 탐색 → JSON 가져오기 → 장기 재생 → 모델의 도구 선택 → TronGrid MCP 확장

**미루면 안 되는 것:** 사용자 확인, 비용·출구 조건, 출처·데이터 모드 표시, 체인 구분
