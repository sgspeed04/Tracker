/**
 * 파이프라인 엔드투엔드 검증.
 * 가짜 Yahoo/FRED 응답을 global fetch 로 물려서 fetch-stocks.js 를 통째로 돌린다.
 * 주가에 "알려진 관계"를 심어놓고, 결과 JSON이 그 관계를 되찾아내는지 확인한다.
 */
const path = require('path');
const fs = require('fs');
process.env.STOCKS_OUT = process.env.STOCKS_OUT || require('path').join(require('os').tmpdir(), 'stocks-e2e-test.json');
const M = require('./fetch-stocks.js');

let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const norm = () => { let s = 0; for (let i = 0; i < 12; i++) s += rnd(); return s - 6; };

/* ── 거래일 달력 (5년) ── */
const days = [];
{
  let t = Date.UTC(2021, 7, 1);
  while (days.length < 1290) {
    const d = new Date(t), w = d.getUTCDay();
    if (w !== 0 && w !== 6) days.push(d.toISOString().slice(0, 10));
    t += 864e5;
  }
}
const N = days.length;

/* ── 매크로 인자 생성 (일별 충격 배열도 같이 보관) ── */
const shocks = {};      // 인자별 일별 충격 (주가 생성에 재사용)
const factorPaths = {};
function makeFactor(id, start, vol, kind, lo, hi) {
  const sh = [], path = [];
  let v = start;
  for (let i = 0; i < N; i++) {
    const e = norm();
    sh.push(e);
    if (kind === 'rate') v = Math.max(lo, Math.min(hi, v + vol * e));
    else v = Math.max(lo, Math.min(hi, v * Math.exp(vol * e)));
    path.push(v);
  }
  shocks[id] = sh; factorPaths[id] = path;
}
makeFactor('VIXCLS',     18,  0.030, 'idx',  10, 60);
makeFactor('USEPUINDXD',120,  0.060, 'idx',  40, 400);
makeFactor('DFII10',     1.5, 0.030, 'rate', -1, 3.2);
makeFactor('T5YIE',      2.3, 0.015, 'rate',  1, 3.5);
makeFactor('T10Y2Y',    -0.2, 0.030, 'rate', -1.2, 1.5);
makeFactor('BAA10Y',     2.0, 0.020, 'rate',  1, 4);
makeFactor('DTWEXBGS', 120,   0.003, 'idx', 100, 140);
makeFactor('DCOILWTICO',75,   0.020, 'idx',  30, 130);
makeFactor('DEXKOUS',  1300,  0.004, 'idx',1050,1500);

/* ── 시장 공통 요인 ── */
const mkt = []; for (let i = 0; i < N; i++) mkt.push(norm());

/* ── 주가 생성: 테마별로 "정답 관계"를 심는다 ── */
// AI      → 실질금리(DFII10)에 강하게 마이너스   [정답: realrate]
// 에너지   → 유가(DCOILWTICO)에 강하게 플러스     [정답: oil]
// 로봇     → 정책불확실성(USEPUINDXD)에 마이너스  [정답: epu]
// 자동차   → VIX 에 마이너스                      [정답: vix]
// 환경     → 신용스프레드(BAA10Y)에 마이너스      [정답: credit]
const TRUTH = { 'AI':'realrate', '에너지':'oil', '로봇':'epu', '자동차':'vix', '환경':'credit' };
const LOAD = {
  'AI':      { DFII10:     -0.055 },
  '에너지':   { DCOILWTICO:  0.060 },
  '로봇':     { USEPUINDXD: -0.035 },
  '자동차':   { VIXCLS:     -0.040 },
  '환경':     { BAA10Y:     -0.050 },
};
const prices = {};
function makePrice(ticker, theme, drift) {
  const load = LOAD[theme] || {};
  const arr = []; let p = 100;
  for (let i = 0; i < N; i++) {
    let r = drift + 0.008 * mkt[i] + 0.011 * norm();
    for (const [fid, b] of Object.entries(load)) r += b * shocks[fid][i];
    p *= Math.exp(r);
    arr.push(p);
  }
  prices[ticker] = arr;
}
for (const u of M.UNIVERSE) makePrice(u.t, u.theme, 0.0004 + 0.0002 * (3 - u.rank));
for (const b of M.BENCHMARKS) makePrice(b.t, '__none__', 0.0003);

/* ── 가짜 fetch ── */
let calls = { yahoo: 0, fred: 0, stooq: 0 };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('fredgraph.csv')) {
    calls.fred++;
    const id = u.match(/id=([A-Z0-9]+)/)[1];
    const p = factorPaths[id];
    if (!p) return { ok: false, status: 404, text: async () => '' };
    // 실제 FRED 처럼 결측치를 '.' 으로 섞는다
    const lines = ['observation_date,' + id];
    for (let i = 0; i < N; i++) lines.push(`${days[i]},${i % 37 === 5 ? '.' : p[i].toFixed(4)}`);
    return { ok: true, status: 200, text: async () => lines.join('\n') };
  }
  if (u.includes('query1.finance.yahoo.com')) {
    calls.yahoo++;
    const tk = decodeURIComponent(u.split('/chart/')[1].split('?')[0]);
    const arr = prices[tk];
    if (!arr) return { ok: false, status: 404, text: async () => '' };
    const ts = days.map(d => Date.parse(d + 'T00:00:00Z') / 1000);
    return { ok: true, status: 200, text: async () => JSON.stringify({
      chart: { result: [{ timestamp: ts,
        indicators: { quote: [{ close: arr }], adjclose: [{ adjclose: arr }] } }] } }) };
  }
  calls.stooq++;
  return { ok: false, status: 403, text: async () => '' };
};

/* ── 실행 ── */
(async () => {
  const t0 = Date.now();
  await M.main();
  const D = JSON.parse(fs.readFileSync(M.OUT_PATH, 'utf8'));

  let pass = 0, fail = 0;
  const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✖ ' + m + '  ' + x); } };

  console.log(`\n${'═'.repeat(60)}\n엔드투엔드 검증 (${((Date.now()-t0)/1000).toFixed(1)}초, yahoo ${calls.yahoo}회 / fred ${calls.fred}회)\n${'═'.repeat(60)}`);

  console.log('\n[A] 파싱·수집');
  ok(D.stocks.length === 30, `종목 30개 파싱 (실제 ${D.stocks.length})`);
  ok(D.macro.length === 9, `매크로 9개 파싱 (실제 ${D.macro.length})`);
  ok(D.warnings.length === 0, `경고 0건 (실제 ${D.warnings.length}: ${D.warnings.join('; ')})`);
  ok(D.benchmarks.length === 2, `벤치마크 2개 (실제 ${D.benchmarks.length})`);
  ok(D.stocks.every(s => s.days > 1200), 'FRED 결측치(.)를 건너뛰고도 전 종목 1200일+ 확보');
  ok(D.as_of === days[N-1], `기준일 = 마지막 거래일 (${D.as_of})`);

  console.log('\n[B] 심어둔 관계를 되찾았나 (테마별 정답 이론)');
  for (const [theme, truth] of Object.entries(TRUTH)) {
    const r = D.theme_rank[theme];
    const got = r?.best?.[0]?.theory;
    ok(got === truth, `${theme} 테마 1위 = ${truth} (실제 ${got}, ${r?.best?.[0]?.score}점)`);
  }

  console.log('\n[C] 종목 단위에서도 정답이 1등인가');
  let hit = 0;
  for (const s of D.stocks) if (s.best3[0] === TRUTH[s.theme]) hit++;
  ok(hit >= 27, `30종목 중 ${hit}개에서 정답 이론이 1위`);
  const wrongDirCount = D.stocks.flatMap(s => s.fits).filter(f => !f.agree).length;
  ok(wrongDirCount > 0, `부호 반대 판정이 실제로 작동 (${wrongDirCount}건)`);

  console.log('\n[D] 수치 형태 검증');
  const allFits = D.stocks.flatMap(s => s.fits);
  ok(allFits.every(f => f.score >= 0 && f.score <= 100), '모든 점수가 0~100');
  ok(allFits.every(f => f.r2 >= 0 && f.r2 <= 100), '모든 R²가 0~100%');
  ok(allFits.every(f => f.hit >= 0 && f.hit <= 100), '모든 적중률이 0~100%');
  ok(allFits.every(f => f.n >= 60), '모든 회귀가 최소 관측치 60주 이상');
  ok(D.stocks.every(s => s.spark.length > 100), '스파크라인 주간 데이터 존재');
  const krOnly = allFits.filter(f => f.theory === 'usdkrw');
  const krStocks = D.stocks.filter(s => s.market === 'KR').length;
  ok(krOnly.length === krStocks, `원화 이론은 한국 ${krStocks}종목에만 적용 (실제 ${krOnly.length})`);

  console.log('\n[E] 백테스트 정합성');
  ok(D.strategy_rank.length === 7, `전략 7개 (실제 ${D.strategy_rank.length})`);
  const bh = D.strategy_rank.find(s => s.key === 'bh');
  ok(bh.exposure === 100, `매수후보유 노출 100% (실제 ${bh.exposure}%)`);
  ok(D.strategy_rank.every(s => s.exposure >= 0 && s.exposure <= 100), '모든 전략 노출 0~100%');
  ok(D.strategy_rank.every(s => s.mdd <= 0), '모든 최대낙폭이 0 이하(음수)');
  const ma = D.strategy_rank.find(s => s.key === 'ma200');
  ok(Math.abs(ma.mdd) < Math.abs(bh.mdd), `추세추종 낙폭(${ma.mdd}%)이 보유(${bh.mdd}%)보다 얕음`);
  ok(D.stocks.every(s => Object.keys(s.strategies).length === 7), '전 종목에 7개 전략 결과');

  console.log('\n[F] HTML이 참조하는 필드가 전부 있나');
  const need = ['updated_at','as_of','disclaimer','method','theories','strategy_defs','macro',
                'stocks','benchmarks','theme_rank','overall_rank','strategy_rank','warnings'];
  for (const k of need) if (D[k] == null) ok(false, `최상위 필드 ${k} 누락`);
  ok(true, `최상위 필드 ${need.length}개 모두 존재`);
  ok(D.theories.every(t => t.name && t.kid && t.short && t.academic && t.series && t.unit), '이론 메타 필드 완비');
  ok(D.strategy_defs.every(s => s.name && s.kid && s.popular), '전략 메타 필드 완비');
  ok(D.macro.every(m => m.name && m.value != null && m.pct3y != null), '매크로 카드 필드 완비');
  ok(D.stocks.every(s => s.name && s.ticker && s.theme && s.why && s.last != null && s.best3 && s.worst3), '종목 카드 필드 완비');
  ok(D.overall_rank.best.length === 3 && D.overall_rank.worst.length === 3, '전체 랭킹 best/worst 3개씩');
  ok(D.overall_rank.all.every(r => r.agree_pct != null && r.avg_r2 != null && r.avg_absT != null), '랭킹 보조 수치 완비');

  console.log('\n[G] 결과 미리보기');
  console.log('  전체 1위 이론: ' + D.overall_rank.all.slice(0,3).map(r=>`${r.theory}(${r.score})`).join(', '));
  console.log('  전체 꼴찌 이론: ' + D.overall_rank.worst.map(r=>`${r.theory}(${r.score})`).join(', '));
  console.log('  전략 샤프 순: ' + D.strategy_rank.slice(0,3).map(s=>`${s.name}(${s.sharpe})`).join(', '));
  console.log('  JSON 크기: ' + (fs.statSync(M.OUT_PATH).size/1024).toFixed(0) + ' KB');

  console.log(`\n${'─'.repeat(60)}\n결과: ${pass} 통과 / ${fail} 실패\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('실행 실패:', e); process.exit(1); });
