/**
 * 인도 계량기(전기/가스/수도) 입찰 자동수집 — 파일럿 (미검증)
 *
 * ── 배경 ──────────────────────────────────────────────────────────────────
 *  인도 중앙조달포털 CPPP(eprocure.gov.in)와 GeM(bidplus.gem.gov.in)에서
 *  "meter" 관련 입찰 공고를 매일 긁어오는 것이 목표다.
 *
 *  개발 중 두 사이트 모두 이 세션의 프록시/WebFetch 양쪽에서 HTTP 403을
 *  반환했다 — 홈페이지 접근조차 막혀 있어 실제 HTML 구조를 한 번도 보지
 *  못한 채로 이 스크립트를 작성했다. 데이터센터 IP 대역을 막는 WAF로
 *  추정되며(PropertyLeads의 VWorld/Azure IP 차단 사례와 동일 패턴), GitHub
 *  Actions 러너에서도 막힐 가능성이 있다. 실행 결과는 Actions 로그에서
 *  반드시 확인할 것.
 *
 *  검색 폼 파라미터는 사이트 구조를 본 적이 없어 추측이 위험하므로 쓰지
 *  않는다. 대신 로그인 없이 보이는 "최신 공고(Latest Active Tenders)"
 *  목록 페이지를 그대로 가져와 제목에 계량기 관련 키워드가 있는 것만
 *  걸러낸다 — 검색 파라미터 실수로 결과가 조용히 비어버리는 위험을 줄이는
 *  대신, 최신 목록에 없는 과거 공고는 놓칠 수 있다는 트레이드오프.
 *
 *  NIC(National Informatics Centre)의 전자조달 시스템은 여러 인도 정부
 *  포털이 공유하는 공통 플랫폼(JSF 기반)이라, 인도 카르나타카주
 *  eProcurement(별도 검증된 오픈소스 스크래퍼 존재)의 테이블 구조를
 *  참고해 선택자 후보를 만들었다. CPPP가 정확히 같은 컴포넌트 ID를
 *  쓴다는 보장은 없어 선택자 후보 목록 + 진단 로그(fetch-violations.js와
 *  동일 패턴) 방식으로 방어적으로 작성했다.
 * ─────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DATA_FILE = path.join(__dirname, '..', 'data', 'india_tenders.json');
const TODAY = new Date().toISOString().split('T')[0];

const METER_KEYWORDS = [
  'meter', 'ami', 'amr', 'metering',
];

const TARGETS = [
  {
    source: 'CPPP',
    url: 'https://eprocure.gov.in/eprocure/app?page=FrontEndLatestActiveTenders&service=page',
  },
  {
    source: 'GeM',
    url: 'https://bidplus.gem.gov.in/all-bids',
  },
];

const ROW_SELECTORS = [
  'table[id*="tender" i] tbody tr',
  'table tbody[id*="tbody_element" i] tr',
  'table.list_table tbody tr',
  'table.tablebg tr',
  'table tbody tr',
];

function absoluteUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function matchesMeterKeyword(text) {
  const lower = (text || '').toLowerCase();
  return METER_KEYWORDS.some(k => lower.includes(k));
}

const FETCH_TIMEOUT_MS = 30000;

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    const { chromium } = require('playwright');
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}
async function closeBrowser() {
  if (browserPromise) { const b = await browserPromise; await b.close(); browserPromise = null; }
}

async function fetchRenderedPage(url) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: FETCH_TIMEOUT_MS });
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await page.close();
  }
}

// 목록 테이블 파싱 — 어느 선택자가 맞는지 모르므로 후보를 순서대로 시도하고,
// 전부 실패하면 실제 페이지에 어떤 테이블/링크 패턴이 있는지 진단 로그를 남긴다
// (fetch-violations.js와 동일한 접근 — 다음에 수정할 사람이 선택자만 고치면 되게).
function parseListHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  let usedSelector = null;
  let rows = $();
  for (const sel of ROW_SELECTORS) {
    const found = $(sel);
    if (found.length > 3) { usedSelector = sel; rows = found; break; } // 헤더/네비 테이블 오탐 방지로 3행 초과만 인정
  }

  console.log(`  [PARSE] 선택자 "${usedSelector}" 로 ${rows.length}개 행 발견`);
  if (rows.length === 0) {
    const tableCounts = new Map();
    $('table').each((_, el) => {
      const id = $(el).attr('id') || $(el).attr('class') || '(no id/class)';
      const rowCount = $(el).find('tr').length;
      tableCounts.set(id, rowCount);
    });
    console.log(`  [PARSE] 진단: 페이지 내 테이블 ${tableCounts.size}개`);
    [...tableCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .forEach(([id, count]) => console.log(`    ${count}행 — id/class="${id}"`));
    return [];
  }

  const items = [];
  rows.each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find('td');
    if (cells.length < 2) return; // 헤더 행 skip
    const rowText = $tr.text().replace(/\s+/g, ' ').trim();
    const link = $tr.find('a[href]').first();
    const title = link.text().trim() || cells.eq(Math.min(2, cells.length - 1)).text().trim();
    const href = link.attr('href');
    if (!title) return;
    items.push({
      title,
      url: href ? absoluteUrl(baseUrl, href) : null,
      row_text: rowText.slice(0, 300),
    });
  });
  return items;
}

async function fetchTarget(target) {
  console.log(`[TARGET] ${target.source} — ${target.url}`);
  let html;
  try {
    html = await fetchRenderedPage(target.url);
  } catch (e) {
    console.warn(`  [${target.source}] 요청 실패: ${e.message}`);
    return [];
  }
  const items = parseListHtml(html, target.url);
  const matched = items.filter(it => matchesMeterKeyword(it.title) || matchesMeterKeyword(it.row_text));
  console.log(`[TARGET] ${target.source} 완료 — 전체 ${items.length}행 중 계량기 관련 ${matched.length}건`);
  return matched.map((it, i) => ({
    id: `${target.source}_${TODAY}_${i}_${Buffer.from(it.url || it.title).toString('base64').slice(0, 10)}`,
    source: target.source,
    title: it.title,
    url: it.url,
    org: null,
    tender_no: null,
    deadline: null,
    collected_at: TODAY,
  }));
}

async function main() {
  let existing = { updated_at: null, tenders: [] };
  if (fs.existsSync(DATA_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch {}
  }

  let rawAttempted = 0;
  const matched = [];
  for (const target of TARGETS) {
    rawAttempted++;
    try {
      matched.push(...await fetchTarget(target));
    } catch (e) {
      console.error(`[TARGET] ${target.source} 실패: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  await closeBrowser();

  if (matched.length === 0) {
    console.warn('[DONE] 이번 실행에서 계량기 관련 신규 공고를 찾지 못했습니다 (사이트 차단 또는 실제로 없음) — 기존 데이터 유지, updated_at만 갱신.');
    existing.updated_at = TODAY;
    fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), 'utf-8');
    return;
  }

  const byUrl = new Map(existing.tenders.map(t => [t.url || t.id, t]));
  matched.forEach(t => byUrl.set(t.url || t.id, t));

  const merged = { updated_at: TODAY, tenders: [...byUrl.values()] };
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[DONE] 계량기 관련 입찰 후보 누계 ${merged.tenders.length}건 저장 완료 (이번 실행 신규 매칭 ${matched.length}건)`);
}

main().catch(async e => { console.error('오류:', e); await closeBrowser(); process.exit(1); });
