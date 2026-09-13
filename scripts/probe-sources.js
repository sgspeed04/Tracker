#!/usr/bin/env node
/**
 * probe-sources.js — 데이터 소스 도달성 진단
 *
 * GitHub Actions 러너에서 어떤 호스트가 응답하는지 한 번에 확인한다.
 * (2026-09 최초 실행에서 FRED 가 전부 타임아웃해 수집이 통째로 막힌 적이 있어 추가)
 *
 * 실패해도 워크플로를 멈추지 않는다 — 어디까지나 진단용.
 */
'use strict';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT = 10000;

const TARGETS = [
  ['FRED csv',      'https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS'],
  ['FRED api',      'https://api.stlouisfed.org/fred/series?series_id=VIXCLS&file_type=json'],
  ['Yahoo q1',      'https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=5d&interval=1d'],
  ['Yahoo q2',      'https://query2.finance.yahoo.com/v8/finance/chart/NVDA?range=5d&interval=1d'],
  ['Stooq csv',     'https://stooq.com/q/d/l/?s=nvda.us&i=d'],
  ['Naver siseJson','https://api.finance.naver.com/siseJson.naver?symbol=005930&requestType=1&startTime=20260801&endTime=20260901&timeframe=day'],
  ['Naver fchart',  'https://fchart.stock.naver.com/sise.nhn?symbol=005930&timeframe=day&count=5&requestType=0'],
  ['ECOS(한국은행)',  'https://ecos.bok.or.kr/api/'],
];

(async () => {
  console.log('소스 도달성 진단 (타임아웃 ' + TIMEOUT / 1000 + '초)\n');
  console.log('  ' + '결과'.padEnd(10) + '지연'.padStart(8) + '  ' + '소스'.padEnd(16) + '내용');
  console.log('  ' + '─'.repeat(76));
  for (const [name, url] of TARGETS) {
    const t0 = Date.now();
    let status = '', note = '';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://finance.naver.com/' },
        signal: ctl.signal,
      });
      const body = await res.text();
      status = res.ok ? '✔ OK' : '△ HTTP' + res.status;
      note = `${body.length}바이트 · ${body.slice(0, 48).replace(/\s+/g, ' ')}`;
    } catch (e) {
      status = e.name === 'AbortError' ? '✖ 타임아웃' : '✖ 실패';
      note = e.name === 'AbortError' ? `${TIMEOUT / 1000}초 내 무응답` : (e.cause?.code || e.message);
    } finally {
      clearTimeout(timer);
    }
    console.log('  ' + status.padEnd(10) + (Date.now() - t0 + 'ms').padStart(8) + '  ' + name.padEnd(16) + note);
  }
  console.log('\n※ HTTP 400/403 도 "네트워크는 뚫림"을 뜻함 — 타임아웃만이 진짜 차단.');
})();
