#!/usr/bin/env node
/**
 * fetch-stocks.js — 테마주 × 매크로 이론 검증 데이터 수집기
 *
 * 하는 일
 *  1) 주가: Yahoo Finance chart API (실패 시 Stooq CSV 폴백, 미국 종목만)
 *  2) 매크로 인자: FRED fredgraph.csv (API 키 불필요)
 *  3) 이론 검증: 주간 수익률을 매크로 인자 변화에 단순회귀 → beta / t값 / R² / 적중률 → 0~100 점수
 *  4) 전략 백테스트: 널리 알려진 매매 룰 7종 → CAGR / MDD / 샤프 / 시장노출도
 *  5) 결과를 data/stocks.json 으로 저장
 *
 * 설계 원칙: 수집이 실패해도 기존 data/stocks.json 을 파괴하지 않는다.
 *   (fetch-india-tenders.js / fetch-redevelopment.js 와 동일한 방어 패턴)
 *
 * 주의: 이 스크립트는 투자 자문이 아니라 "과거 데이터로 이론이 얼마나 들어맞았나"를
 *   재는 통계 계산기다. 상관관계는 인과관계가 아니며, 과거 적합도는 미래를 보장하지 않는다.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 테스트에서 실제 데이터를 덮어쓰지 않도록 출력 경로를 환경변수로 바꿀 수 있게 둔다
const OUT_PATH = process.env.STOCKS_OUT || path.join(__dirname, '..', 'data', 'stocks.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const REQ_TIMEOUT = 15000;    // 요청 하나당 상한 (헤더+본문)
const BUDGET_MS = 15 * 60e3; // 수집 전체 시간 예산 — 넘으면 남은 종목을 포기하고 진행
const YEARS = 5;              // 가격 수집 기간
const REG_WEEKS = 156;        // 회귀 분석 창 (3년, 주간)
const MIN_WEEKS = 60;         // 회귀에 필요한 최소 관측치

/* ────────────────────────────── 유니버스 ────────────────────────────── */
// 테마별로 "그 분야에서 가장 크거나 유명한" 상장사 상위 3곳씩, 한국/미국 각각.
// 시가총액·인지도 기준의 대표 표본일 뿐 추천 종목이 아니다.
const UNIVERSE = [
  // ── AI / 반도체
  { t: 'NVDA',      name: '엔비디아',        market: 'US', theme: 'AI',   rank: 1, why: 'AI 가속기 GPU 사실상 표준' },
  { t: 'MSFT',      name: '마이크로소프트',   market: 'US', theme: 'AI',   rank: 2, why: 'AI 클라우드(Azure)+오픈AI 축' },
  { t: 'AVGO',      name: '브로드컴',        market: 'US', theme: 'AI',   rank: 3, why: '맞춤형 AI 칩·네트워킹' },
  { t: '005930.KS', name: '삼성전자',        market: 'KR', theme: 'AI',   rank: 1, why: '메모리·파운드리 종합 1위' },
  { t: '000660.KS', name: 'SK하이닉스',      market: 'KR', theme: 'AI',   rank: 2, why: 'HBM(AI용 고대역폭 메모리) 선두' },
  { t: '042700.KS', name: '한미반도체',      market: 'KR', theme: 'AI',   rank: 3, why: 'HBM 본딩 장비' },

  // ── 에너지
  { t: 'XOM',       name: '엑슨모빌',        market: 'US', theme: '에너지', rank: 1, why: '서방 최대 석유메이저' },
  { t: 'CVX',       name: '셰브론',          market: 'US', theme: '에너지', rank: 2, why: '미국 2위 석유메이저' },
  { t: 'NEE',       name: '넥스트에라',      market: 'US', theme: '에너지', rank: 3, why: '세계 최대 재생에너지 발전' },
  { t: '015760.KS', name: '한국전력',        market: 'KR', theme: '에너지', rank: 1, why: '국내 전력 독점 사업자' },
  { t: '034020.KS', name: '두산에너빌리티',  market: 'KR', theme: '에너지', rank: 2, why: '원전·가스터빈 주기기' },
  { t: '096770.KS', name: 'SK이노베이션',    market: 'KR', theme: '에너지', rank: 3, why: '정유+배터리' },

  // ── 로봇
  { t: 'ISRG',      name: '인튜이티브서지컬', market: 'US', theme: '로봇', rank: 1, why: '수술로봇 다빈치 독점적 지위' },
  { t: 'ROK',       name: '록웰오토메이션',  market: 'US', theme: '로봇', rank: 2, why: '산업자동화 대표주' },
  { t: 'ABBNY',     name: 'ABB',            market: 'US', theme: '로봇', rank: 3, why: '산업용 로봇 글로벌 빅4' },
  { t: '454910.KS', name: '두산로보틱스',    market: 'KR', theme: '로봇', rank: 1, why: '국내 협동로봇 1위' },
  { t: '277810.KQ', name: '레인보우로보틱스', market: 'KR', theme: '로봇', rank: 2, why: '삼성 투자, 휴머노이드' },
  { t: '108490.KQ', name: '로보티즈',        market: 'KR', theme: '로봇', rank: 3, why: '로봇 구동 액추에이터' },

  // ── 자동차
  { t: 'TSLA',      name: '테슬라',          market: 'US', theme: '자동차', rank: 1, why: '전기차·자율주행 대표' },
  { t: 'GM',        name: 'GM',             market: 'US', theme: '자동차', rank: 2, why: '미국 완성차 1위' },
  { t: 'F',         name: '포드',            market: 'US', theme: '자동차', rank: 3, why: '미국 완성차 2위' },
  { t: '005380.KS', name: '현대차',          market: 'KR', theme: '자동차', rank: 1, why: '글로벌 판매 3위 그룹' },
  { t: '000270.KS', name: '기아',            market: 'KR', theme: '자동차', rank: 2, why: '현대차그룹 수익성 축' },
  { t: '012330.KS', name: '현대모비스',      market: 'KR', theme: '자동차', rank: 3, why: '핵심 부품·전동화' },

  // ── 환경 / 친환경
  { t: 'WM',        name: '웨이스트매니지먼트', market: 'US', theme: '환경', rank: 1, why: '북미 최대 폐기물 처리' },
  { t: 'FSLR',      name: '퍼스트솔라',      market: 'US', theme: '환경', rank: 2, why: '미국 최대 태양광 모듈' },
  { t: 'ENPH',      name: '엔페이즈',        market: 'US', theme: '환경', rank: 3, why: '태양광 마이크로인버터' },
  { t: '009830.KS', name: '한화솔루션',      market: 'KR', theme: '환경', rank: 1, why: '태양광(큐셀)+화학' },
  { t: '336260.KS', name: '두산퓨얼셀',      market: 'KR', theme: '환경', rank: 2, why: '수소연료전지 국내 1위' },
  { t: '010120.KS', name: 'LS ELECTRIC',    market: 'KR', theme: '환경', rank: 3, why: '전력 인프라·전력망' },
];

const BENCHMARKS = [
  { t: '^GSPC', name: 'S&P 500', market: 'US' },
  { t: '^KS11', name: '코스피',   market: 'KR' },
];

/* ────────────────────────────── 이론 정의 ────────────────────────────── */
// expect: 이론이 예측하는 beta 부호 (+1 = 인자가 오르면 주가도 오른다)
// kind:   'rate' = 금리/스프레드처럼 % 단위 레벨 → 변화량(%p)을 쓴다
//         'index'= 지수/가격 → 로그수익률(%)을 쓴다
const THEORIES = [
  {
    key: 'epu', name: '정책 불확실성 이론', academic: 'Baker–Bloom–Davis Economic Policy Uncertainty',
    series: 'USEPUINDXD', kind: 'index', expect: -1, scope: 'ALL',
    short: '정치·정책이 시끄러워지면 기업이 투자를 미루고 주가가 눌린다',
    kid: '어른들이 나라 규칙(세금·관세·법)을 바꿀지 말지 계속 싸우면, 회사 사장님은 "지금 공장 지었다가 규칙 바뀌면 손해인데?" 하고 결정을 미뤄요. 회사가 돈 벌 계획을 미루니까 그 회사 주식을 사려는 사람도 줄어서 값이 내려가요. 이 지수는 신문에 "정책이 불확실하다"는 말이 얼마나 많이 나왔는지 세는 자예요.',
  },
  {
    key: 'vix', name: '위험회피 / 공포지수 이론', academic: 'Risk premium & flight-to-safety (VIX)',
    series: 'VIXCLS', kind: 'index', expect: -1, scope: 'ALL',
    short: '시장이 무서워하면(변동성 급등) 위험자산인 주식부터 판다',
    kid: '반 친구들이 갑자기 "무서운 일이 생길 것 같아!" 하면, 다들 아끼는 딱지를 손해 보고라도 팔아치우죠. VIX는 그 "무서움 온도계"예요. 온도가 확 오르면 사람들이 주식을 던져서 값이 떨어져요.',
  },
  {
    key: 'realrate', name: '실질금리 할인 이론', academic: 'Real-rate discounting / equity duration (DCF)',
    series: 'DFII10', kind: 'rate', expect: -1, scope: 'ALL',
    short: '진짜 이자가 오르면 먼 미래에 벌 돈의 현재 가치가 깎인다 — 성장주가 특히 타격',
    kid: '"10년 뒤에 사탕 100개 줄게"라는 약속이 있어요. 그런데 은행에 돈 맡기면 이자를 많이 준다고 하면, 10년 뒤 사탕 약속은 상대적으로 시시해져요. 나중에 크게 벌겠다고 약속한 회사(성장주)일수록 이자가 오를 때 더 많이 떨어지는 이유예요.',
  },
  {
    key: 'breakeven', name: '피셔 효과 / 인플레 헤지 이론', academic: 'Fisher effect & inflation hedging (5Y breakeven)',
    series: 'T5YIE', kind: 'rate', expect: 1, scope: 'ALL',
    short: '물가가 오를 거라 보면 현금보다 실물·기업 지분이 낫다 → 주식으로 돈이 온다',
    kid: '물건 값이 계속 오를 것 같으면, 지갑에 돈을 넣어두면 손해예요(같은 돈으로 살 수 있는 게 줄어드니까). 그래서 사람들은 돈 대신 "물건을 만들어 파는 회사"를 사요. 다만 물가가 너무 미쳐 날뛰면 오히려 무서워서 다 파는데, 그때는 이 규칙이 깨져요.',
  },
  {
    key: 'curve', name: '장단기 금리차 / 디플레·침체 신호 이론', academic: 'Yield curve inversion as recession signal',
    series: 'T10Y2Y', kind: 'rate', expect: 1, scope: 'ALL',
    short: '10년 금리가 2년 금리보다 낮아지면(역전) 경기 침체·디플레 우려 신호',
    kid: '보통은 돈을 오래 빌려주면 이자를 더 받아요(오래 기다리니까). 그런데 짧게 빌려주는 이자가 더 커지는 이상한 일이 생기면, 사람들이 "곧 경제가 나빠져서 나중엔 이자가 확 내려갈 것"이라고 믿는다는 뜻이에요. 그게 침체·물가하락(디플레) 경보음이에요.',
  },
  {
    key: 'credit', name: '신용 스프레드 / 부도위험 이론', academic: 'Credit spread as equity risk proxy (BAA–10Y)',
    series: 'BAA10Y', kind: 'rate', expect: -1, scope: 'ALL',
    short: '회사채 가산금리가 벌어지면 "회사가 위험하다"는 뜻 → 주가에 먼저 반영',
    kid: '친구한테 돈 빌려줄 때, 그 친구가 못 갚을 것 같으면 "이자 많이 줘야 빌려준다"고 하죠. 회사들이 돈 빌리는 이자가 갑자기 비싸졌다면 어른들이 그 회사들을 못 미더워한다는 신호예요. 그러면 주식값도 같이 내려가요.',
  },
  {
    key: 'dollar', name: '달러 유동성 이론', academic: 'Broad dollar index & global liquidity',
    series: 'DTWEXBGS', kind: 'index', expect: -1, scope: 'ALL',
    short: '달러가 세지면 전 세계 돈줄이 마르고 위험자산에서 돈이 빠진다',
    kid: '달러는 전 세계가 같이 쓰는 "공용 화폐"예요. 달러가 갑자기 비싸지면, 달러로 물건 사고 빚 갚아야 하는 나라·회사들이 힘들어져요. 그래서 달러가 세지는 날엔 주식 같은 "모험 자산"에서 돈이 빠져나가요.',
  },
  {
    key: 'oil', name: '유가 전가 이론', academic: 'Oil price pass-through (cost vs revenue channel)',
    series: 'DCOILWTICO', kind: 'index', expect: 1, scope: 'ALL',
    short: '유가는 에너지 회사엔 매출(+), 기름을 쓰는 회사엔 비용(−) — 부호가 업종을 가른다',
    kid: '기름값이 오르면 기름을 캐서 파는 회사는 신나요(더 비싸게 파니까). 반대로 기름을 사서 쓰는 회사(자동차·비행기·공장)는 울상이에요. 그래서 같은 기름값 뉴스에도 회사마다 주가가 반대로 움직여요.',
  },
  {
    key: 'usdkrw', name: '원화 약세 / 외국인 수급 이론', academic: 'FX depreciation & foreign equity flows (KRW/USD)',
    series: 'DEXKOUS', kind: 'index', expect: -1, scope: 'KR',
    short: '원/달러가 오르면(원화 약세) 외국인이 환차손을 피해 한국 주식을 판다',
    kid: '외국 아저씨가 한국 주식을 샀는데, 원화 값이 싸지면 나중에 달러로 바꿀 때 손해예요. 그래서 원화가 약해지면 외국인들이 한국 주식을 먼저 팔곤 해요. 단, 수출로 먹고사는 회사(자동차·반도체)는 오히려 원화가 싸야 더 잘 팔려서 반대로 오르기도 해요 — 그래서 이 이론이 종목마다 갈려요.',
  },
];

/* ────────────────────────────── 전략 정의 ────────────────────────────── */
// "다른 사람들이 실제로 많이 쓰는" 공개된 매매 룰. 같은 종목·같은 기간에 태워서 비교한다.
const STRATEGY_DEFS = [
  { key: 'bh',      name: '매수 후 보유',            popular: '가장 기본. 인덱스 투자자 다수',
    kid: '한 번 사서 그냥 계속 들고 있기. 아무것도 안 하는 게 전략이에요.' },
  { key: 'ma200',   name: '200일 이동평균 추세추종',  popular: '메브 파버 등 추세추종 진영의 고전',
    kid: '최근 200일 평균 가격보다 지금 값이 높으면 "올라가는 중"이라 보고 들고 있고, 낮아지면 팔고 쉬어요. 미끄럼틀 타기 전에 내려오는 느낌이에요.' },
  { key: 'cross',   name: '골든크로스(50/200일)',    popular: '차트 분석에서 가장 유명한 신호',
    kid: '짧은 평균(50일)이 긴 평균(200일)을 뚫고 올라가면 사고, 반대로 내려가면 팔아요.' },
  { key: 'mom12',   name: '12-1 모멘텀(월간)',        popular: '학계에서 가장 많이 검증된 이상현상',
    kid: '지난 1년 동안 올랐으면 "잘 나가는 애"라 보고 한 달 더 들고 가요. 최근 한 달은 튀는 값이라 빼고 봐요.' },
  { key: 'rsi',     name: 'RSI 평균회귀(14일)',       popular: '단기 트레이더의 대표 지표',
    kid: '너무 많이 떨어졌으면(RSI 30 아래) "이제 오를 차례"라며 사고, 너무 많이 올랐으면(70 위) 팔아요.' },
  { key: 'voltgt',  name: '변동성 타깃(20일)',        popular: '기관·헤지펀드의 리스크 관리 표준',
    kid: '주가가 심하게 출렁이면 조금만 사고, 잔잔하면 많이 사요. 파도가 높으면 얕은 데서 노는 것과 같아요.' },
  { key: 'macro',   name: '매크로 필터(VIX+금리차)',   popular: '이 페이지의 이론들을 룰로 바꾼 실험판',
    kid: '무서움 온도계(VIX)가 최근 1년 평균보다 낮고, 금리 신호등이 최악(하위 20%)은 아니고, 주가도 오르는 중일 때만 주식을 들어요. 아니면 현금으로 쉬어요. 위 이론들이 진짜 돈이 되는지 시험해보는 거예요.' },
];

/* ────────────────────────────── 유틸 ────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const warnings = [];
function warn(msg) { warnings.push(msg); console.warn('  ! ' + msg); }

async function getText(url, { retries = 2, headers = {}, timeout = REQ_TIMEOUT } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // 본문 수신까지 같은 타임아웃 안에 끝나야 한다. 헤더만 보내고 멈추는 서버에
      // 무한정 매달리지 않도록 clearTimeout 을 finally 로 미룬다.
      return await res.text();
    } catch (e) {
      lastErr = e.name === 'AbortError' ? new Error(`타임아웃 ${timeout / 1000}초`) : e;
      if (i < retries - 1) await sleep(1200 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/* ── 소스 회로차단기 ──
 * 한 소스가 통째로 막히면(러너 IP 차단 등) 종목마다 재시도하느라 수집이 몇십 분씩
 * 늘어진다. 그 소스에서 성공이 한 건도 없고 실패가 쌓이면 이후 종목은 즉시 건너뛴다.
 * 일부 종목만 막히는 경우(예: Yahoo 가 한국 종목만 차단)에는 이미 성공 이력이 있으므로
 * 차단되지 않는다.
 */
const sourceHealth = {};
const DEAD_AFTER = { fred: 3 };          // 지표가 9개뿐이라 FRED 는 더 빨리 포기
const SOURCE_DEAD_AFTER = 5;
function noteSource(label, ok) {
  const h = (sourceHealth[label] ||= { ok: 0, fail: 0 });
  if (ok) h.ok++; else h.fail++;
}
function isSourceDead(label) {
  const h = sourceHealth[label];
  return !!h && h.ok === 0 && h.fail >= (DEAD_AFTER[label] ?? SOURCE_DEAD_AFTER);
}

const fmtDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const round = (v, d = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

/* ────────────────────────────── 데이터 수집 ────────────────────────────── */

/** Yahoo Finance chart API → [{d:'YYYY-MM-DD', c:종가}] */
async function fetchYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`
    + `?range=${YEARS}y&interval=1d&events=div%2Csplit`;
  const json = JSON.parse(await getText(url));
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error('chart result 없음');
  const ts = r.timestamp || [];
  // 배당·분할 보정된 종가를 우선 사용 (없으면 원종가)
  const adj = r.indicators?.adjclose?.[0]?.adjclose;
  const raw = r.indicators?.quote?.[0]?.close;
  const closes = adj && adj.some((v) => v != null) ? adj : raw;
  if (!ts.length || !closes) throw new Error('시계열 비어있음');
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    out.push({ d: fmtDate(ts[i] * 1000), c });
  }
  return out;
}

/** Stooq CSV 폴백 (미국 종목) */
const STOOQ_INDEX = { '^GSPC': '^spx' };   // stooq 는 지수 티커 체계가 달라 별도 매핑
async function fetchStooq(ticker) {
  const sym = STOOQ_INDEX[ticker] || (ticker.startsWith('^') ? null : ticker.toLowerCase() + '.us');
  if (!sym) throw new Error('stooq 심볼 매핑 없음: ' + ticker);
  const csv = await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`);
  const lines = csv.trim().split('\n');
  if (lines.length < 50 || !/^Date/i.test(lines[0])) throw new Error('stooq CSV 형식 이상');
  const cut = new Date(Date.now() - YEARS * 365.25 * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const line of lines.slice(1)) {
    const p = line.split(',');
    const d = p[0], c = parseFloat(p[4]);
    if (!d || d < cut || !Number.isFinite(c)) continue;
    out.push({ d, c });
  }
  return out;
}

/* ── 네이버 금융 폴백 (한국 종목) ──
 * Yahoo 가 러너 IP를 막을 경우를 대비한 국내 소스.
 * 주의: 네이버 시세는 액면분할·유상증자는 반영된 수정주가지만 **배당은 반영하지 않는다**
 *   (Yahoo adjclose 는 배당까지 반영). 국내 배당수익률(연 2% 안팎)만큼
 *   장기 수익률이 과소평가되므로, 폴백이 쓰였는지 결과 JSON의 source 로 노출한다.
 */
const NAVER_INDEX = { '^KS11': 'KOSPI', '^KQ11': 'KOSDAQ' };
const isKoreanTicker = (t) => /\.(KS|KQ)$/i.test(t) || t in NAVER_INDEX;

async function fetchNaver(ticker) {
  const sym = NAVER_INDEX[ticker] || ticker.replace(/\.(KS|KQ)$/i, '');
  if (!/^[A-Z0-9]{5,6}$/i.test(sym)) throw new Error('네이버 종목코드 변환 실패: ' + ticker);
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://api.finance.naver.com/siseJson.naver?symbol=${sym}`
    + `&requestType=1&startTime=${ymd(new Date(Date.now() - YEARS * 365.25 * 864e5))}`
    + `&endTime=${ymd(new Date())}&timeframe=day`;
  return parseNaverSise(await getText(url, { headers: { Referer: 'https://finance.naver.com/' } }));
}

/**
 * 네이버 siseJson 응답 파서.
 * 응답이 작은따옴표를 쓰는 유사 JSON 이라 JSON.parse 가 통하지 않는다:
 *   [['날짜','시가','고가','저가','종가','거래량','외국인소진율'],
 *    ['20200102', 55700, 56400, 55600, 55200, 12993228, 55.77], ...]
 * 따옴표를 치환하는 대신 행 단위로 훑어 날짜·종가만 뽑는다(형식이 조금 변해도 견디도록).
 */
function parseNaverSise(raw) {
  const out = [];
  const rowRe = /\[([^\[\]]*)\]/g;
  let m;
  while ((m = rowRe.exec(raw)) !== null) {
    const cells = m[1].split(',').map((c) => c.trim().replace(/^['"]|['"]$/g, ''));
    if (cells.length < 5) continue;
    if (!/^\d{8}$/.test(cells[0])) continue;          // 헤더 행은 날짜가 아니므로 걸러짐
    const c = parseFloat(cells[4]);                    // 종가
    if (!Number.isFinite(c) || c <= 0) continue;
    out.push({ d: `${cells[0].slice(0, 4)}-${cells[0].slice(4, 6)}-${cells[0].slice(6, 8)}`, c });
  }
  if (!out.length) throw new Error('네이버 응답에서 시세 행을 못 찾음');
  out.sort((a, b) => a.d.localeCompare(b.d));
  return out;
}

/** Yahoo → (한국) 네이버 / (미국) Stooq 순으로 시도 */
async function fetchPrices(ticker) {
  const errs = [];
  const attempt = async (label, fn) => {
    if (isSourceDead(label)) { errs.push(`${label}: 연속 실패로 건너뜀`); return null; }
    try {
      const s = await fn(ticker);
      if (s.length >= 120) { noteSource(label, true); return { series: s, source: label }; }
      throw new Error(`데이터 부족(${s.length}일)`);
    } catch (e) {
      noteSource(label, false);
      errs.push(`${label}: ${e.message}`);
      return null;
    }
  };
  return (await attempt('yahoo', fetchYahoo))
    || (isKoreanTicker(ticker) ? await attempt('naver', fetchNaver) : await attempt('stooq', fetchStooq))
    || (() => { throw new Error(errs.join(' / ')); })();
}

/* ── FRED ──
 * 원래는 키가 필요 없는 fredgraph.csv 를 썼으나, **GitHub Actions 러너에서
 * fred.stlouisfed.org 가 통째로 타임아웃**하는 것을 진단으로 확인했다
 * (scripts/probe-sources.js). 반면 공식 API 호스트 api.stlouisfed.org 는
 * 도달 가능하다(키 없이 호출하면 HTTP 400 이 돌아옴 = 네트워크는 뚫림).
 * 그래서 FRED_API_KEY 가 있으면 공식 API 를, 없으면 기존 CSV 를 쓴다.
 * 키는 https://fredaccount.stlouisfed.org/apikeys 에서 무료 발급.
 */
const FRED_KEY = process.env.FRED_API_KEY || '';

async function fetchFred(seriesId) {
  if (FRED_KEY) {
    try { return await fetchFredApi(seriesId); }
    catch (e) { /* 키가 잘못됐을 수 있으니 CSV 로도 한 번 시도 */ }
  }
  return fetchFredCsv(seriesId);
}

/** FRED 공식 API (api.stlouisfed.org, 무료 키 필요) */
async function fetchFredApi(seriesId) {
  const start = new Date(Date.now() - (YEARS + 1) * 365.25 * 864e5).toISOString().slice(0, 10);
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}`
    + `&api_key=${FRED_KEY}&file_type=json&observation_start=${start}`;
  const json = JSON.parse(await getText(url));
  if (!Array.isArray(json.observations)) throw new Error(json.error_message || 'observations 없음');
  const out = [];
  for (const o of json.observations) {
    const c = parseFloat(o.value);        // 결측은 '.' → NaN
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !Number.isFinite(c)) continue;
    out.push({ d: o.date, c });
  }
  if (!out.length) throw new Error('유효 관측치 0');
  return out;
}

/** FRED fredgraph.csv (API 키 불필요, 단 러너에서는 차단됨) → [{d, c}] */
async function fetchFredCsv(seriesId) {
  const csv = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`);
  const lines = csv.trim().split('\n');
  if (lines.length < 50) throw new Error('CSV 너무 짧음');
  const cut = new Date(Date.now() - (YEARS + 1) * 365.25 * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const line of lines.slice(1)) {
    const p = line.split(',');
    const d = (p[0] || '').trim();
    const c = parseFloat((p[1] || '').trim()); // 결측은 '.' → NaN
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < cut || !Number.isFinite(c)) continue;
    out.push({ d, c });
  }
  if (!out.length) throw new Error('유효 관측치 0');
  return out;
}

/* ── FRED 가 막혔을 때 쓰는 Yahoo 대체 지표 ──
 * 뜻과 크기가 충분히 가까운 것만 넣는다. 인플레이션·디플레이션 계열
 * (기대인플레·실질금리·신용스프레드·정책불확실성)은 Yahoo 에 대응물이 없어
 * FRED 키 없이는 검증할 수 없다.
 */
const MACRO_PROXY = {
  VIXCLS:     { t: '^VIX',      note: '동일 지표(Yahoo 시세)' },
  DCOILWTICO: { t: 'CL=F',      note: 'WTI 현물 대신 근월 선물' },
  DEXKOUS:    { t: 'KRW=X',     note: '동일 환율(Yahoo 시세)' },
  DTWEXBGS:   { t: 'DX-Y.NYB',  note: '광의 달러지수 대신 DXY(주요 6개 통화)' },
};

/* ────────────────────────────── 통계 ────────────────────────────── */

/** 일별 시계열 → 금요일(주 마지막 거래일) 기준 주간 시계열 Map(weekKey → close) */
function toWeekly(series) {
  const m = new Map();
  for (const p of series) {
    const dt = new Date(p.d + 'T00:00:00Z');
    // ISO 주차 키: 그 주의 목요일 날짜로 통일 (연말 경계 안전)
    const day = (dt.getUTCDay() + 6) % 7; // 월=0
    const thu = new Date(dt.getTime() + (3 - day) * 864e5);
    m.set(thu.toISOString().slice(0, 10), p.c); // 같은 주는 뒤쪽(최신)이 덮어씀
  }
  return m;
}

/** 단순 OLS y = a + b·x */
function ols(xs, ys) {
  const n = xs.length;
  if (n < 10) return null;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return null;
  const b = sxy / sxx;
  const a = my - b * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) { const e = ys[i] - (a + b * xs[i]); sse += e * e; }
  const r2 = 1 - sse / syy;
  const se = Math.sqrt(sse / (n - 2) / sxx);
  const t = se > 0 ? b / se : 0;
  return { n, a, b, r2, t, sdx: Math.sqrt(sxx / (n - 1)) };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 이론 적합도 점수 0~100.
 *  - 통계적 유의성(|t|), 설명력(R²), 방향 적중률(hit) 을 가중합
 *  - 이론이 예측한 부호와 반대로 나오면 점수를 크게 깎는다(= "덜 맞는 이론"으로 밀려남)
 */
function fitScore({ t, r2, hit, b }, expect) {
  const sig = clamp01(Math.abs(t) / 3);        // |t|=3 이상이면 만점
  const exp = clamp01(r2 / 0.12);              // 주간 단일인자 R² 12%면 만점(현실적으로 매우 높음)
  const acc = clamp01((hit - 0.5) / 0.15);     // 적중률 65%면 만점
  const agree = Math.sign(b) === Math.sign(expect);
  const base = 0.45 * sig + 0.25 * exp + 0.30 * acc;
  return Math.round(100 * base * (agree ? 1 : 0.2));
}

/** 종목 하나 × 이론 하나 검증 */
function testTheory(stockWeekly, factorWeekly, theory) {
  const keys = [...stockWeekly.keys()].filter((k) => factorWeekly.has(k)).sort();
  const xs = [], ys = [];
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1], k1 = keys[i];
    const p0 = stockWeekly.get(k0), p1 = stockWeekly.get(k1);
    const f0 = factorWeekly.get(k0), f1 = factorWeekly.get(k1);
    if (!(p0 > 0 && p1 > 0)) continue;
    let dx;
    if (theory.kind === 'rate') dx = f1 - f0;                     // %p 변화
    else { if (!(f0 > 0 && f1 > 0)) continue; dx = Math.log(f1 / f0) * 100; } // % 변화
    if (!Number.isFinite(dx)) continue;
    ys.push(Math.log(p1 / p0) * 100);
    xs.push(dx);
  }
  // 최근 REG_WEEKS 개만 사용
  const x = xs.slice(-REG_WEEKS), y = ys.slice(-REG_WEEKS);
  if (x.length < MIN_WEEKS) return null;

  const r = ols(x, y);
  if (!r) return null;

  // 방향 적중률: 인자가 뚜렷하게 움직인 주(상위 절반 변동)만 대상으로,
  // 이론이 예측한 방향으로 주가가 움직였는지
  const mag = x.map(Math.abs).sort((p, q) => p - q);
  const thr = mag[Math.floor(mag.length / 2)] || 0;
  let hitN = 0, hitD = 0;
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) < thr || x[i] === 0 || y[i] === 0) continue;
    hitD++;
    if (Math.sign(x[i]) * Math.sign(y[i]) === Math.sign(theory.expect)) hitN++;
  }
  const hit = hitD >= 10 ? hitN / hitD : 0.5;

  // beta 를 "인자가 1 표준편차 움직였을 때 주간 수익률 %p" 로 환산 (종목 간 비교 가능하게)
  const betaSd = r.b * r.sdx;

  return {
    theory: theory.key,
    n: r.n,
    beta: round(betaSd, 3),        // %p / 1σ
    beta_raw: round(r.b, 4),       // %p per unit
    t: round(r.t, 2),
    r2: round(r.r2 * 100, 2),      // %
    hit: round(hit * 100, 1),      // %
    agree: Math.sign(r.b) === Math.sign(theory.expect),
    score: fitScore({ t: r.t, r2: r.r2, hit, b: r.b }, theory.expect),
  };
}

/* ────────────────────────────── 백테스트 ────────────────────────────── */

function sma(arr, i, n) {
  if (i + 1 < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
}

/** 최근 win개 관측치 안에서 arr[i]가 몇 번째 위치인지(0~1). 표본 부족하면 null */
function trailingPct(arr, i, win) {
  const cur = arr[i];
  if (cur == null) return null;
  let cnt = 0, tot = 0;
  for (let k = Math.max(0, i - win + 1); k <= i; k++) {
    const v = arr[k];
    if (v == null) continue;
    tot++;
    if (v <= cur) cnt++;
  }
  return tot >= 60 ? cnt / tot : null;
}

function rsi14(closes) {
  const out = new Array(closes.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= 14) { ag += g / 14; al += l / 14; if (i === 14) out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
    else { ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
  }
  return out;
}

/** 일별 비중(0~1) 배열 → 성과지표 */
function evaluate(dates, closes, weights) {
  const eq = [1];
  let exposure = 0;
  for (let i = 1; i < closes.length; i++) {
    const w = weights[i - 1] ?? 0;      // 전일 종가 기준 신호로 당일 보유 (룩어헤드 방지)
    exposure += w;
    const r = closes[i] / closes[i - 1] - 1;
    eq.push(eq[eq.length - 1] * (1 + w * r));
  }
  const n = closes.length - 1;
  if (n < 250) return null;
  const years = n / 252;
  const total = eq[eq.length - 1];
  const cagr = (total ** (1 / years) - 1) * 100;
  let peak = eq[0], mdd = 0;
  for (const v of eq) { if (v > peak) peak = v; const dd = v / peak - 1; if (dd < mdd) mdd = dd; }
  const rets = [];
  for (let i = 1; i < eq.length; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mu) ** 2, 0) / (rets.length - 1));
  const sharpe = sd > 0 ? (mu / sd) * Math.sqrt(252) : 0;
  // 월간 승률
  const byMonth = new Map();
  for (let i = 1; i < eq.length; i++) byMonth.set(dates[i].slice(0, 7), eq[i]);
  const mv = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((e) => e[1]);
  let win = 0;
  for (let i = 1; i < mv.length; i++) if (mv[i] > mv[i - 1]) win++;
  return {
    cagr: round(cagr, 2),
    mdd: round(mdd * 100, 2),
    sharpe: round(sharpe, 2),
    winrate: mv.length > 1 ? round((win / (mv.length - 1)) * 100, 1) : null,
    exposure: round((exposure / n) * 100, 1),
    total: round((total - 1) * 100, 2),
    equity: eq,
  };
}

function buildWeights(key, dates, closes, macroDaily) {
  const N = closes.length;
  const w = new Array(N).fill(0);
  const r = key === 'rsi' ? rsi14(closes) : null;
  // 매크로 필터용: 날짜에 맞춘 인자 배열 (없는 날은 null)
  const vixArr = key === 'macro' ? dates.map((d) => macroDaily.vix.get(d) ?? null) : null;
  const curveArr = key === 'macro' ? dates.map((d) => macroDaily.curve.get(d) ?? null) : null;

  // 12-1 모멘텀 / 매크로 필터용: 월초 여부
  const isMonthStart = dates.map((d, i) => i === 0 || d.slice(0, 7) !== dates[i - 1].slice(0, 7));
  let momHold = 0;

  for (let i = 0; i < N; i++) {
    switch (key) {
      case 'bh': w[i] = 1; break;
      case 'ma200': {
        const m = sma(closes, i, 200);
        w[i] = m == null ? 0 : (closes[i] > m ? 1 : 0);
        break;
      }
      case 'cross': {
        const f = sma(closes, i, 50), s = sma(closes, i, 200);
        w[i] = (f == null || s == null) ? 0 : (f > s ? 1 : 0);
        break;
      }
      case 'mom12': {
        if (isMonthStart[i]) {
          const a = i - 21, b = i - 252;           // 최근 1개월 제외한 12개월 수익
          momHold = (b >= 0 && closes[a] > closes[b]) ? 1 : 0;
        }
        w[i] = momHold;
        break;
      }
      case 'rsi': {
        const v = r[i];
        const prev = i > 0 ? w[i - 1] : 0;
        if (v == null) w[i] = 0;
        else if (v < 30) w[i] = 1;
        else if (v > 70) w[i] = 0;
        else w[i] = prev;
        break;
      }
      case 'voltgt': {
        if (i < 21) { w[i] = 0; break; }
        let s = 0;
        for (let k = i - 19; k <= i; k++) s += (closes[k] / closes[k - 1] - 1) ** 2;
        const vol = Math.sqrt(s / 20) * Math.sqrt(252);
        w[i] = vol > 0 ? Math.max(0, Math.min(1, 0.20 / vol)) : 0; // 연 20% 변동성 목표
        break;
      }
      case 'macro': {
        // 'VIX < 20' 같은 절대 임계값은 국면이 바뀌면 아예 안 걸리거나 늘 걸린다
        // (고금리 국면에선 금리차가 계속 음수라 신호가 영구히 죽는다).
        // 그래서 "최근 1년 대비 어느 위치인가"라는 상대 기준을 쓴다.
        const vp = trailingPct(vixArr, i, 252);      // 낮을수록 평온
        const cp = trailingPct(curveArr, i, 252);    // 낮을수록 침체 경보
        const m = sma(closes, i, 200);
        const trendOk = m != null && closes[i] > m;
        if (vp == null || cp == null) { w[i] = i > 0 ? w[i - 1] : 0; break; }
        w[i] = (vp <= 0.5 && cp >= 0.2 && trendOk) ? 1 : 0;
        break;
      }
      default: w[i] = 0;
    }
  }
  return w;
}

/** 날짜별 최근값 채우기(forward fill) Map */
function forwardFill(series, dates) {
  const src = new Map(series.map((p) => [p.d, p.c]));
  const out = new Map();
  let last = null;
  for (const d of dates) {
    if (src.has(d)) last = src.get(d);
    if (last != null) out.set(d, last);
  }
  return out;
}

/* ────────────────────────────── 메인 ────────────────────────────── */
async function main() {
  console.log('▶ 매크로 인자 수집 (FRED)');
  const factors = {};
  const seriesIds = [...new Set(THEORIES.map((t) => t.series))];
  for (const id of seriesIds) {
    if (isSourceDead('fred')) { warn(`FRED ${id}: 연속 실패로 건너뜀`); continue; }
    try {
      factors[id] = await fetchFred(id);
      noteSource('fred', true);
      console.log(`  · ${id}: ${factors[id].length}건 (최근 ${factors[id][factors[id].length - 1].d})`);
    } catch (e) {
      noteSource('fred', false);
      warn(`FRED ${id} 수집 실패: ${e.message}`);
    }
    await sleep(300);
  }
  // FRED 로 못 받은 지표는 Yahoo 대체 지표로 메운다 (가능한 것만)
  const proxied = new Set();
  for (const id of seriesIds) {
    if (factors[id] || !MACRO_PROXY[id]) continue;
    try {
      const { series } = await fetchPrices(MACRO_PROXY[id].t);
      factors[id] = series;
      proxied.add(id);
      console.log(`  · ${id}: ${series.length}건 (대체지표 ${MACRO_PROXY[id].t})`);
    } catch (e) {
      warn(`${id} 대체지표(${MACRO_PROXY[id].t}) 도 실패: ${e.message}`);
    }
    await sleep(250);
  }
  const missing = seriesIds.filter((id) => !factors[id]);
  if (missing.length) {
    warn(`대체 지표가 없어 검증 불가한 이론: ${THEORIES.filter((t) => missing.includes(t.series))
      .map((t) => t.name).join(', ')} (FRED_API_KEY 를 등록하면 복구됩니다)`);
  }

  // 매크로 인자가 하나도 없으면 이론 검증이 불가능하다 — 빈 결과를 쓰느니 실패시켜
  // 기존 data/stocks.json 을 그대로 보존한다.
  if (!Object.keys(factors).length) {
    throw new Error('매크로 인자를 한 건도 못 받았습니다 (FRED·대체지표 모두 도달 불가) — 이론 검증 불가');
  }

  console.log('▶ 주가 수집');
  const priced = [];
  const deadline = Date.now() + BUDGET_MS;
  for (const s of [...UNIVERSE, ...BENCHMARKS.map((b) => ({ ...b, theme: '__bench__', rank: 0 }))]) {
    if (Date.now() > deadline) {
      warn(`시간 예산 ${BUDGET_MS / 60e3}분 초과 — 남은 종목 수집을 중단합니다`);
      break;
    }
    try {
      const { series, source } = await fetchPrices(s.t);
      priced.push({ ...s, series, source });
      console.log(`  · ${s.t} ${s.name || ''}: ${series.length}일 (${source})`);
    } catch (e) {
      warn(`${s.t} (${s.name}) 주가 수집 실패: ${e.message}`);
    }
    await sleep(250);
  }
  if (!priced.length) throw new Error('주가를 한 건도 못 받았습니다 — 기존 데이터를 유지합니다');

  // 백테스트용 매크로 일별 맵 (VIX, 금리차)
  const allDates = [...new Set(priced.flatMap((p) => p.series.map((x) => x.d)))].sort();
  const macroDaily = {
    vix: forwardFill(factors['VIXCLS'] || [], allDates),
    curve: forwardFill(factors['T10Y2Y'] || [], allDates),
  };

  console.log('▶ 이론 검증 + 백테스트');
  const factorWeekly = {};
  for (const [id, s] of Object.entries(factors)) factorWeekly[id] = toWeekly(s);

  const stocks = [];
  for (const p of priced) {
    if (p.theme === '__bench__') continue;
    const weekly = toWeekly(p.series);
    const closes = p.series.map((x) => x.c);
    const dates = p.series.map((x) => x.d);

    // 이론 적합도
    const fits = [];
    for (const th of THEORIES) {
      if (th.scope === 'KR' && p.market !== 'KR') continue;
      if (!factorWeekly[th.series]) continue;
      const res = testTheory(weekly, factorWeekly[th.series], th);
      if (res) fits.push(res);
    }
    fits.sort((a, b) => b.score - a.score);

    // 전략 백테스트
    const strategies = {};
    for (const sd of STRATEGY_DEFS) {
      const w = buildWeights(sd.key, dates, closes, macroDaily);
      const ev = evaluate(dates, closes, w);
      if (ev) { delete ev.equity; strategies[sd.key] = ev; }
    }

    // 스파크라인용 주간 종가 (최근 3년)
    const wk = [...weekly.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-157);

    const last = closes[closes.length - 1];
    const at = (back) => closes[Math.max(0, closes.length - 1 - back)];
    stocks.push({
      ticker: p.t, name: p.name, market: p.market, theme: p.theme, rank: p.rank, why: p.why,
      source: p.source,
      last: round(last, 2),
      chg1d: round((last / at(1) - 1) * 100, 2),
      chg1m: round((last / at(21) - 1) * 100, 2),
      chg1y: closes.length > 252 ? round((last / at(252) - 1) * 100, 2) : null,
      days: closes.length,
      spark: wk.map((e) => round(e[1], 2)),
      spark_from: wk.length ? wk[0][0] : null,
      fits,
      best3: fits.slice(0, 3).map((f) => f.theory),
      worst3: fits.slice(-3).reverse().map((f) => f.theory),
      strategies,
    });
  }

  // 벤치마크
  const benches = priced.filter((p) => p.theme === '__bench__').map((p) => {
    const closes = p.series.map((x) => x.c);
    const dates = p.series.map((x) => x.d);
    const ev = evaluate(dates, closes, new Array(closes.length).fill(1));
    if (ev) delete ev.equity;
    return { ticker: p.t, name: p.name, market: p.market, last: round(closes[closes.length - 1], 2), buyhold: ev };
  });

  // 테마별 / 전체 이론 랭킹 (종목별 점수의 평균)
  function rankTheories(list) {
    const agg = new Map();
    for (const s of list) for (const f of s.fits) {
      if (!agg.has(f.theory)) agg.set(f.theory, { theory: f.theory, sum: 0, n: 0, agreeN: 0, r2: 0, t: 0 });
      const a = agg.get(f.theory);
      a.sum += f.score; a.n++; a.r2 += f.r2; a.t += Math.abs(f.t); if (f.agree) a.agreeN++;
    }
    const arr = [...agg.values()]
      .filter((a) => a.n >= 3)
      .map((a) => ({
        theory: a.theory, score: round(a.sum / a.n, 1), n: a.n,
        avg_r2: round(a.r2 / a.n, 2), avg_absT: round(a.t / a.n, 2),
        agree_pct: round((a.agreeN / a.n) * 100, 1),
      }))
      .sort((x, y) => y.score - x.score);
    return { best: arr.slice(0, 3), worst: arr.slice(-3).reverse(), all: arr };
  }

  const themes = [...new Set(UNIVERSE.map((u) => u.theme))];
  const themeRank = {};
  for (const th of themes) themeRank[th] = rankTheories(stocks.filter((s) => s.theme === th));
  const overall = rankTheories(stocks);

  // 전략 랭킹 (종목 평균)
  const stratAgg = STRATEGY_DEFS.map((sd) => {
    const rows = stocks.map((s) => s.strategies[sd.key]).filter(Boolean);
    const bh = stocks.map((s) => s.strategies.bh).filter(Boolean);
    const avg = (f) => rows.length ? round(rows.reduce((a, r) => a + (r[f] ?? 0), 0) / rows.length, 2) : null;
    const bhCagr = bh.length ? bh.reduce((a, r) => a + (r.cagr ?? 0), 0) / bh.length : 0;
    return {
      key: sd.key, name: sd.name, popular: sd.popular, kid: sd.kid, n: rows.length,
      cagr: avg('cagr'), mdd: avg('mdd'), sharpe: avg('sharpe'),
      winrate: avg('winrate'), exposure: avg('exposure'),
      vs_bh: rows.length ? round(avg('cagr') - bhCagr, 2) : null,
    };
  }).sort((a, b) => (b.sharpe ?? -99) - (a.sharpe ?? -99));

  // 매크로 현황판
  const macro = THEORIES.map((th) => {
    const s = factors[th.series];
    if (!s || !s.length) return null;
    const last = s[s.length - 1];
    const back = (n) => s[Math.max(0, s.length - 1 - n)]?.c;
    const win = s.slice(-756).map((p) => p.c).sort((a, b) => a - b);
    const pct = win.length ? (win.filter((v) => v <= last.c).length / win.length) * 100 : null;
    return {
      key: th.key, series: th.series, name: th.name, short: th.short,
      proxy: proxied.has(th.series) ? MACRO_PROXY[th.series].note : null,
      date: last.d, value: round(last.c, 3),
      chg1m: round(last.c - (back(21) ?? last.c), 3),
      chg3m: round(last.c - (back(63) ?? last.c), 3),
      pct3y: round(pct, 0),
      unit: th.kind === 'rate' ? '%' : '',
    };
  }).filter(Boolean);

  for (const [label, h] of Object.entries(sourceHealth)) {
    if (isSourceDead(label)) warn(`${label} 소스가 응답하지 않아 ${h.fail}회 실패 후 건너뛰었습니다`);
  }

  // 어떤 소스가 쓰였는지 집계 — 폴백이 돌면 데이터 성격이 달라지므로 화면에 노출한다
  const sourceSummary = {};
  for (const p of priced) sourceSummary[p.source] = (sourceSummary[p.source] || 0) + 1;

  const payload = {
    updated_at: new Date().toISOString(),
    as_of: allDates.length ? allDates[allDates.length - 1] : null,
    disclaimer: '이 페이지는 과거 데이터로 이론의 설명력을 측정한 통계 결과입니다. 투자 자문이 아니며, 과거 적합도는 미래 수익을 보장하지 않습니다.',
    method: {
      regression: `주간(금~금) 로그수익률을 매크로 인자 변화에 단순회귀. 최근 ${REG_WEEKS}주(3년), 최소 ${MIN_WEEKS}주 필요.`,
      score: '점수 = 0.45×유의성(|t|/3) + 0.25×설명력(R²/12%) + 0.30×방향적중률((hit−50%)/15%). 이론이 예측한 부호와 반대면 ×0.2 감점.',
      backtest: `일별 종가, 최근 ${YEARS}년. 전일 신호로 당일 보유(룩어헤드 방지). 거래비용·세금 미반영.`,
      sources: 'Yahoo Finance(배당·분할 보정 종가) 우선, 실패 시 한국 종목은 네이버 금융 · 미국 종목은 Stooq 로 폴백.',
      naver_caveat: '네이버 시세는 액면분할은 반영하지만 배당은 반영하지 않습니다. 네이버로 폴백된 종목은 배당수익률(국내 연 2% 안팎)만큼 장기 수익률이 실제보다 낮게 잡힙니다.',
    },
    source_summary: sourceSummary,
    theories: THEORIES.map((t) => ({
      key: t.key, name: t.name, academic: t.academic, series: t.series,
      expect: t.expect, scope: t.scope, short: t.short, kid: t.kid,
      unit: t.kind === 'rate' ? '%p' : '%',
    })),
    strategy_defs: STRATEGY_DEFS,
    macro,
    stocks,
    benchmarks: benches,
    theme_rank: themeRank,
    overall_rank: overall,
    strategy_rank: stratAgg,
    warnings,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 1));
  console.log(`\n✔ 저장: ${OUT_PATH}`);
  console.log(`  종목 ${stocks.length}개 / 이론 ${macro.length}개 / 경고 ${warnings.length}건`);
  if (overall.best.length) {
    console.log('  가장 잘 맞는 이론 TOP3: ' + overall.best.map((b) => `${b.theory}(${b.score})`).join(', '));
    console.log('  덜 맞는 이론 TOP3: ' + overall.worst.map((b) => `${b.theory}(${b.score})`).join(', '));
  }
  if (stratAgg.length) console.log('  샤프 1위 전략: ' + stratAgg[0].name + ' (' + stratAgg[0].sharpe + ')');
}

if (require.main === module) {
  main().catch((e) => {
    console.error('✖ 실패:', e.message);
    // 기존 파일이 있으면 updated_at 만 갱신하고 유지 (데이터 파괴 방지)
    try {
      if (fs.existsSync(OUT_PATH)) {
        const old = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
        old.updated_at = new Date().toISOString();
        old.last_error = e.message;
        fs.writeFileSync(OUT_PATH, JSON.stringify(old, null, 1));
        console.error('  기존 data/stocks.json 유지 (updated_at만 갱신)');
        process.exit(0);
      }
    } catch (_) { /* noop */ }
    process.exit(1);
  });
}

module.exports = { main, ols, trailingPct, getText, fetchFredApi, MACRO_PROXY, isSourceDead, noteSource, sourceHealth, parseNaverSise, fetchNaver, fetchPrices, isKoreanTicker, toWeekly, testTheory, evaluate, buildWeights, fitScore, rsi14, sma, forwardFill, fetchFred, fetchYahoo, THEORIES, STRATEGY_DEFS, UNIVERSE, BENCHMARKS, OUT_PATH };
