# /tracker — 개인 습관 & 목표 트래커

개인 주간 트래커(index.html) 관련 작업을 수행합니다.
CLAUDE.md의 전체 컨텍스트를 참고하세요.

## 핵심 파일
- **파일**: `index.html` (단일 파일, Vanilla JS)
- **배포 URL**: https://sgspeed04.github.io/Tracker/
- **저장**: LocalStorage (+ 선택적 Claude API 동기화)

## 트래킹 항목

### 일일 습관 (월~금) — `DAILY` 배열
- 🏃 운동
- 🥗 식단
- 🇨🇳 중국어
- 🇬🇧 영어

### 주말 습관 (토/일) — `WEEKEND_DAILY` 배열 (별도 섹션)
- 🏃 운동
- 💻 공부 (Python/BI)
- 🎵 음악제작
- 🏠 부동산 리서치

### 주간 목표 — `WEEKLY` 배열
- 💼 업무: GLG 프로필, Coupang 프로필, LinkedIn, 자문 콜
- 📈 투자: 포트폴리오 리뷰, 시장뉴스, 매수/매도, 월 저축
- 🏠 부동산: 지역 시장, 재개발 뉴스

## 자주 요청되는 작업
- 주중 습관 추가/변경 → `DAILY` 배열 수정
- 주말 습관 추가/변경 → `WEEKEND_DAILY` 배열 수정
- 주간 목표 추가/변경 → `WEEKLY` 배열 수정
- UI 변경 → CSS 수정

## 작업 완료 후 반드시
```bash
git add index.html
git commit -m "변경 내용 요약"
git push origin main
```
