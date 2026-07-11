# 한상규 — 자문 서비스 & 개인 트래커

## 나에 대해
- 직업: 해외 영업 + ERP/BI 담당
- 부업: 전문가 자문 서비스 (GLG, Coupang, LinkedIn, 직접 클라이언트)
- 전문 분야: 해외 영업, 무역/수출, ERP/BI, 이커머스

## 관련 저장소
부동산 관련 도구(위반건축물 리드, 재개발·재건축 지도)는 [sgspeed04/PropertyLeads](https://github.com/sgspeed04/PropertyLeads)로 분리했습니다 — 공공데이터 자동수집 인프라를 공유하는 별개 사업이라 이 저장소와는 독립적으로 관리합니다.

## 프로젝트 구조

| 파일 | 용도 | URL |
|------|------|-----|
| `index.html` | 개인 습관/목표 주간 트래커 | https://sgspeed04.github.io/Tracker/ |
| `consulting.html` | 자문 서비스 CRM + 수입 관리 | https://sgspeed04.github.io/Tracker/consulting.html |

## 기술 스택
- **프론트엔드**: Vanilla JS + HTML/CSS (빌드 불필요, 단일 파일)
- **데이터베이스**: Supabase (PostgreSQL, 무료 플랜)
- **호스팅**: GitHub Pages (무료)
- **Gmail CRM**: Streak (Chrome 확장)
- **저장소**: github.com/sgspeed04/Tracker (main 브랜치 배포)

## Supabase 설정
- 프로젝트: sgspeed04's Project (sghan.biz)
- URL: https://fbctahxjzwwzuscjvaxg.supabase.co
- 테이블: `cm_clients`, `cm_sessions`
- RLS: 활성화됨 (anon 정책 적용)

## consulting.html 주요 기능
- 클라이언트 관리 (이름/회사/이메일/업종/플랫폼/단가)
- 자문 기록 (날짜/주제/시간/금액/상태)
- 상태 흐름: 예정 → 완료 → 청구됨 → 수금완료
- 수입 통계 (월별 차트, 플랫폼별 분석)
- Gmail 연동 (이메일 템플릿, 클라이언트 검색)
- Supabase 크로스 디바이스 동기화

## index.html 주요 기능
- 일일 습관 추적 (월~금): 운동, 식단, 중국어, 영어
- 주말 습관 추적 (토/일): 운동, 공부(Python/BI), 음악제작, 부동산 리서치
- 주간 목표: 업무(GLG/Coupang), 투자, 부동산
- 히스토리 기록 및 달성률 통계 (주중/주말 구분)

## 개발 규칙
- 코드 변경 후 반드시 `git push origin main` (GitHub Pages 자동 반영)
- 단일 파일 원칙 유지 (외부 라이브러리 최소화)
- LocalStorage 우선, Supabase는 선택적 동기화

## 향후 업그레이드 계획 (자문 수입 발생 후)
- [ ] Supabase Pro (백업, 더 많은 스토리지)
- [ ] 커스텀 도메인 연결 (sghan.biz)
- [ ] 자동 청구서 이메일 발송
- [ ] Make.com 연동 (Gmail/Calendar 자동화)
- [ ] 인보이스 PDF 자동 생성
