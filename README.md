# GWDC 2026 — TRON Challenge B 문서 폴더

TRON 생태계용 AI 자산배분·Yield Planning 도우미의 **기획·구현 문서**를 모아 둔 폴더다. 아직 코드는 없다.

- **제출 기한:** 2026-09-30 12:00 KST
- **인원:** 4명

## 문서 안내

| 파일 | 역할 | 이럴 때 본다 |
| --- | --- | --- |
| [OVERVIEW.md](./OVERVIEW.md) | **한눈에 보기.** 아래 세 문서를 한 장으로 요약. 시간표, 역할, 공통 계약, 절대 규칙, 환경 설정, 체크리스트 | 작업 중 옆에 띄워 둘 때. **처음이라면 여기부터** |
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | **무엇을 왜 만드는가.** 문제 정의, 대회 기준별 완료 조건, 시연 사례, 계획 A/B 알고리즘, 데이터·거래 설계, 시간표, 위험과 대안 | 기능 범위나 계산 규칙을 판단해야 할 때 |
| [IMPLEMENTATION_WORKFLOW.md](./IMPLEMENTATION_WORKFLOW.md) | **어떤 순서로 어떻게 만드는가.** 기술 구성, 파일 구조, MCP 연결 방침, LLM(NIM → TRON) 전환, 단계별 작업과 완료 기준, 로컬 API 계약, 검증 체크리스트 | 구현을 시작하거나 다음 단계로 넘어갈 때 |
| [ROLES.md](./ROLES.md) | **누가 무엇을 만드는가.** 4인 역할별 구현 파일, 기술 스택, 연결할 MCP, 발급받을 키, 완료 기준, 통합 지점 | 내 담당 범위와 준비물을 확인할 때 |
| [CLAUDE.md](./CLAUDE.md) | Claude Code(AI 코딩 도우미)가 읽는 작업 지침. 폴더 상태와 코드 작업 시 불변 조건 | 사람은 볼 필요 없음. 규칙이 바뀌면 함께 갱신 |
| `GWDC Korea Hackathon_ TRON Challenge Brief.pdf` | 대회 원문. Challenge A/B/C 중 **B**가 이 프로젝트 | 심사 기준 원문을 확인할 때 |

## 문서 우선순위

문서 내용이 서로 다르면 아래 순서를 따른다.

1. **대회 원문 PDF**: 심사 기준
2. **PROJECT_PLAN.md**: 제품 요구사항
3. **IMPLEMENTATION_WORKFLOW.md**: 구현 방식과 순서
4. **ROLES.md**, **OVERVIEW.md**: 위 문서의 정리본이므로 원문과 다르면 원문 기준으로 고친다

## 처음 합류했다면

1. [OVERVIEW.md](./OVERVIEW.md)로 전체 흐름과 절대 규칙을 읽는다.
2. [ROLES.md](./ROLES.md)에서 내 역할의 구현 범위와 발급받을 키를 확인한다.
3. OVERVIEW §6 체크리스트대로 키, 지갑, MCP를 준비하고 `.env.local`을 만든다. 키는 이 파일에만 넣는다.
4. 구현 중에는 [IMPLEMENTATION_WORKFLOW.md](./IMPLEMENTATION_WORKFLOW.md)의 내 단계 완료 기준을 확인한다.

## 개발한 결과물은 어디에?

1. TeamBaek 디렉터리는 결과물이 올 디렉터리이다.
2. 디렉터리 밑에 각자 이름 안에 구현한 프로젝트를 넣어 Commit한다. 