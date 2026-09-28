# GWDC 2026 · TRON Challenge B

TRON 맞춤형 AI 자산 배분 및 수익 계획 어시스턴트의 사전 개발 환경입니다.
현재 제공 범위는 개발 도구, 지출 일정에 따른 운용 가능액 미리보기, 조회용 화면, 공식 데이터 어댑터, 금액 계산 유틸리티, 요구사항·시연 자료입니다.
AI 추천, 계약 거래 실행, 성과 추적 제품 기능은 세부 주제에 맞춰 다음 단계에서 구현합니다.

화면의 1,000 USDT 사례는 가상 입력입니다. 지출일을 7일과 45일로 바꾸면 확보액과 운용 가능 상한이 달라집니다. JustLend 기본 이자는 조회 시점 APY가 운용 기간 동안 고정된다는 가정으로만 계산하며, 보상·왕복 비용·시장 활성 여부가 확인되지 않아 순수익이나 거래 권고로 표시하지 않습니다.
화면은 `개요`, `요구 분석`, `계획 미리보기`, `시장 데이터`, `연결 상태` 페이지로 나뉩니다. 앱 안에서 페이지를 이동하는 동안 시연 입력값은 유지됩니다.

## 실행

```sh
cd /Users/mireulo/2026/GWDC/TeamBaek/LeeMir
./scripts/run run dev
```

- 화면: http://127.0.0.1:5173
- 조회 API: http://127.0.0.1:8787/api/health
- 두 프로세스 종료: 실행 터미널에서 Ctrl+C
- `scripts/run`은 Apple Silicon Homebrew의 Node 24를 프로젝트 실행에만 적용합니다.
- 다른 컴퓨터는 Node 24를 선택한 후 `npm ci`와 `npm run dev`를 사용합니다.
- 패키지 버전은 `package-lock.json`으로 고정했습니다.

## 확인 명령

```sh
./scripts/run run check     # 금액/데이터 테스트, 타입 검사, 프로덕션 빌드
./scripts/run run doctor    # JustLend 실데이터 + Nile RPC 연결 검사
./scripts/run run snapshot  # 조회 시각을 붙인 과거 데이터 기록
```

`doctor`와 `snapshot`은 인터넷 연결이 필요합니다. 스냅샷은 `data/snapshots/`에 저장되고 Git에서 제외됩니다.
스냅샷을 현재 수익률로 표시하지 않습니다. 캐시는 조회 부하를 줄이기 위해 30초 유지됩니다.

## 구조

| 위치 | 역할 |
| --- | --- |
| `src/` | React + TypeScript 준비 화면, TronLink 주소 연결 |
| `server/` | JustLend Mainnet 조회, Nile RPC 조회, 로컬 GET API |
| `shared/` | 응답 스키마, 토큰 단위 변환, 요구사항 검증, 수익 추정 계산 |
| `tests/` | 정밀도·기간 수익·API 오류 처리 검증 |
| `data/` | 가상의 사용자 시나리오와 상품 자료 양식 |
| `docs/` | 브리프 요구사항, 출처, 데모, 발표 직후 결정 항목 |

## 데이터와 네트워크

JustLend 시장 데이터는 **Mainnet 조회**입니다. 개발 지갑과 RPC 검사는 **Nile**입니다.
지갑이 Nile에 연결돼도 Mainnet 수익률을 Nile 수익률로 바꿔 표시하지 않습니다.
API의 `fetchedAt`은 조회 시각이고 상품 자체의 갱신 시각은 아닙니다.
현재 API에는 인센티브 보상이 포함되지 않으며 활성/legacy 시장 여부는 거래 구현 전에 확인해야 합니다.
USDD는 공식 문서와 상품 자료 양식을 준비한 상태이며, 독립적인 USDD 상품 연동은 아직 구현하지 않았습니다.

## 지갑과 설정

TronLink를 설치하고 사용자님이 개발 지갑의 비밀번호 설정과 복구 구문 보관을 완료한 다음 Nile을 선택합니다.
지갑을 만든 뒤 준비 화면에서 주소 연결을 확인하고 [공식 Nile Faucet](https://nileex.io/join/getJoinPage)에서 테스트 토큰을 요청합니다.
연결 버튼은 주소 접근만 요청합니다. 개인키나 복구 구문을 앱에 입력하는 기능은 없습니다.

`.env.local`은 로컬 비밀 설정용으로 Git에서 제외됩니다. `.env.example`에는 변수 이름만 공유합니다.
공개 조회 검사는 현재 키 없이 동작하도록 준비했습니다. 필요할 때 `TRONGRID_API_KEY`를 서버 환경에 설정할 수 있습니다.
LLM 제공사·모델·API 키는 세부 주제와 제공 크레딧을 확인한 뒤 설정합니다. 현재 유료 AI API 호출은 포함하지 않습니다.

## 다음에 읽을 자료

- [대회 요구사항](docs/BRIEF.md)
- [공식 출처와 데이터 규칙](docs/SOURCES.md)
- [시연 시나리오](docs/DEMO.md)
- [설치 결과와 남은 사용자 작업](docs/SETUP.md)

이 프로젝트는 로컬 [팀 GitHub 저장소](https://github.com/Baek-Company/GWDC-2026-TronB) 작업 폴더의 `TeamBaek/LeeMir` 아래에 있습니다. Git 명령은 상위 `/Users/mireulo/2026/GWDC` 저장소에서 실행합니다.
