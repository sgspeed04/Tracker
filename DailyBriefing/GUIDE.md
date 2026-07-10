# 📈 일일 투자 브리핑 자동화 가이드

## 목적

매일 오전 7시 / 오후 10시에 최신 뉴스를 AI가 분석해서 투자 브리핑을 자동 생성하고 Notion에 저장한다.

- 뉴스 수집 → AI 분석 → 구조화된 브리핑 → Notion 자동 저장
- 완전 무료 (Groq AI 무료 티어 사용)
- 한 번 설정하면 매일 자동 실행

---

## 전체 흐름

```
Google News RSS
      ↓
Groq AI (Llama 3) - 뉴스 분석 및 브리핑 생성
      ↓
JSON Parse - 구조화된 데이터 추출
      ↓
Router
      ↓
Notion - 브리핑 저장
```

---

## 사용 도구 및 비용

| 도구 | 용도 | 비용 |
|------|------|------|
| make.com | 자동화 플랫폼 | 무료 (1,000 ops/월) |
| Groq API | AI 뉴스 분석 | 무료 (1,500 req/일) |
| Notion | 브리핑 저장 | 무료 |
| Google News RSS | 뉴스 수집 | 무료 |

**총 비용: 0원**

---

## 준비물

1. **make.com** 계정
2. **Groq API 키** → console.groq.com에서 무료 발급
3. **Notion** 계정

---

## Notion 데이터베이스 설정

1. Notion → 새 페이지 → **데이터베이스(Table)** 생성
2. 이름: `투자 브리핑`
3. 컬럼 추가 (모두 Text 타입):

| 컬럼명 | 타입 |
|--------|------|
| 이름 (기본) | Title |
| 시장동향 | Text |
| 주요뉴스 | Text |
| 종목분석 | Text |
| 체크리스트 | Text |

---

## make.com 시나리오 구성

### 모듈 1: RSS
- **앱**: RSS
- **액션**: Retrieve RSS feed items
- **URL**: `https://news.google.com/rss/search?q=%EC%A3%BC%EC%8B%9D+%ED%88%AC%EC%9E%90+%EA%B2%BD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko`

---

### 모듈 2: HTTP (Groq AI)
- **앱**: HTTP
- **액션**: Make a request
- **URL**: `https://api.groq.com/openai/v1/chat/completions`
- **Method**: POST
- **Headers**:
  - `Authorization`: `Bearer YOUR_GROQ_API_KEY`
- **Body content type**: application/json
- **Body input method**: JSON string
- **Body content**:

```json
{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"오늘: {{formatDate(now; \"YYYY년 MM월 DD일\")}}\n관심 종목: 삼성전자, SK하이닉스, TSLA, 비트코인\n\n최신 뉴스:\n{{1.title}}\n\n마크다운, 코드블록, 설명 없이 아래 JSON 형식 그대로만 출력하세요:\n{\"market\":\"시장동향 3~4문장\",\"news\":\"뉴스 3~4개 (· 로 시작)\",\"stocks\":\"종목분석 (▸ 로 시작)\",\"checklist\":[\"액션1\",\"액션2\",\"액션3\"]}"}],"max_tokens":1000}
```

- **Parse response**: Yes
- **Authentication type**: No authentication

---

### 모듈 3: JSON Parse
- **앱**: JSON
- **액션**: Parse JSON
- **JSON string**: `{{10.Data.choices[1].message.content}}`

> ※ 숫자(10)는 HTTP 모듈 번호 — 본인 시나리오에서 확인 필요

---

### 모듈 4: Router
- Built-in tools → Router
- 1st 경로 → Notion 연결

---

### 모듈 5: Notion
- **앱**: Notion
- **액션**: Create a Database Item (Legacy)
- **Connection**: Notion Public 연결
- **Database**: 투자 브리핑

**Fields 매핑**:

| Notion 필드 | make.com 변수 |
|------------|---------------|
| 투자브리핑 (제목) | `{{formatDate(now; "YYYY-MM-DD")}}` |
| 시장동향 | `{{3.market}}` |
| 주요뉴스 | `{{3.news}}` |
| 종목분석 | `{{3.stocks}}` |
| 체크리스트 | `{{3.checklist[]}}` |

> ※ 숫자(3)는 JSON Parse 모듈 번호

---

## 스케줄 설정

make.com 하단 → **Schedule settings**:
- Run scenario: **Every day**
- 시간 1: **오전 7:00**
- **+ Add more schedules** → 시간 2: **오후 10:00**

---

## 자주 발생하는 오류 해결

| 오류 | 원인 | 해결 |
|------|------|------|
| 403 Forbidden (RSS) | RSS 피드 차단 | Google News RSS URL로 교체 |
| Unauthorized | API 키 오류 | `Bearer 키값` 형식 확인 (+ 없이 공백만) |
| Source is not valid JSON | AI가 마크다운으로 응답 | 프롬프트에 "코드블록 없이" 명시 |
| Validation failed | 모듈 번호 불일치 | JSON string의 모듈 번호 확인 |
| 변수가 보라색 아님 | 텍스트로 직접 입력 | 맵핑 버튼으로 변수 선택 |

---

## 관심 종목 변경 방법

HTTP 모듈 Body content에서 아래 부분 수정:

```
관심 종목: 삼성전자, SK하이닉스, TSLA, 비트코인
```

원하는 종목으로 교체하면 됩니다.

---

## 향후 확장 아이디어

- Google 용량 확보 후 **Gmail 알림** 추가
- **카카오톡** 알림 (액세스 토큰 6시간 갱신 필요)
- **Slack** 알림 (팀 공유용)
- Google Sheets 추가로 **차트/트렌드 분석**
