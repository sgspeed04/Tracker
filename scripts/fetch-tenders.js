/**
 * 계량기(전기/가스/수도) 입찰 자동수집 — 다국가 파일럿
 *
 * ── 배경 ──────────────────────────────────────────────────────────────────
 *  인도 CPPP 파일럿(구 fetch-india-tenders.js)이 실제 GitHub Actions에서
 *  정상 동작하는 것을 확인한 뒤(table.list_table tbody tr 선택자가 실제로
 *  맞아떨어짐), 같은 접근을 나머지 국가로 확장한 것이 이 스크립트다.
 *
 *  여기 나열된 대상 대부분은 이 세션의 네트워크 정책상 실제 HTML을 한
 *  번도 보지 못한 채(홈페이지 접근 자체가 막힘) 선택자를 추측으로
 *  작성했다 — 인도 GeM이 그랬던 것처럼 데이터센터 IP를 막는 WAF가 있는
 *  사이트는 GitHub Actions에서도 계속 실패할 수 있다. 실패한 대상은
 *  자동으로 스킵되고 기존 데이터를 덮어쓰지 않으므로, 각 대상이 실제로
 *  동작하는지는 Actions 로그에서 국가별로 확인해야 한다(0건이면 진단
 *  로그가 남는다).
 * ─────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DATA_FILE = path.join(__dirname, '..', 'data', 'tender_candidates.json');
const TODAY = new Date().toISOString().split('T')[0];

const EN_METER_KEYWORDS = ['meter', 'metering', 'ami', 'amr'];

const TARGETS = [
  {
    country: '인도', source: 'CPPP',
    url: 'https://eprocure.gov.in/eprocure/app?page=FrontEndLatestActiveTenders&service=page',
    keywords: EN_METER_KEYWORDS,
  },
  {
    country: '인도', source: 'GeM',
    url: 'https://bidplus.gem.gov.in/all-bids',
    keywords: EN_METER_KEYWORDS,
  },
  {
    country: '베트남', source: 'VNEPS',
    url: 'https://muasamcong.mpi.gov.vn/en/web/guest/contractor-selection?render=index',
    keywords: EN_METER_KEYWORDS,
  },
  {
    country: '태국', source: 'PWA (지방 상수도)',
    url: 'https://eprocurement.pwa.co.th/',
    keywords: [...EN_METER_KEYWORDS, 'มิเตอร์'],
  },
  {
    country: '필리핀', source: 'PhilGEPS',
    url: 'https://notices.philgeps.gov.ph/',
    keywords: EN_METER_KEYWORDS,
  },
  {
    country: '인도네시아', source: 'INAPROC',
    url: 'https://inaproc.id/en',
    keywords: EN_METER_KEYWORDS,
  },
  {
    country: '방글라데시', source: 'e-GP',
    url: 'https://www.eprocure.gov.bd/',
    keywords: EN_METER_KEYWORDS,
  },
  {
    country: '파키스탄', source: 'PPRA',
    url: 'https://ppra.gov.pk/',
    keywords: EN_METER_KEYWORDS,
  },
  {
    country: '중국', source: 'CCGP',
    url: 'http://www.ccgp.gov.cn/cggg/zygg/gkzb/',
    keywords: ['电表', '燃气表', '煤气表', '水表'],
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

function matchesKeyword(text, keywords) {
  const lower = (text || '').toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
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

// 대상마다 실제 마크업을 모르므로 후보 선택자를 순서대로 시도하고, 전부
// 실패하면 실제 페이지에 어떤 테이블이 있는지 진단 로그를 남긴다 —
// fetch-violations.js(PropertyLeads)/기존 fetch-india-tenders.js와 동일한 접근.
function parseListHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  let usedSelector = null;
  let rows = $();
  for (const sel of ROW_SELECTORS) {
    const found = $(sel);
    if (found.length > 3) { usedSelector = sel; rows = found; break; }
  }

  console.log(`  [PARSE] 선택자 "${usedSelector}" 로 ${rows.length}개 행 발견`);
  if (rows.length === 0) {
    const tableCounts = new Map();
    $('table').each((_, el) => {
      const id = $(el).attr('id') || $(el).attr('class') || '(no id/class)';
      tableCounts.set(id, $(el).find('tr').length);
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
    if (cells.length < 2) return;
    const rowText = $tr.text().replace(/\s+/g, ' ').trim();
    const link = $tr.find('a[href]').first();
    const title = link.text().trim() || cells.eq(Math.min(2, cells.length - 1)).text().trim();
    const href = link.attr('href');
    if (!title) return;
    items.push({ title, url: href ? absoluteUrl(baseUrl, href) : null, row_text: rowText.slice(0, 300) });
  });
  return items;
}

async function fetchTarget(target) {
  console.log(`[TARGET] ${target.country} / ${target.source} — ${target.url}`);
  let html;
  try {
    html = await fetchRenderedPage(target.url);
  } catch (e) {
    console.warn(`  [${target.country}/${target.source}] 요청 실패: ${e.message}`);
    return [];
  }
  const items = parseListHtml(html, target.url);
  const matched = items.filter(it => matchesKeyword(it.title, target.keywords) || matchesKeyword(it.row_text, target.keywords));
  console.log(`[TARGET] ${target.country}/${target.source} 완료 — 전체 ${items.length}행 중 계량기 관련 ${matched.length}건`);
  return matched.map((it, i) => ({
    id: `${target.country}_${target.source}_${TODAY}_${i}_${Buffer.from(it.url || it.title).toString('base64').slice(0, 10)}`,
    country: target.country,
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

  const matched = [];
  for (const target of TARGETS) {
    try {
      matched.push(...await fetchTarget(target));
    } catch (e) {
      console.error(`[TARGET] ${target.country}/${target.source} 실패: ${e.message}`);
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
