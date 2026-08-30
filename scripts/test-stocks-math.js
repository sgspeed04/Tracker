const M = require('./fetch-stocks.js');
let pass = 0, fail = 0;
const ok = (c, msg, extra='') => { if (c) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✖ ' + msg + '  ' + extra); } };

// 재현 가능한 난수
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const norm = () => { let s = 0; for (let i=0;i<12;i++) s += rnd(); return s - 6; };

console.log('\n[1] OLS — y = 2 + 3x 에 약간의 잡음');
{
  const xs=[], ys=[];
  for (let i=0;i<300;i++){ const x=norm(); xs.push(x); ys.push(2 + 3*x + 0.05*norm()); }
  const r = M.ols(xs, ys);
  ok(Math.abs(r.b-3)<0.02, `기울기 b≈3 (실제 ${r.b.toFixed(4)})`);
  ok(Math.abs(r.a-2)<0.05, `절편 a≈2 (실제 ${r.a.toFixed(4)})`);
  ok(r.r2>0.99, `R²≈1 (실제 ${r.r2.toFixed(4)})`);
  ok(Math.abs(r.t)>50, `t값 매우 큼 (실제 ${r.t.toFixed(1)})`);
}

console.log('\n[2] OLS — 관계 없는 데이터면 t값이 작아야 함');
{
  const xs=[], ys=[];
  for (let i=0;i<300;i++){ xs.push(norm()); ys.push(norm()); }
  const r = M.ols(xs, ys);
  ok(Math.abs(r.t)<3, `무관계 t값 < 3 (실제 ${r.t.toFixed(2)})`);
  ok(r.r2<0.05, `무관계 R² 작음 (실제 ${(r.r2*100).toFixed(2)}%)`);
}

console.log('\n[3] toWeekly — 한 주의 여러 날은 목요일 키 하나로 접힘');
{
  // 2026-08-24(월) ~ 08-28(금)  같은 주
  const s = [{d:'2026-08-24',c:10},{d:'2026-08-26',c:11},{d:'2026-08-28',c:12},{d:'2026-08-31',c:20}];
  const w = M.toWeekly(s);
  ok(w.size===2, `4일 → 2주로 접힘 (실제 ${w.size})`);
  const keys=[...w.keys()].sort();
  ok(w.get(keys[0])===12, `같은 주는 마지막 값 채택 (실제 ${w.get(keys[0])})`);
  ok(new Date(keys[0]+'T00:00:00Z').getUTCDay()===4, `키가 목요일 (실제 요일 ${new Date(keys[0]+'T00:00:00Z').getUTCDay()})`);
}

console.log('\n[4] testTheory — 인자가 오르면 주가가 내리는 종목 (이론 expect=-1)');
{
  const stock=new Map(), factor=new Map();
  let p=100, f=20;
  const d0 = Date.UTC(2020,0,2);
  for (let i=0;i<200;i++){
    const key = new Date(d0 + i*7*864e5).toISOString().slice(0,10);
    const shock = norm();                 // 이번 주 인자 충격
    f = f * Math.exp(0.02*shock);         // 인자 = 지수형
    p = p * Math.exp(-0.03*shock + 0.002*norm()); // 주가는 반대 방향으로 강하게 반응
    factor.set(key,f); stock.set(key,p);
  }
  const thNeg = {key:'x', series:'S', kind:'index', expect:-1};
  const thPos = {key:'y', series:'S', kind:'index', expect: 1};
  const rn = M.testTheory(stock, factor, thNeg);
  const rp = M.testTheory(stock, factor, thPos);
  ok(rn.beta<0, `beta 음수 (실제 ${rn.beta})`);
  ok(rn.agree===true, '부호가 이론(-)과 일치');
  ok(rn.hit>70, `방향 적중률 높음 (실제 ${rn.hit}%)`);
  ok(rn.score>70, `잘 맞는 이론 → 높은 점수 (실제 ${rn.score})`);
  ok(rp.agree===false, '반대 부호 이론은 불일치 판정');
  ok(rp.score < rn.score/3, `반대 이론은 크게 감점 (${rp.score} vs ${rn.score})`);
  ok(rn.r2>50, `설명력 R² 큼 (실제 ${rn.r2}%)`);
}

console.log('\n[5] testTheory — 인자와 무관한 종목이면 점수가 낮아야 함');
{
  const stock=new Map(), factor=new Map();
  let p=100, f=20;
  const d0 = Date.UTC(2020,0,2);
  for (let i=0;i<200;i++){
    const key = new Date(d0 + i*7*864e5).toISOString().slice(0,10);
    f = f*Math.exp(0.02*norm());
    p = p*Math.exp(0.02*norm());
    factor.set(key,f); stock.set(key,p);
  }
  const r = M.testTheory(stock, factor, {key:'x',series:'S',kind:'index',expect:-1});
  ok(r.score<25, `무관계 → 낮은 점수 (실제 ${r.score})`);
}

console.log('\n[6] testTheory — kind:"rate" 는 차분(%p)을 써야 함');
{
  const stock=new Map(), factor=new Map();
  let p=100, f=2.0;
  const d0 = Date.UTC(2020,0,2);
  for (let i=0;i<200;i++){
    const key = new Date(d0 + i*7*864e5).toISOString().slice(0,10);
    const sh = norm()*0.05;      // 금리 변화 %p
    f = f + sh;
    p = p*Math.exp(-4*sh + 0.002*norm()); // 금리 1%p 오르면 주간 -4%
    factor.set(key,f); stock.set(key,p);
  }
  const r = M.testTheory(stock, factor, {key:'r',series:'S',kind:'rate',expect:-1});
  ok(Math.abs(r.beta_raw - (-400))/400 < 0.05, `원계수≈ -400 %/1%p (실제 ${r.beta_raw})`);
  ok(r.agree===true, '부호 일치');
}

console.log('\n[7] evaluate — 매일 정확히 일정 비율로 오르는 주가');
{
  const dates=[], closes=[];
  const daily = Math.pow(1.10, 1/252) - 1;      // 연 10%
  let c=100, t=Date.UTC(2020,0,1);
  for (let i=0;i<252*4;i++){ dates.push(new Date(t+i*864e5).toISOString().slice(0,10)); closes.push(c); c*=1+daily; }
  const ev = M.evaluate(dates, closes, new Array(closes.length).fill(1));
  ok(Math.abs(ev.cagr-10)<0.3, `CAGR≈10% (실제 ${ev.cagr}%)`);
  ok(Math.abs(ev.mdd)<0.01, `하락이 없으니 MDD≈0 (실제 ${ev.mdd}%)`);
  ok(ev.winrate===100, `매달 상승 → 승률 100% (실제 ${ev.winrate}%)`);
  ok(ev.exposure===100, `항상 보유 → 노출 100% (실제 ${ev.exposure}%)`);
}

console.log('\n[8] evaluate — 비중 0이면 수익도 0, 반토막 나면 MDD -50%');
{
  const dates=[], closes=[];
  let t=Date.UTC(2020,0,1);
  for (let i=0;i<252*3;i++){ dates.push(new Date(t+i*864e5).toISOString().slice(0,10)); closes.push(i<378 ? 100 : 50); }
  const flat = M.evaluate(dates, closes, new Array(closes.length).fill(0));
  ok(flat.cagr===0 && flat.mdd===0, `현금만 들면 수익·손실 0 (${flat.cagr}, ${flat.mdd})`);
  const held = M.evaluate(dates, closes, new Array(closes.length).fill(1));
  ok(Math.abs(held.mdd+50)<0.01, `반토막 → MDD -50% (실제 ${held.mdd}%)`);
}

console.log('\n[9] buildWeights — 룩어헤드 없음 / 신호 정확도');
{
  const dates=[], closes=[];
  let t=Date.UTC(2019,0,1);
  // 400일 상승 후 400일 하락
  for (let i=0;i<800;i++){ dates.push(new Date(t+i*864e5).toISOString().slice(0,10)); closes.push(i<400 ? 100+i : 500-(i-400)); }
  const md = {vix:new Map(), curve:new Map()};
  const bh = M.buildWeights('bh', dates, closes, md);
  ok(bh.every(v=>v===1), '매수후보유는 항상 1');
  const ma = M.buildWeights('ma200', dates, closes, md);
  ok(ma.slice(0,199).every(v=>v===0), '200일 평균 나오기 전에는 비중 0 (미래 참조 안 함)');
  ok(ma[300]===1, `상승 구간에서는 보유 (실제 ${ma[300]})`);
  ok(ma[700]===0, `하락 구간에서는 현금 (실제 ${ma[700]})`);
  const ev = M.evaluate(dates, closes, ma);
  const evb = M.evaluate(dates, closes, bh);
  ok(ev.mdd > evb.mdd, `추세추종 MDD(${ev.mdd}%)가 보유(${evb.mdd}%)보다 얕음`);
}

console.log('\n[10] rsi14 — 계속 오르면 100, 계속 내리면 0에 수렴');
{
  const up = Array.from({length:100},(_,i)=>100+i);
  const dn = Array.from({length:100},(_,i)=>200-i);
  const ru = M.rsi14(up), rd = M.rsi14(dn);
  ok(ru[99]>99, `단조 상승 RSI≈100 (실제 ${ru[99].toFixed(1)})`);
  ok(rd[99]<1, `단조 하락 RSI≈0 (실제 ${rd[99].toFixed(1)})`);
  ok(ru[14]!=null && ru[13]==null, 'RSI 첫 값은 14번째 변화량이 모인 index 14부터');
}

console.log('\n[11] sma — 이동평균 값 검증');
{
  const a=[1,2,3,4,5,6,7,8,9,10];
  ok(M.sma(a,9,5)===8, `마지막 5개(6~10) 평균=8 (실제 ${M.sma(a,9,5)})`);
  ok(M.sma(a,2,5)===null, '데이터 부족하면 null');
}

console.log('\n[12] fitScore — 점수 범위와 감점 규칙');
{
  const perfect = M.fitScore({t:5, r2:0.20, hit:0.75, b:-1}, -1);
  const wrongSign = M.fitScore({t:5, r2:0.20, hit:0.75, b: 1}, -1);
  const nothing = M.fitScore({t:0.1, r2:0.001, hit:0.50, b:-1}, -1);
  ok(perfect===100, `완벽하면 100점 (실제 ${perfect})`);
  ok(nothing<5, `설명력 없으면 0점에 가까움 (실제 ${nothing})`);
  ok(wrongSign===20, `부호 반대면 ×0.2 감점 (실제 ${wrongSign})`);
  ok(perfect<=100 && nothing>=0, '0~100 범위 유지');
}

console.log('\n[13] 유니버스 무결성');
{
  const u = M.UNIVERSE;
  ok(u.length===30, `종목 30개 (실제 ${u.length})`);
  ok(new Set(u.map(x=>x.t)).size===30, '티커 중복 없음');
  const themes=[...new Set(u.map(x=>x.theme))];
  ok(themes.length===5, `테마 5개 (${themes.join(',')})`);
  for (const th of themes) for (const mk of ['KR','US']) {
    const g=u.filter(x=>x.theme===th&&x.market===mk);
    if (g.length!==3) ok(false, `${th}/${mk} 3종목이어야 함 (실제 ${g.length})`);
  }
  ok(true, '테마×시장마다 정확히 1~3위 3종목');
  ok(M.THEORIES.length===9, `이론 9개 (실제 ${M.THEORIES.length})`);
  ok(M.THEORIES.every(t=>t.kid && t.kid.length>60), '모든 이론에 쉬운 설명 있음');
  ok(M.STRATEGY_DEFS.length===7, `전략 7개 (실제 ${M.STRATEGY_DEFS.length})`);
}

console.log(`\n${'─'.repeat(46)}\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
