# 한상규 — 자문 서비스 & 개인 트래커

## 나에 대해
- 직업: 해외 영업 + ERP/BI 담당
- 부업: 전문가 자문 서비스 (GLG, Coupang, LinkedIn, 직접 클라이언트)
- 전문 분야: 해외 영업, 무역/수출, ERP/BI, 이커머스

## 관련 저장소
부동산 관련 도구(위반건축물 리드, 재개발·재건축 지도)는 [sgspeed04/PropertyLeads](https://github.com/sgspeed04/PropertyLeads)로 분리했습니다 — 공공데이터 자동수집 인프라를 공유하는 별개 사업이라 이 저장소와는 독립적으로 관리합니다.

계량기 입찰(tenders.html)도 원래는 PropertyLeads와 같은 이유로 별도 저장소(`sgspeed04/MeterBids`)로 분리할 계획이었으나, GitHub App 연동 권한이 기존에 설치된 저장소로 한정되어 있어 새 저장소를 자동으로 만들지 못해 우선 이 저장소 안에 두었습니다. `MeterBids` 빈 저장소를 만들고 앱 접근 권한을 부여하면 PropertyLeads 때와 동일한 방식(파일 이관 + Secrets 재등록)으로 분리할 수 있습니다.

## 프로젝트 구조

| 파일 | 용도 | URL |
|------|------|-----|
| `index.html` | 개인 습관/목표 주간 트래커 | https://sgspeed04.github.io/Tracker/ |
| `consulting.html` | 자문 서비스 CRM + 수입 관리 | https://sgspeed04.github.io/Tracker/consulting.html |
| `smartstore.html` | 네이버 스마트스토어 관리 (상품/재고 + 주문 + 정산/마진) | https://sgspeed04.github.io/Tracker/smartstore.html |
| `tenders.html` | 해외 계량기(전기/가스/수도) 입찰 트래커 — 인도부터 시작, 동남아·서남아·중국 확대 예정 | https://sgspeed04.github.io/Tracker/tenders.html |

## 기술 스택
- **프론트엔드**: Vanilla JS + HTML/CSS (빌드 불필요, 단일 파일)
- **데이터베이스**: Supabase (PostgreSQL, 무료 플랜)
- **호스팅**: GitHub Pages (무료)
- **Gmail CRM**: Streak (Chrome 확장)
- **저장소**: github.com/sgspeed04/Tracker (main 브랜치 배포)

## Supabase 설정
- 프로젝트: sgspeed04's Project (sghan.biz)
- URL: https://fbctahxjzwwzuscjvaxg.supabase.co
- 테이블: `cm_clients`, `cm_sessions`, `ss_products`, `ss_orders`, `mb_tenders`
- RLS: 활성화됨 (anon 정책 적용)

## consulting.html 주요 기능
- 클라이언트 관리 (이름/회사/이메일/업종/플랫폼/단가)
- 자문 기록 (날짜/주제/시간/금액/상태)
- 상태 흐름: 예정 → 완료 → 청구됨 → 수금완료
- 수입 통계 (월별 차트, 플랫폼별 분석)
- Gmail 연동 (이메일 템플릿, 클라이언트 검색)
- Supabase 크로스 디바이스 동기화

## smartstore.html 주요 기능
- 상품/재고 관리 (상품명/카테고리/원가/판매가/재고/안전재고/소싱처 링크) — 안전재고 이하 시 대시보드에 부족 알림
- 주문 관리 (주문일/구매자/수량/판매가/네이버 수수료율/상태)
- 상태 흐름: 신규주문 → 발송준비 → 발송완료 → 구매확정 (취소/반품 분기)
- 정산/마진: 구매확정 주문 기준 매출·수수료·원가·마진을 월별로 집계
- Supabase 크로스 디바이스 동기화 (consulting.html과 동일 패턴, 테이블 `ss_products`/`ss_orders`)
- 네이버 커머스API 연동 자동화는 아직 미구현 — API 키 발급 후 필요 시 추가 (현재는 수기 입력)

## tenders.html 주요 기능
- 해외 계량기(전기/가스/수도/스마트미터) 입찰(tender) 리드 관리 — 국가/계량기유형/발주기관/입찰번호/출처/공고일/마감일/규모/상태/메모
- 상태 흐름: 신규 → 검토중 → 제안서작성 → 제출완료 → 낙찰/유찰 (보류 분기)
- 대시보드: 마감임박(14일 이내) 알림, 국가별·계량기유형별 분포, 최근 등록 리드
- **국가별 바로가기**: 인도 중앙(GeM/CPPP)·인도 주정부/DISCOM(마하라슈트라 MahaTenders·MSEDCL·마디아프라데시·타밀나두·우타르프라데시·라자스탄·구자라트 nProcure)·인도 가스 배급사(GAIL·IGL·MGL)·인도 상수도청(Delhi Jal Board·UP Jal Nigam)·인도네시아 중앙(INAPROC)·인도네시아 전력(PLN)·인도네시아 가스(PGN)·인도네시아 상수도(PAM Jaya)·베트남(VNEPS)·태국 중앙(e-GP)·태국 전력(MEA 방콕·PEA 지방)·태국 가스(PTT)·태국 상수도(MWA 방콕·PWA 지방)·필리핀(PhilGEPS)·필리핀 상수도(LWUA)·방글라데시(e-GP)·파키스탄(PPRA)·중국(CCGP) 조달포털 홈페이지 링크 + Google 사이트 검색 바로가기(추천 키워드 포함) — 전기·가스·수도를 각각 별도 기관(국영 전력공사/가스공사, 지역 상수도)이 운영하는 나라는 유형별 전담 포털을 추가함(인도, 인도네시아, 태국). 인도네시아 상수도는 PDAM이 도시별로 분산 운영돼 자카르타 PAM Jaya를 대표 사례로 걸어둠 — 다른 지역은 자체 PDAM 포털을 별도로 확인해야 함. 태국은 전력·상수도 모두 방콕 대도시권(MEA/MWA)과 나머지 지방(PEA/PWA)을 서로 다른 국영기관이 담당하는 이원 구조라 각각 두 기관씩 추가함. 베트남은 반대로 입찰 관련 법령상 EVN(전력)·PV Gas·지역 상수도(SAWACO/HAWACO 등) 국영기업도 전부 국가 전자조달망(VNEPS) 한 곳에 공시해야 해서 기관별 포털을 따로 추가하지 않음(검색 중 확인됨 — 개별 기관 전용 조달 포털은 못 찾음). 필리핀은 전력이 NEA 산하 121개 지역 전력협동조합으로 쪼개져 있어 통합 포털 없이 대부분 PhilGEPS에 개별 공고되고, 가스는 배관망 인프라가 미미해(LPG 위주) 계량기 입찰 자체가 드물어 중앙(PhilGEPS)에 이 배경 설명만 추가하고 별도 전력/가스 기관 링크는 넣지 않음 — 상수도는 메트로마닐라 외 지역 수도청을 감독하는 LWUA의 입찰 페이지를 확인해 추가함. 수동 검색 후 발견한 입찰을 바로 등록하는 방식이 현재 가장 안정적
- **자동수집 후보 탭(파일럿, 미검증)**: `scripts/fetch-india-tenders.js`가 `.github/workflows/update-india-tenders.yml`을 통해 매일 05:00 KST 자동 실행, CPPP·GeM "최신 공고" 목록에서 제목에 계량기 관련 키워드(meter/AMI/AMR)가 있는 것만 걸러 `data/india_tenders.json`에 저장
  - ⚠️ 개발 중 GeM(bidplus.gem.gov.in)·CPPP(eprocure.gov.in) 모두 이 세션의 프록시와 WebFetch 양쪽에서 HTTP 403을 반환 — 홈페이지 접근조차 막혀 실제 HTML 구조를 검증하지 못한 채 선택자를 방어적으로 작성했다. 데이터센터 IP 대역 차단(WAF)으로 추정되며 GitHub Actions 러너에서도 막힐 가능성이 있음 — PropertyLeads의 VWorld/Azure IP 차단과 동일 패턴. 실제 동작 여부는 Actions 탭의 실행 로그에서 확인할 것(0건이면 선택자 진단 로그가 남음)
  - 실패해도 기존 데이터를 덮어쓰지 않고 `updated_at`만 갱신하도록 설계됨 — 자동수집이 막혀 있어도 수동 등록 워크플로에는 영향 없음
  - 확장 시 `scripts/fetch-india-tenders.js`의 `TARGETS` 배열에 대상 추가, 다른 국가로 확장하려면 새 `fetch-<country>-tenders.js` 스크립트 + workflow 추가
- Supabase 크로스 디바이스 동기화 (테이블 `mb_tenders`)

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
