# Gemini 학습 → Anki 자동 복습 파이프라인

Gemini와 공부한 내용을 자동으로 Anki 카드로 만들어서, 폰(AnkiDroid)으로 간격 반복(SRS) 복습하기 위한 도구.

## 전체 흐름

카드 소스는 두 가지 방식 중 골라 쓸 수 있다.

```
[방식 A: 공부한 부분만 직접 쌓기 — 추천]
PC: 공부하다 남기고 싶은 답변을 study_log.md에 붙여넣기
  → study_log_to_anki.py: study_log.md → Anki 카드 자동 추가 (한 번에)

[방식 B: Takeout으로 전체 대화 기록 내보내기]
PC: Google Takeout으로 Gemini 대화 기록 내보내기
  → parse_takeout.py: Takeout HTML → activities.json
  → extract_expressions.py: activities.json → candidates.json (핵심 표현 후보)
  → (선택) candidates.json을 직접 검토/수정
  → push_to_anki.py: AnkiConnect로 PC의 Anki에 카드 자동 추가

[공통]
  → AnkiWeb 동기화 → 폰(AnkiDroid)에서 복습
  → find_forgotten_cards.py: 자주 까먹는 카드 찾아서 Gemini에게 다시 물어보기
```

방식 A는 Takeout처럼 대화 전체를 한 번에 내보내는 게 아니라, 공부하다가 카드로
남기고 싶은 답변만 그때그때 골라 쌓는 방식이라 노이즈가 적다. 방식 B는 손은 덜
가지만 관련 없는 대화까지 다 섞여 나온다.

카드 자동 생성은 PC에서만 가능 (AnkiConnect가 로컬 서버 방식이라 폰에서는 못 돌림).
복습 자체는 폰에서 완전히 가능.

---

## 1. PC: Anki 설치

1. [apps.ankiweb.net](https://apps.ankiweb.net) 접속
2. Windows용 설치 파일 다운로드
3. 실행 → 기본 옵션으로 설치

## 2. PC: AnkiConnect 애드온 설치

1. Anki 실행
2. 상단 메뉴 **도구(Tools) → 애드온(Add-ons) → 가져오기(Get Add-ons...)**
3. 코드 입력창에 `2055492159` 입력 → OK
4. **Anki 재시작** (필수 — 재시작해야 애드온이 활성화됨)

### 설치 확인

```
python tools/gemini-anki/test_connection.py
```

`연결 성공! AnkiConnect API 버전: N`이 뜨면 정상 작동 중. (브라우저로 `http://localhost:8765` 접속해도 `AnkiConnect`라는 텍스트가 뜬다.)

## 3. AnkiWeb 무료 계정 만들기 + PC 동기화

1. [ankiweb.net](https://ankiweb.net) 에서 무료 계정 가입
2. PC Anki 프로그램에서 오른쪽 위 **동기화(Sync)** 버튼 클릭 → 방금 만든 계정으로 로그인
3. 동기화 완료 확인

## 4. 폰(Android): AnkiDroid 설치

1. Play스토어에서 **AnkiDroid** 검색 → 설치 (완전 무료)
2. 앱 실행 → 설정에서 같은 AnkiWeb 계정으로 로그인
3. 동기화 실행 (자동 동기화 켜두면 편함)

---

## 5. 방식 A (추천): 공부한 부분만 study_log.md에 쌓기

1. `tools/gemini-anki/study_log.example.md`를 같은 폴더에 `study_log.md`로 복사한다
   (`study_log.md`는 `.gitignore`에 등록돼 있어 커밋되지 않는다 — 개인 학습 내용이라 저장소에 안 올라가는 게 맞음).
2. 공부하다가 Gemini 답변 중 카드로 남기고 싶은 부분이 있으면, 아래 형식으로 그날 날짜 밑에 붙여넣는다.

   ```
   ## 2026-07-22

   **incoterms** - 국제 상거래에서 매도인과 매수인의 비용/위험 분담을 정한 무역 조건.
   ```

   Gemini에게 "핵심 표현은 `**표현** - 뜻` 형식으로 정리해줘"라고 요청해두면 바로 이 형식으로 답을 준다.
3. 카드로 만들고 싶을 때 (Anki를 켜둔 상태에서):

   ```
   pip install -r tools/gemini-anki/requirements.txt

   # 먼저 뭐가 추출되는지만 확인 (Anki에 추가 안 함)
   python tools/gemini-anki/study_log_to_anki.py tools/gemini-anki/study_log.md --dry-run

   # 확인됐으면 실제로 Anki에 추가
   python tools/gemini-anki/study_log_to_anki.py tools/gemini-anki/study_log.md --deck "Gemini 학습"
   ```

   같은 로그를 여러 번 돌려도 이미 추가된 카드는 중복으로 안 들어가니, 로그에 새로 추가한
   내용만 있어도 매번 전체 파일을 대상으로 돌리면 된다.
4. PC Anki에서 동기화(Sync) 버튼 누르면 폰까지 반영된다.

## 6. 방식 B: Google Takeout에서 Gemini Apps 대화 기록 전체 내보내기

1. [takeout.google.com](https://takeout.google.com) 접속
2. "모든 데이터 선택 해제" 후 **Gemini Apps** 항목만 선택
3. 내보내기 형식은 HTML 유지 (기본값)
4. 내보내기 완료 후 zip 압축을 풀면 `Takeout/Gemini Apps/My Activity.html` 파일이 생김

## 7. (방식 B) 파싱 스크립트 실행

```
pip install -r tools/gemini-anki/requirements.txt

# 1) Takeout HTML → activities.json
python tools/gemini-anki/parse_takeout.py "Takeout/Gemini Apps/My Activity.html" -o activities.json

# 2) activities.json → candidates.json (핵심 표현 후보 추출)
python tools/gemini-anki/extract_expressions.py activities.json -o candidates.json
```

Takeout은 대화를 골라서 내보낼 수 없고 Gemini Apps 활동 전체가 한 번에 나온다.
특정 기간이나 주제의 대화만 쓰고 싶다면 `parse_takeout.py`에 필터 옵션을 쓴다.

```
# 날짜 범위로 필터 (YYYY-MM-DD)
python tools/gemini-anki/parse_takeout.py "Takeout/Gemini Apps/My Activity.html" \
  --start-date 2026-07-01 --end-date 2026-07-31 -o activities.json

# 제목/본문에 특정 키워드가 있는 활동만 (대소문자 무시)
python tools/gemini-anki/parse_takeout.py "Takeout/Gemini Apps/My Activity.html" \
  --keyword "무역" -o activities.json

# 두 조건 동시 적용도 가능
python tools/gemini-anki/parse_takeout.py "Takeout/Gemini Apps/My Activity.html" \
  --start-date 2026-07-01 --keyword ERP -o activities.json
```

`extract_expressions.py`는 Gemini 응답에서 다음 두 패턴을 찾아 후보로 뽑는다.

- `**표현** - 설명` (굵게 강조 + 대시 설명)
- `"표현" - 설명` (따옴표 + 대시 설명)

자동 추출은 완벽하지 않으므로, `candidates.json`을 열어 필요 없는 항목을 지우거나
`meaning`을 다듬고 나서 다음 단계로 넘어가는 것을 권장한다. 각 후보의
`reviewed` 값을 `true`로 바꿔두면 `push_to_anki.py --only-reviewed` 옵션으로
검토된 것만 골라 추가할 수 있다.

## 8. (방식 B) Anki에 카드 자동 추가

```
python tools/gemini-anki/push_to_anki.py candidates.json --deck "Gemini 학습"
```

- Anki가 켜져 있어야 하고, `test_connection.py`가 성공해야 한다.
- 덱이 없으면 자동 생성한다.
- 이미 같은 앞면(Front)이 있는 카드는 중복 추가하지 않는다 (덱 기준).
- 카드 추가 후 PC Anki에서 동기화(Sync) 버튼을 눌러야 AnkiWeb/폰에 반영된다.

## 9. 자주 까먹는 카드 다시 물어보기

Anki는 카드마다 "다시(Again)" 버튼을 누른 횟수(lapse)를 이미 기록하고 있다.
그 값이 높은 카드, 즉 복습할 때마다 자꾸 틀리는 카드만 뽑아서 Gemini에게
다시 설명해달라고 요청하는 루프를 만들 수 있다.

```
python tools/gemini-anki/find_forgotten_cards.py --deck "Gemini 학습" --min-lapses 2 --print-prompt
```

- `--min-lapses`: 이 횟수 이상 까먹은 카드만 보여준다 (기본 2).
- `--print-prompt`: 뽑힌 표현들을 모아 Gemini에 바로 붙여넣을 수 있는 재설명 요청
  프롬프트까지 출력한다.
- 출력된 프롬프트를 Gemini에 붙여넣고 받은 답을 다시 `study_log.md`에 추가한 뒤
  `study_log_to_anki.py`를 돌리면, 기존 카드는 중복으로 건너뛰고 새로 보강된
  설명만 자연스럽게 새 카드로 쌓인다. (Anki는 같은 Front가 있으면 새로 안 만드므로,
  더 나은 설명으로 바꾸고 싶으면 기존 카드를 Anki 브라우저에서 직접 수정하는 게 낫다.)

---

## 알아두기

- `parse_takeout.py`는 Google Takeout이 모든 활동 기록(검색, 어시스턴트, Gemini 등)에
  공통으로 쓰는 `outer-cell` / `content-cell` HTML 구조를 기준으로 파싱한다. Google이
  포맷을 바꾸면 안 먹힐 수 있으니, 그럴 경우 `activities.json` 결과가 비어 있는지 먼저
  확인하고 `parse_takeout.py`의 클래스명을 실제 HTML에 맞게 조정한다.
- Gemini Apps 활동 기록에 실제로 어떤 내용까지 저장되는지(프롬프트만인지, 응답까지
  포함되는지)는 계정/시점마다 다를 수 있다. 응답이 포함되어 있지 않다면
  `extract_expressions.py`의 정규식이 매칭할 대상이 없어 후보가 0개로 나올 수 있다 —
  이 경우 Gemini에게 "핵심 표현은 `**표현** - 뜻` 형식으로 답해줘"라고 요청해두면
  다음 Takeout 내보내기부터 잘 추출된다.
