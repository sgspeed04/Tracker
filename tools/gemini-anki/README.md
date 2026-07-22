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

카드 자동 생성(AnkiConnect 방식)은 PC에서만 가능 — AnkiConnect가 로컬 서버 방식이라
AnkiDroid(안드로이드)에서는 못 돌림. 다만 `study_log_to_file.py`를 쓰면 AnkiConnect 없이
가져오기용 텍스트 파일만 만들 수 있어서, Python이 도는 태블릿(Termux 설치한 갤럭시탭/
레드미패드 등)에서도 카드 후보를 만든 뒤 AnkiDroid의 가져오기 기능으로 넣을 수 있다
(자세한 건 "10. 태블릿/PC용 Anki 없이 카드 파일만 만들기" 참고). 복습 자체는 어떤
기기에서든 AnkiWeb 동기화로 완전히 가능.

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
2. 공부하다가 남기고 싶은 내용이 있으면, 그날 날짜 헤더 밑에 그냥 붙여넣는다. **형식 신경 안 써도 된다** —
   아래처럼 짧게 정리된 글이든,

   ```
   ## 2026-07-22

   **incoterms** - 국제 상거래에서 매도인과 매수인의 비용/위험 분담을 정한 무역 조건.
   ```

   평소 쓰던 대로 긴 글이든 상관없다 (`--ai` 옵션을 쓰면 AI가 알아서 핵심만 뽑아낸다):

   ```
   ## 2026-07-23

   오늘 Gemini랑 인코텀즈에 대해 길게 얘기함. 매도인/매수인 사이에 물류비랑
   위험 부담을 언제 누가 지는지 정하는 국제 규칙이라고 함. FOB는 선적할 때까지만
   매도인 책임이고, CIF는 목적항 도착까지 매도인이 운임/보험까지 부담...(중략)
   ```

3. **AI로 자동 추출하려면** (`--ai`, 형식 안 갖춘 긴 글도 가능) 무료 Gemini API 키가 필요하다.
   - [aistudio.google.com](https://aistudio.google.com) 접속 → 로그인 → **Get API key** 클릭 → 키 복사
   - Windows에서 한 번만 등록: 시작 메뉴 → "환경 변수 편집" 검색 → 사용자 변수에 새로 만들기
     → 변수 이름 `GEMINI_API_KEY`, 값에 복사한 키 붙여넣기 → 확인
4. 카드로 만들고 싶을 때 (Anki를 켜둔 상태에서), 아래 중 하나:

   - **더블클릭으로 실행 (가장 간편)**: `tools/gemini-anki/run_study_log.bat` 더블클릭
     (내부적으로 `study_log.md`를 `--ai`로 처리해 카드로 추가한다)
   - **직접 명령어로 실행**:

     ```
     pip install -r tools/gemini-anki/requirements.txt

     # 먼저 뭐가 추출되는지만 확인 (Anki에 추가 안 함)
     python tools/gemini-anki/study_log_to_anki.py tools/gemini-anki/study_log.md --ai --dry-run

     # 확인됐으면 실제로 Anki에 추가
     python tools/gemini-anki/study_log_to_anki.py tools/gemini-anki/study_log.md --ai --deck "Gemini 학습"
     ```

     (`--ai`를 빼면 예전처럼 `**표현** - 설명` 형식만 정규식으로 인식하는 방식으로 동작한다.)

   같은 로그를 여러 번 돌려도 이미 추가된 카드는 중복으로 안 들어가니, 로그에 새로 추가한
   내용만 있어도 매번 전체 파일을 대상으로 돌리면 된다.
5. PC Anki에서 동기화(Sync) 버튼 누르면 폰까지 반영된다.

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

## 10. 태블릿/PC용 Anki 없이 카드 파일만 만들기

AnkiConnect는 PC용 Anki 프로그램에서만 지원돼서, 갤럭시탭/레드미패드 같은 안드로이드
태블릿에서는 `push_to_anki.py`나 `study_log_to_anki.py`를 그대로 못 쓴다. 대신
`study_log_to_file.py`는 AnkiConnect 없이, 가져오기용 텍스트 파일만 만들어준다.

Termux(안드로이드용 터미널 앱)에 Python을 설치했다면 태블릿에서도 그대로 쓸 수 있다.

```
python tools/gemini-anki/study_log_to_file.py study_log.md --ai -o anki_import.txt
```

만들어진 `anki_import.txt`는:

- **Anki 데스크톱**: 파일 > 가져오기(Import) → 이 파일 선택 → 필드 구분자 "탭", 노트
  유형 "기본(Basic)" 확인 후 가져오기
- **AnkiDroid**: 오른쪽 위 메뉴 > 가져오기 → 이 파일 선택

로 바로 카드가 들어간다. `push_to_anki.py`와 달리 중복 검사를 안 해주므로, 같은 로그를
여러 번 돌릴 땐 새로 추가된 부분만 별도 파일로 만들거나, 가져오기 전에 파일 내용을
한 번 확인하는 게 좋다.

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
- `--ai` 옵션은 `study_log.md`에 있는 항목 하나당 Gemini API를 한 번씩 호출한다.
  개인이 하루 몇 개씩 쓰는 정도면 무료 사용량 한도 안에서 충분하지만, 로그가
  아주 길고 많아지면 API 사용량/요금을 가끔 확인하는 게 좋다.
- `GEMINI_API_KEY`는 절대 `study_log.md`나 코드에 직접 적어 커밋하지 말고,
  환경변수로만 등록해서 쓴다.
- Gemini 모델 이름은 Google이 종종 구버전을 신규 사용자에게 막아서 바뀔 수 있다.
  `python study_log_to_anki.py ... --ai` 실행 시 "no longer available" 같은 404
  오류가 뜨면, `--model gemini-2.5-flash`처럼 다른 모델명을 직접 지정하거나
  `ai_extract.py`의 `DEFAULT_MODEL` 값을 바꾼다. (기본값은 `gemini-flash-latest`
  별칭이라 보통은 자동으로 최신 모델을 따라간다.)
- 윈도우(특히 한국어 윈도우)에서 `python 파일명.py` 실행 시
  `SyntaxError: Non-UTF-8 code starting with ...` 가 뜨면, 파일이 깨진 게 아니라
  콘솔/로케일 인코딩 설정 문제일 수 있다. `run_study_log.bat`은 이미 이 문제를
  자동으로 피하도록 만들어져 있고, 직접 명령어로 실행할 때 같은 오류가 나면
  실행 전에 `$env:PYTHONUTF8=1` (PowerShell) 또는 `set PYTHONUTF8=1` (cmd)을
  먼저 입력한다.
