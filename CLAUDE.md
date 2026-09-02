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
| `stocks.html` | 테마주 이론 검증 랩 — 매크로 이론을 실제 주가로 검증 + 전략 백테스트 | https://sgspeed04.github.io/Tracker/stocks.html |

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
- `stocks.html`은 Supabase를 쓰지 않음 — 개인 데이터가 없고 `data/stocks.json` 읽기 전용이라 동기화할 상태가 없음
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
- **자동수집 후보 탭**: `scripts/fetch-india-tenders.js`가 `.github/workflows/update-india-tenders.yml`을 통해 매일 05:00 KST 자동 실행, CPPP·GeM "최신 공고" 목록에서 제목에 계량기 관련 키워드(meter/AMI/AMR)가 있는 것만 걸러 `data/india_tenders.json`에 저장
  - 개발 중 이 세션의 프록시·WebFetch에서는 GeM·CPPP 둘 다 403으로 막혀 실제 HTML을 못 보고 선택자를 방어적으로 작성했으나, **실제 GitHub Actions 실행 로그로 확인한 결과 CPPP는 정상 동작함** — `table.list_table tbody tr` 선택자가 실제로 맞아떨어져 매일 목록을 정상 파싱 중(계량기 키워드 매칭이 없는 날은 0건이 정상 — 파싱 실패가 아님). GeM(bidplus.gem.gov.in)은 GitHub Actions 러너에서 `net::ERR_CONNECTION_REFUSED`로 여전히 차단됨(데이터센터 IP 차단 WAF로 추정, PropertyLeads의 VWorld/Azure IP 차단과 동일 패턴) — CPPP만으로 계속 수집됨
  - 실패해도 기존 데이터를 덮어쓰지 않고 `updated_at`만 갱신하도록 설계됨 — GeM 차단이 지속돼도 수동 등록 워크플로에는 영향 없음
  - 확장 시 `scripts/fetch-india-tenders.js`의 `TARGETS` 배열에 대상 추가, 다른 국가로 확장하려면 새 `fetch-<country>-tenders.js` 스크립트 + workflow 추가
- Supabase 크로스 디바이스 동기화 (테이블 `mb_tenders`)

## stocks.html 주요 기능
- **목적**: "요즘 정치 이슈·인플레이션·디플레이션 이론들이 실제 주가를 얼마나 설명하나"를 과거 데이터로 채점하는 통계 실험실. **종목 추천이 아니라 이론 검증 도구**이며, 페이지 곳곳에 그 취지를 명시함
- **유니버스**: AI·에너지·로봇·자동차·환경 5개 테마 × 한국/미국 각 1~3위 = 30종목 + 벤치마크 2개(S&P500, 코스피). `scripts/fetch-stocks.js`의 `UNIVERSE` 배열에서 조정
- **이론 9종**(FRED 지표 기반, API 키 불필요): 정책 불확실성(USEPUINDXD ← 정치 이슈), 위험회피/VIX(VIXCLS), 실질금리 할인(DFII10), 피셔 효과·인플레 헤지(T5YIE), 장단기 금리차·디플레 신호(T10Y2Y), 신용 스프레드(BAA10Y), 달러 유동성(DTWEXBGS), 유가 전가(DCOILWTICO), 원화 약세·외국인 수급(DEXKOUS, 한국 종목만)
- **검증 방식**: 주간 로그수익률을 인자 변화에 단순회귀(최근 3년, 최소 60주) → β(1σ당 %p)·t값·R²·방향 적중률을 계산하고, 점수 = 0.45×유의성 + 0.25×설명력 + 0.30×적중률, **이론이 예측한 부호와 반대면 ×0.2 감점**. 종목별/테마별/전체로 잘 맞는 이론 3위·안 맞는 이론 3위를 뽑음
- **전략 백테스트 7종**("남들이 하는 것 중 뭐가 효과 있었나"): 매수후보유, 200일 이평 추세추종, 골든크로스(50/200), 12-1 모멘텀, RSI 평균회귀, 변동성 타깃, 매크로 필터. CAGR·MDD·샤프·월간승률·보유비중을 종목별로 계산해 매수후보유와 비교
  - 매크로 필터는 처음에 `VIX < 22 && 금리차 > -0.2` 같은 **절대 임계값**을 썼다가 고금리 국면에서 신호가 영구히 죽어 보유비중 0%가 나오는 것을 합성 데이터 테스트에서 발견 → **최근 1년 대비 백분위**(VIX 중앙값 이하 + 금리차 하위 20% 초과 + 200일선 위) 기준으로 교체함
- **설명 방식**: 모든 이론·전략·용어에 초등학생 눈높이 설명을 붙이고, 종목 모달에서는 실제 수치를 문장에 끼워 자동 생성함. **R²를 항상 같이 노출**해 "이 이론이 설명하는 건 X%뿐이고 나머지는 그 회사 사정"이라는 한계를 계속 상기시킴
- **자동 갱신**: `.github/workflows/update-stocks.yml`이 매일 06:30 KST 실행. 외부 npm 의존성 없음(Node 내장 fetch만 사용)해서 `npm install` 단계 자체가 없음
- **데이터 출처**: 주가 = Yahoo Finance chart API(배당·분할 보정 종가). 실패 시 **한국 종목은 네이버 금융**(`api.finance.naver.com/siseJson.naver`), **미국 종목은 Stooq CSV**로 폴백. 매크로 = FRED `fredgraph.csv`(API 키 불필요)
  - 네이버 응답은 작은따옴표를 쓰는 유사 JSON이라 `JSON.parse`가 안 됨 → `parseNaverSise()`가 행 단위 정규식으로 날짜·종가만 뽑음(형식이 조금 바뀌어도 견디게)
  - **네이버 시세는 액면분할은 반영하지만 배당은 반영하지 않음**(Yahoo adjclose는 배당까지 반영). 폴백이 돌면 해당 종목의 장기 수익률이 배당수익률만큼 낮게 잡히므로, 결과 JSON의 `source_summary`와 페이지 상단 경고 배너로 어떤 소스가 쓰였는지 항상 노출함
  - Stooq는 지수 티커 체계가 달라 `^GSPC → ^spx` 매핑을 따로 둠
  - **개발 세션의 프록시에서는 Yahoo/Stooq/FRED가 모두 403으로 차단됨**(조직 egress 정책). 그래서 개발 중 검증은 실제 호출 대신 아래 테스트 2종으로 함
- **러너에서의 실제 도달성**(2026-09-02 `scripts/probe-sources.js`로 확인 — 추측이 아니라 측정값):

  | 소스 | 결과 |
  |------|------|
  | `fred.stlouisfed.org` (fredgraph.csv) | ✖ **타임아웃 — 완전 차단** |
  | `api.stlouisfed.org` (FRED 공식 API) | ✔ 도달 가능 (키 없이 호출하면 HTTP 400) |
  | `query1/query2.finance.yahoo.com` | ✔ OK (76ms) |
  | `stooq.com` | ✔ OK |
  | `api.finance.naver.com`, `fchart.stock.naver.com` | ✔ OK |
  | `ecos.bok.or.kr` (한국은행) | ✖ 타임아웃 |

  - 즉 **주가 소스는 전부 살아있고 FRED 웹호스트만 막혔다.** GeM·VWorld와 같은 데이터센터 IP 차단 패턴으로 보이나, 같은 기관의 API 호스트는 뚫려 있다는 점이 다름
  - 그래서 `FRED_API_KEY`(무료, https://fredaccount.stlouisfed.org/apikeys)가 있으면 공식 API를, 없으면 기존 CSV를 쓴다. **키를 Secrets에 등록해야 9개 이론이 전부 동작함**
  - 키가 없을 때는 Yahoo 대체 지표(`MACRO_PROXY`)로 **위험회피(^VIX)·유가(CL=F)·달러(DX-Y.NYB)·원화(KRW=X) 4개 이론만** 검증됨. 기대인플레·실질금리·신용스프레드·정책불확실성은 Yahoo에 대응물이 없어 **인플레이션/디플레이션 계열 이론은 FRED 키 없이는 못 함**
- **수집 견고성**(첫 실행에서 FRED 타임아웃으로 14분간 매달리다 취소된 뒤 보강):
  - `getText()`의 `clearTimeout`이 헤더 도착 시점에 걸려 있어 **본문 수신에는 타임아웃이 없던 버그**를 수정(`finally`로 이동). 요청 상한 15초, 재시도 2회
  - **소스 회로차단기**: 한 소스에서 성공이 0건인 채 실패가 쌓이면(FRED 3회, 주가 5회) 이후 요청을 건너뜀. 성공 이력이 있으면(Yahoo가 한국 종목만 막는 경우) 차단하지 않음 — 전면 차단 시 Yahoo 호출이 64회→10회로 줄어드는 것을 테스트로 확인
  - 수집 전체 예산 15분 + 워크플로 `timeout-minutes: 25`
  - 매크로 인자를 한 건도 못 받으면 빈 결과를 쓰지 않고 실패시켜 기존 `data/stocks.json`을 보존
- **테스트**(워크플로에서 수집 전에 먼저 실행 — 실패하면 데이터를 건드리지 않음):
  - `node scripts/test-stocks-math.js` — 합성 데이터 71종 검사. 정답을 아는 입력(예: y=2+3x)을 넣어 회귀·RSI·이동평균·백테스트 지표·점수 규칙을 검증
  - `node scripts/test-stocks-e2e.js` — 가짜 Yahoo/FRED/네이버 응답을 `global.fetch`에 물려 파이프라인 전체를 돌리는 71종 검사. **Yahoo가 한국 종목만 403으로 막는 상황을 흉내내 네이버 폴백이 실제로 작동하는지도 검증함**(15종목+코스피가 네이버로 전환되고 Yahoo 경로와 같은 결과가 나오는지). **테마별로 알려진 관계를 주가에 심어놓고**(예: AI→실질금리 음의 반응) 결과 JSON이 그 이론을 1위로 되찾는지 확인. `STOCKS_OUT` 환경변수로 출력 경로를 임시 파일에 돌려 실제 `data/stocks.json`을 덮어쓰지 않음
- **실제 운영 상태**(2026-09-02 기준, 러너에서 5회 실행해 확인): 주가 30종목+벤치마크 2개 모두 Yahoo 에서 정상 수집(네이버 폴백은 발동하지 않음). 매크로는 FRED 차단으로 Yahoo 대체 지표 4종만 동작해 **이론 9개 중 4개만 검증 중** — `FRED_API_KEY` Secret 을 등록하면 나머지 5개(인플레·디플레 계열 포함)가 복구됨. 대시보드 최상단에 이 상태와 복구 절차를 상시 노출함
- **알려진 한계**(페이지의 "계산 방법·주의" 탭에도 명시): 거래비용·세금 미반영, 생존 편향(지금 유명한 회사만 표본), 한미 장 마감 시차, 단일 인자 회귀라 이론 간 중복 계산, 최근 3년이라는 표본 기간 의존, 상장 기간 짧은 종목(두산로보틱스 등)의 낮은 신뢰도

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
