# GWDC 2026 Challenge B — TRON 지출 일정 기반 자산 계획 (BaekInwon 구현)

사용자의 지출 일정과 위험 성향을 대화로 확인합니다. 지출일에 쓸 돈을 먼저 확보한 뒤, 남은 돈을 JustLend jUSDT 예치(A)와 USDD PSM → jUSDD 경로(B)에 넣었을 때의 **출금까지 포함한 순수익**을 전액 보유 기준선과 비교합니다. Nile 테스트넷에서는 별도 계획으로 실제 jTRX 예치·확정·재조회를 합니다.

## 실행

```powershell
cd TeamBaek\BaekInwon
npm install
Copy-Item .env.example .env.local   # 이미 있으면 생략. 키는 이 파일에만 넣는다
npm run dev          # 웹(http://127.0.0.1:5173) + 로컬 API(127.0.0.1:8787) 동시 실행
npm run typecheck
npm test
npm run build
npm run doctor       # 외부 연결 진단 (성공/실패/미확인)
```

주요 환경 변수 (`.env.example` 참고)

| 변수 | 설명 |
| --- | --- |
| `NIM_API_KEY`, `NIM_MODEL` | NVIDIA NIM. 사용 모델 `openai/gpt-oss-20b` |
| `TRONGRID_API_KEY` | TronGrid RPC와 TronGrid MCP 헤더 |
| `DATA_MODE` | `synthetic`(가상 금리, 배지 표시) / `live`(실데이터) |
| `ENABLE_NILE_EXECUTION` | `true`여야 TronLink 서명 버튼이 활성화됨 |
| `MCP_TRONGRID_ENABLED` | 호스팅 TronGrid MCP 연결 (Mainnet 수수료 파라미터 조회) |
| `MCP_JUSTLEND_COMMAND`, `MCP_USDD_COMMAND` | 공식 MCP stdio 실행 명령 (기본 비움, 아래 한계 참고) |

## 화면 흐름

1. **개요**: 주간 지출 달력과 `보유 − 지출 확보 = 운용 가능 상한`. 입력 전에는 고정 시연 사례를 `가상 시연` 배지와 함께 보여줌
2. **요구 분석**: LLM이 자연어에서 입력만 추출하고, 누락 항목과 다음 질문은 코드가 결정함. 요약을 확인하기 전에는 계획을 만들지 않고, 확인 후 입력이 바뀌면 확인과 선택을 무효화함. LLM 장애 시 규칙 기반 템플릿과 폼으로 대체함
3. **계획 비교**: A/B/보유를 같은 자산·기간으로 비교함. 기본 수익, 미확인 보상, 왕복 거래비용(TRX와 USDT 환산), 전환 수수료, 순수익, 손익분기, 적격성과 사유, 스트레스 결과, 출처를 보여줌. "최고 APY만 고른 경우"와도 비교함. AI 설명은 숫자 검증을 통과해야 표시됨
4. **시장 데이터**: JustLend, USDD PSM, Nile jTRX 원시 값과 MCP 연결 상태
5. **Nile 실행**: TronLink 연결 → Nile 요구사항 확인 → 두 배분안(최대 예치 / 50%) 비교 → 거래 전 확인(지갑·체인·금액·계약·메서드·승인 범위·비용 상한·위험·유효 시각) → 서명 직전 재확인 → 서명 → txID 즉시 저장 → 확정 영수증 → 같은 포지션 재조회. 인출(redeem)도 같은 절차
6. **검토**: Mainnet 분석 기록(버전 누적), Nile 거래 기록, 예상 vs 관측 이자, JSON 내보내기

## 구조

```text
shared/   schemas.ts(공통 계약) · needs.ts(요구사항·누락 판정) · planning.ts(계산 엔진) · eligibility.ts · units.ts
server/   index.ts(로컬 API) · env.ts · doctor.ts
          llm/ provider.ts · nim.ts · template.ts        (tron.ts는 TRON LLM 명세 수령 후 추가)
          mcp/ clients.ts · registry.ts(읽기 전용 허용 목록)
          data/ justlend.ts · usdd.ts · tron-rpc.ts · quotes.ts
src/      App.tsx · features/{overview,conversation,plans,market,execution,review} · lib/{api,storage,tronlink}.ts
fixtures/ synthetic-quotes.json · demo-needs.json
tests/    planning.test.ts · llm-and-mcp.test.ts
```

로컬 API는 `GET /api/health`, `POST /api/chat`, `POST /api/plans`, `POST /api/observe`, `GET /api/transactions/:txId?chain=nile`이고, 시장 데이터 탭용으로 `GET /api/market`가 추가되어 있습니다.

## 데이터 출처와 접근 방식

| 값 | 출처 | 방식 |
| --- | --- | --- |
| jUSDT/jUSDD 공급 APY, 인출 유동성, USDT의 TRX 가격 | JustLend 공식 OpenAPI `GET /lend/jtoken` | 직접 조회. 주소를 공식 배포 주소와 대조함 |
| 예치 중지 여부 | Comptroller `mintGuardianPaused` | 온체인 읽기 |
| PSM 수수료·활성 상태, 진입 여유(`Vat.ilks` line − Art×rate), 출구 USDT | USDD PSM·Vat·GemJoin 계약 | 온체인 읽기 |
| PSM 전환 Energy | 최근 성공한 sellGem/buyGem 거래의 실측 최대값 | TronGrid |
| Energy/Bandwidth 단가 | `getChainParameters` | **TronGrid MCP** 우선, 실패 시 직접 RPC |
| JustLend 거래 Energy | 공식 JustLend MCP 소스의 `TYPICAL_RESOURCES` | 일반값 (Energy 스테이킹 없이 소각한다고 가정) |
| Nile jTRX 금리·현금·포지션 | `TKM7w4qFmkXQLEF2MgrQroBYpd5TY7i1pq` (계약명 JustLend-TRX 확인) | 온체인 읽기 |

## 구현 범위와 한계

- **LLM**: NVIDIA NIM `openai/gpt-oss-20b`를 실제로 호출함(추출은 약 3~17초). TRON LLM은 명세를 받지 못해 아직 쓰지 않음
- **MCP**: TronGrid 호스팅 MCP는 연결되며, 도구 149개를 발견하고 읽기 도구 2개만 허용함. 공식 JustLend·USDD MCP는 시작할 때 `~/.agent-wallet` 지갑을 자동으로 만들고, USDD MCP의 PSM 도구는 물량을 반환하지 않음. 그래서 문서 규칙에 따라 시장·PSM 조회는 직접 조회로 대체함. 클라이언트와 허용 목록은 구현되어 있어 실행 명령을 넣으면 연결됨
- **보상**: JustLend 채굴 보상은 조건을 확인하지 않아 `미확인`으로 두고 기본 수익에서 제외함
- **현재 실데이터 결과**: 1,000 USDT·30일 사례에서 A의 기본 이자(약 1.30 USDT)보다 왕복 비용(약 22 TRX ≈ 7.4 USDT)이 커서 **거래 보류(보유)를 권고함**. jUSDD 금리가 거의 0이라 B도 음수임
- **Mainnet**: 조회 전용 조건부 분석이며 Mainnet 거래는 실행하지 않음. **Mainnet USDT·USDD 계획의 실행 기준은 부분 구현**
- **Nile**: 순익이 음수면 `개발자 테스트 실행`으로 표시함. 테스트 TRX 수익은 USDT로 환산하지 않음
- 장기 재생(P1), 최소 운용액 탐색(P1), JSON 가져오기(P1)는 구현하지 않음
