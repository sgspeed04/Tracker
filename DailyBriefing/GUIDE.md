# 📈 일일 투자 브리핑 자동화 가이드

## 목적

매일 오전 7시 / 오후 10시(KST)에 최신 뉴스를 AI가 분석해서 투자 브리핑을 자동 생성하고 Notion에 저장한다.

- 뉴스 수집 → AI 분석 → 구조화된 브리핑 → Notion 자동 저장
- 완전 무료 (Groq 무료 티어 + GitHub Actions 무료 사용량)
- 한 번 설정하면 매일 자동 실행

---

## 전체 흐름

```
GitHub Actions (매일 07:00 / 22:00 KST)
      ↓
Google News RSS  — 뉴스 헤드라인 12건
      ↓
Groq (Llama 3.3 70B)  — 브리핑 생성
      ↓
Notion API  — 데이터베이스에 한 행 추가
      ↓
data/daily_briefing.json  — 저장소에 아카이브 (최근 180일)
```

전부 `scripts/daily-briefing.js` 한 파일에 들어 있고,
`.github/workflows/daily-briefing.yml` 이 매일 실행한다.

---

## 왜 make.com이 아니라 GitHub Actions인가

처음엔 make.com 노코드 시나리오(RSS → HTTP → JSON Parse → Router → Notion)로 만들었으나
`Source is not valid JSON` / `Validation failed for 1 parameter(s)` 에러가 반복됐다. 원인은 두 가지가 겹친 것:

1. **Groq가 응답을 ` ```json ` 코드펜스로 감싸서** 돌려주는 경우가 있음 → JSON Parse 모듈이 거부
2. **make.com은 모듈을 지우고 다시 만들면 번호가 바뀌는데**(`{{10.Data...}}` → `{{12.Data...}}`),
   매핑 문자열은 옛 번호 그대로 남아 조용히 깨짐

둘 다 make.com UI 안에서만 보이는 상태라, 뭐가 틀렸는지 화면을 하나씩 열어보기 전엔 알 수 없었다.
GitHub Actions로 옮기면서 이 문제가 사라졌다:

| | make.com | GitHub Actions |
|---|---|---|
| 설정 | UI 클릭 (상태가 눈에 안 보임) | 코드 (git으로 관리) |
| 디버깅 | 모듈 하나씩 열어봐야 함 | 실행 로그에 원인이 그대로 찍힘 |
| 모듈 번호 깨짐 | 있음 | 없음 |
| 무료 한도 | 1,000 ops/월 | 공개 저장소 무제한 |

이 저장소는 이미 `update-india-tenders.yml`로 매일 자동수집을 돌리고 있어서, 검증된 방식이기도 하다.

---

## 사용 도구 및 비용

| 도구 | 용도 | 비용 |
|------|------|------|
| GitHub Actions | 스케줄 실행 | 무료 (공개 저장소 무제한) |
| Groq API | AI 뉴스 분석 | 무료 (1,000 req/일) |
| Notion API | 브리핑 저장 | 무료 |
| Google News RSS | 뉴스 수집 | 무료 |

**총 비용: 0원**

---

## 설정 방법 (최초 1회, 약 10분)

### 1단계: Notion 데이터베이스 만들기

1. Notion → 새 페이지 → **데이터베이스(Table)** 생성
2. 이름: `투자 브리핑`
3. 컬럼을 아래와 **정확히 같은 이름**으로 만들기 (이름이 다르면 저장 실패):

| 컬럼명 | 타입 |
|--------|------|
| 투자브리핑 | Title (기본 제목 컬럼 이름을 이걸로 변경) |
| 시장동향 | Text |
| 주요뉴스 | Text |
| 종목분석 | Text |
| 체크리스트 | Text |

---

### 2단계: Notion 통합(Integration) 만들기

1. https://www.notion.so/my-integrations 접속
2. **New integration** 클릭
3. 이름: `투자브리핑` → **Submit**
4. **Internal Integration Secret** 복사 → 이게 `NOTION_TOKEN`
5. 다시 Notion 데이터베이스 페이지로 돌아가서
   → 우측 상단 **···** → **연결 추가(Add connections)** → `투자브리핑` 선택

> ⚠️ 5번을 빼먹으면 통합이 데이터베이스를 못 봐서 `object_not_found` 에러가 난다. 가장 흔한 실수.

---

### 3단계: Notion Database ID 찾기

데이터베이스 페이지를 브라우저에서 열면 주소가 이렇게 생겼다:

```
https://www.notion.so/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6?v=...
                      └────────── 이 32자리가 Database ID ──────────┘
```

`?v=` 앞의 32자리를 복사 → 이게 `NOTION_DATABASE_ID` (하이픈은 있어도 없어도 됨)

---

### 4단계: Groq API 키 발급

1. https://console.groq.com 접속 → 로그인
2. **API Keys** → **Create API Key**
3. 이름: `투자브리핑` → **Submit**
4. 키 복사 → 이게 `GROQ_API_KEY`

> ⚠️ 키는 이 화면을 닫으면 다시 볼 수 없다. 바로 다음 단계로 넘어가서 등록할 것.

---

### 5단계: GitHub Secrets 등록

저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

아래 3개를 각각 등록:

| Name | Value |
|------|-------|
| `GROQ_API_KEY` | 4단계에서 복사한 Groq 키 |
| `NOTION_TOKEN` | 2단계에서 복사한 Notion Secret |
| `NOTION_DATABASE_ID` | 3단계에서 복사한 32자리 ID |

> Secrets에 넣은 값은 저장소 코드나 실행 로그에 절대 노출되지 않는다.

---

### 6단계: 수동 실행으로 테스트

저장소 → **Actions** 탭 → 왼쪽에서 **일일 투자 브리핑** 선택 → **Run workflow** 클릭

1~2분 뒤 Notion에 오늘 날짜 행이 생기면 성공. 이후로는 매일 자동 실행된다.

---

## 실행 시각 바꾸기

`.github/workflows/daily-briefing.yml`의 cron을 수정한다. **cron은 UTC 기준**이라 KST에서 9시간을 빼야 한다:

```yaml
schedule:
  - cron: '0 22 * * *'   # 07:00 KST (22:00 UTC 전날)
  - cron: '0 13 * * *'   # 22:00 KST (13:00 UTC)
```

| 원하는 KST 시각 | cron |
|---|---|
| 06:00 | `0 21 * * *` |
| 07:00 | `0 22 * * *` |
| 08:00 | `0 23 * * *` |
| 09:00 | `0 0 * * *` |
| 21:00 | `0 12 * * *` |
| 22:00 | `0 13 * * *` |

> GitHub Actions의 스케줄은 러너가 붐빌 때 5~15분 늦게 실행될 수 있다 (GitHub 공식 사양).

---

## 관심 종목 바꾸기

`scripts/daily-briefing.js` 상단:

```js
const WATCHLIST = ['삼성전자', 'SK하이닉스', 'TSLA', '비트코인'];
```

원하는 종목으로 바꾸고 커밋하면 다음 실행부터 반영된다.

뉴스 검색어를 바꾸려면 바로 아래 `RSS_URL`의 `encodeURIComponent('주식 투자 경제')` 부분을 수정한다.

---

## 로직 검증 (외부 호출 없이)

API 키 없이 파싱·정규화 로직만 테스트할 수 있다:

```bash
node scripts/daily-briefing.js --dry-run
```

RSS 파싱, 코드펜스 제거, 필드 정규화, Notion 텍스트 청킹 등 19개 항목을 검사한다.
스크립트를 수정한 뒤엔 커밋 전에 이걸 돌려보면 된다.

---

## 오류 해결

실패하면 **Actions 탭 → 실패한 실행 → 로그**에 원인이 한국어로 찍힌다.

| 로그 메시지 | 원인 | 해결 |
|------|------|------|
| `환경변수 GROQ_API_KEY 가 설정되지 않았습니다` | Secret 미등록 | 5단계 다시 확인 |
| `Groq 요청 실패: HTTP 401` | 키가 틀렸거나 만료 | Groq에서 키 새로 발급 후 Secret 갱신 |
| `Groq 요청 실패: HTTP 429` | 무료 한도 초과 | 하루 뒤 자동 복구 (1,000 req/일) |
| `Groq 요청 실패: HTTP 400 ... decommissioned` | 모델 단종 | `GROQ_MODEL` 값을 Groq 콘솔의 현행 모델로 교체 |
| `Notion 저장 실패: HTTP 404` | 통합이 DB에 연결 안 됨 | 2단계 **5번**(연결 추가) 수행 |
| `Notion 저장 실패: HTTP 400 ... is not a property` | 컬럼 이름 불일치 | 1단계 표와 컬럼 이름을 글자까지 일치시키기 |
| `RSS에서 뉴스를 한 건도 못 읽었습니다` | 피드 구조 변경/차단 | `RSS_URL` 확인, 검색어 단순화 |
| `Groq 응답에서 JSON을 찾지 못했습니다` | 모델이 거부 응답 | 대개 일시적 — 다음 실행에서 자동 복구 |

---

## 아카이브

매 실행마다 `data/daily_briefing.json`에도 저장된다 (최근 180일치).

```json
{
  "updated_at": "2026-08-18",
  "briefings": [
    {
      "date": "2026-08-18",
      "generated_at": "2026-08-17T22:00:12.345Z",
      "market": "...",
      "news": "· ...",
      "stocks": "▸ ...",
      "checklist": "- ...",
      "source_headlines": ["..."]
    }
  ]
}
```

Notion을 나중에 갈아엎어도 원본이 저장소에 남고, 나중에 웹 화면에서 히스토리를 보여주고 싶을 때 그대로 쓸 수 있다.

---

## 향후 확장 아이디어

- `DailyBriefing/index.html`에서 `data/daily_briefing.json`을 읽어 히스토리 화면 표시
- Gmail 알림 추가 (Google 저장용량 확보 후)
- 종목별 실제 시세를 브리핑에 포함 (무료 시세 API 연동)
- 주간 요약 (일요일 저녁에 한 주치 브리핑을 다시 요약)
