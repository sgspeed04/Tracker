/**
 * 일일 투자 브리핑 자동생성 — Google News RSS → Groq(Llama) → Notion
 *
 * ── 배경 ──────────────────────────────────────────────────────────────────
 *  원래 make.com 노코드 시나리오(RSS → HTTP → JSON Parse → Router → Notion)로
 *  만들었으나, JSON Parse 모듈이 "Source is not valid JSON" / "Validation
 *  failed for 1 parameter(s)" 를 반복해서 냈다. 원인은 두 가지가 겹친 것:
 *
 *    1) Groq가 응답을 ```json 코드펜스로 감싸서 돌려주는 경우가 있음
 *    2) make.com은 모듈을 지우고 다시 만들면 번호가 바뀌는데
 *       (`{{10.Data...}}`), 매핑 문자열은 그대로 남아 조용히 깨짐
 *
 *  둘 다 UI 안에서만 보이는 상태라 디버깅이 어려웠다. 그래서 GitHub Actions로
 *  옮겼다 — 이 저장소가 이미 update-india-tenders.yml로 매일 돌리고 있는,
 *  검증된 방식이다. 코드로 남으니 깨지면 Actions 로그에 원인이 그대로 찍힌다.
 *
 *  마크다운 펜스 문제는 response_format(json_object) + 방어적 스트리핑
 *  두 겹으로 막았다. 모델이 규격을 어겨도 파싱이 살아남게.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 필요한 GitHub Secrets:
 *   GROQ_API_KEY        — console.groq.com 에서 발급 (무료)
 *   NOTION_TOKEN        — notion.so/my-integrations 에서 발급
 *   NOTION_DATABASE_ID  — 투자 브리핑 데이터베이스 ID
 *
 * 로컬 테스트:
 *   node scripts/daily-briefing.js --dry-run     (외부 호출 없이 파싱 로직만)
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'daily_briefing.json');

// KST 기준 날짜 — 러너는 UTC라 그냥 두면 오전 7시 브리핑이 전날 날짜로 찍힌다
const KST_NOW = new Date(Date.now() + 9 * 60 * 60 * 1000);
const TODAY = KST_NOW.toISOString().split('T')[0];

const WATCHLIST = ['삼성전자', 'SK하이닉스', 'TSLA', '비트코인'];

const RSS_URL =
  'https://news.google.com/rss/search?q=' +
  encodeURIComponent('주식 투자 경제') +
  '&hl=ko&gl=KR&ceid=KR:ko';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const NEWS_LIMIT = 12;

// Notion rich_text 한 조각의 최대 길이. 넘으면 API가 400을 낸다
const NOTION_TEXT_CHUNK = 1900;

/* ── RSS ────────────────────────────────────────────────────────────────── */

// 정규식 파싱 — Google News RSS는 구조가 단순하고 고정적이라 XML 파서를
// 새로 물리는 것보다 의존성이 가볍다. <title>은 CDATA로 오기도, 안 오기도 함.
function parseRssTitles(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];

  for (const block of itemBlocks) {
    const raw = block.match(/<title>([\s\S]*?)<\/title>/);
    if (!raw) continue;
    const title = decodeXmlEntities(
      raw[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
    );
    if (title) items.push(title);
  }
  return items;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; 는 마지막 — 먼저 풀면 이중 디코딩이 된다
}

async function fetchNews() {
  console.log(`[RSS] ${RSS_URL}`);
  const res = await fetch(RSS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrackerBot/1.0)' },
  });
  if (!res.ok) throw new Error(`RSS 요청 실패: HTTP ${res.status}`);

  const titles = parseRssTitles(await res.text()).slice(0, NEWS_LIMIT);
  console.log(`[RSS] 뉴스 ${titles.length}건 수집`);
  if (titles.length === 0) throw new Error('RSS에서 뉴스를 한 건도 못 읽었습니다 — 피드 구조 변경 의심');
  return titles;
}

/* ── Groq ───────────────────────────────────────────────────────────────── */

function buildPrompt(newsTitles) {
  return [
    `오늘은 ${TODAY} 입니다.`,
    `관심 종목: ${WATCHLIST.join(', ')}`,
    '',
    '오늘의 뉴스 헤드라인:',
    ...newsTitles.map(t => `- ${t}`),
    '',
    '위 헤드라인을 바탕으로 한국어 투자 브리핑을 작성하세요.',
    '아래 4개 키를 가진 JSON 객체로만 답하세요:',
    '  market    : 시장동향 요약 3~4문장 (문자열)',
    '  news      : 주요 뉴스 3~4개, 각 줄을 "· "로 시작 (문자열)',
    `  stocks    : 관심 종목별 분석, 각 줄을 "▸ "로 시작 (문자열)`,
    '  checklist : 오늘 실행할 액션 3개 (문자열 배열)',
  ].join('\n');
}

// 모델이 규격을 어기는 경우를 흡수한다. response_format을 줘도
// ```json 펜스나 앞뒤 설명이 섞여 나오는 사례가 실제로 있었다.
function extractJson(text) {
  let s = (text || '').trim();

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();

  try {
    return JSON.parse(s);
  } catch {
    // 앞뒤에 산문이 붙은 경우 — 가장 바깥 중괄호 구간만 도려낸다
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(s.slice(start, end + 1));
    }
    throw new Error(`Groq 응답에서 JSON을 찾지 못했습니다. 원문 앞부분: ${s.slice(0, 300)}`);
  }
}

// 어떤 키가 비어도 Notion 쓰기는 성공해야 한다 — 빈 칸이 남는 게
// 워크플로 전체가 실패하는 것보다 낫다
function normalizeBriefing(obj) {
  const str = v => {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean).join('\n');
    if (v == null) return '';
    return String(v).trim();
  };

  const checklist = Array.isArray(obj.checklist)
    ? obj.checklist.map(x => String(x).trim()).filter(Boolean)
    : str(obj.checklist).split('\n').map(s => s.trim()).filter(Boolean);

  return {
    market: str(obj.market),
    news: str(obj.news),
    stocks: str(obj.stocks),
    checklist: checklist.map(s => (s.startsWith('- ') ? s : `- ${s}`)).join('\n'),
  };
}

async function generateBriefing(newsTitles) {
  const apiKey = requireEnv('GROQ_API_KEY');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API. Respond with a single raw JSON object only. No markdown, no code fences, no prose.',
        },
        { role: 'user', content: buildPrompt(newsTitles) },
      ],
      max_tokens: 1500,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Groq 요청 실패: HTTP ${res.status} — ${bodyText.slice(0, 500)}`);
  }

  const content = JSON.parse(bodyText)?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Groq 응답에 content가 없습니다: ${bodyText.slice(0, 500)}`);
  }

  const briefing = normalizeBriefing(extractJson(content));
  console.log(
    `[GROQ] 생성 완료 — 시장동향 ${briefing.market.length}자, ` +
    `뉴스 ${briefing.news.length}자, 종목 ${briefing.stocks.length}자`
  );
  return briefing;
}

/* ── Notion ─────────────────────────────────────────────────────────────── */

// 긴 텍스트는 여러 조각으로 나눠 보낸다. 한 조각이 2000자를 넘으면 400.
function richText(text) {
  const s = text || '';
  if (!s) return [];
  const chunks = [];
  for (let i = 0; i < s.length; i += NOTION_TEXT_CHUNK) {
    chunks.push({ type: 'text', text: { content: s.slice(i, i + NOTION_TEXT_CHUNK) } });
  }
  return chunks;
}

async function saveToNotion(briefing) {
  const token = requireEnv('NOTION_TOKEN');
  const databaseId = requireEnv('NOTION_DATABASE_ID');

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        // 키는 Notion 데이터베이스의 컬럼 이름과 정확히 일치해야 한다
        '투자브리핑': { title: [{ type: 'text', text: { content: TODAY } }] },
        '시장동향': { rich_text: richText(briefing.market) },
        '주요뉴스': { rich_text: richText(briefing.news) },
        '종목분석': { rich_text: richText(briefing.stocks) },
        '체크리스트': { rich_text: richText(briefing.checklist) },
      },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      `Notion 저장 실패: HTTP ${res.status} — ${bodyText.slice(0, 500)}\n` +
      '  → 컬럼 이름(투자브리핑/시장동향/주요뉴스/종목분석/체크리스트)이 일치하는지,\n' +
      '    그리고 데이터베이스가 integration에 공유되어 있는지 확인하세요.'
    );
  }

  console.log(`[NOTION] ${TODAY} 브리핑 저장 완료`);
}

/* ── 저장소 아카이브 ────────────────────────────────────────────────────── */

function archive(briefing, newsTitles) {
  let store = { updated_at: null, briefings: [] };
  if (fs.existsSync(DATA_FILE)) {
    try {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch {
      console.warn('[ARCHIVE] 기존 파일을 읽지 못해 새로 만듭니다');
    }
  }
  if (!Array.isArray(store.briefings)) store.briefings = [];

  store.briefings.unshift({
    date: TODAY,
    generated_at: new Date().toISOString(),
    ...briefing,
    source_headlines: newsTitles,
  });
  store.briefings = store.briefings.slice(0, 180); // 최근 6개월치만 보관
  store.updated_at = TODAY;

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`[ARCHIVE] ${DATA_FILE} 저장 (누계 ${store.briefings.length}건)`);
}

/* ── 실행 ───────────────────────────────────────────────────────────────── */

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다 (GitHub Secrets 확인)`);
  return v;
}

async function main() {
  if (process.argv.includes('--dry-run')) return dryRun();

  // 뉴스를 긁고 AI를 호출한 뒤에야 "키가 없다"고 알면 로그를 거슬러 올라가야 한다.
  // 시작하자마자 한 번에 확인해서 뭐가 빠졌는지 바로 보이게 한다.
  const missing = ['GROQ_API_KEY', 'NOTION_TOKEN', 'NOTION_DATABASE_ID'].filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `GitHub Secrets 누락: ${missing.join(', ')}\n` +
      '  → 저장소 Settings → Secrets and variables → Actions 에서 등록하세요 (GUIDE.md 5단계)'
    );
  }

  const newsTitles = await fetchNews();
  const briefing = await generateBriefing(newsTitles);
  await saveToNotion(briefing);
  archive(briefing, newsTitles);
  console.log('[DONE] 일일 투자 브리핑 완료');
}

// 외부 호출 없이 파싱/정규화 로직만 검증한다 — make.com에서 실제로
// 깨졌던 지점들(코드펜스, 배열/문자열 혼용, 긴 텍스트)을 그대로 재현
function dryRun() {
  console.log('=== DRY RUN — 외부 호출 없이 파싱 로직만 검증 ===\n');
  let failed = 0;
  const check = (label, fn) => {
    try {
      fn();
      console.log(`  ✅ ${label}`);
    } catch (e) {
      failed++;
      console.error(`  ❌ ${label}\n     ${e.message}`);
    }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  console.log('[1] RSS 파싱');
  const sampleRss = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item><title>코스피 2,700 회복 &amp; 외국인 순매수</title></item>
    <item><title><![CDATA[삼성전자 "HBM4 양산 준비" — 목표가 상향]]></title></item>
    <item><title>비트코인 &lt;7만 달러&gt; 재돌파</title></item>
  </channel></rss>`;
  const titles = parseRssTitles(sampleRss);
  check('아이템 3건 추출', () => assert(titles.length === 3, `기대 3, 실제 ${titles.length}`));
  check('&amp; 디코딩', () => assert(titles[0] === '코스피 2,700 회복 & 외국인 순매수', titles[0]));
  check('CDATA + 따옴표 처리', () => assert(titles[1].includes('"HBM4 양산 준비"'), titles[1]));
  check('꺾쇠 디코딩', () => assert(titles[2] === '비트코인 <7만 달러> 재돌파', titles[2]));

  console.log('\n[2] JSON 추출 — make.com에서 깨졌던 케이스들');
  const expected = '{"market":"상승","news":"· 뉴스","stocks":"▸ 종목","checklist":["A","B"]}';
  check('순수 JSON', () => assert(extractJson(expected).market === '상승'));
  check('```json 코드펜스로 감싼 경우', () =>
    assert(extractJson('```json\n' + expected + '\n```').market === '상승'));
  check('언어 표기 없는 펜스', () =>
    assert(extractJson('```\n' + expected + '\n```').market === '상승'));
  check('앞뒤에 산문이 붙은 경우', () =>
    assert(extractJson('네, 브리핑입니다:\n' + expected + '\n감사합니다.').market === '상승'));
  check('JSON이 아예 없으면 명확한 에러', () => {
    try {
      extractJson('죄송합니다. 답변할 수 없습니다.');
      throw new Error('에러가 나야 하는데 통과함');
    } catch (e) {
      assert(e.message.includes('JSON을 찾지 못했'), `예상 밖 메시지: ${e.message}`);
    }
  });

  console.log('\n[3] 필드 정규화');
  const n1 = normalizeBriefing(JSON.parse(expected));
  check('checklist 배열 → 줄바꿈 문자열', () => assert(n1.checklist === '- A\n- B', JSON.stringify(n1.checklist)));
  const n2 = normalizeBriefing({ market: ['a', 'b'], checklist: 'X\nY' });
  check('market이 배열로 와도 문자열화', () => assert(n2.market === 'a\nb', n2.market));
  check('checklist가 문자열로 와도 처리', () => assert(n2.checklist === '- X\n- Y', n2.checklist));
  const n3 = normalizeBriefing({});
  check('전부 비어도 예외 없이 빈 문자열', () =>
    assert(n3.market === '' && n3.news === '' && n3.stocks === '' && n3.checklist === ''));

  console.log('\n[4] Notion rich_text 청킹');
  check('빈 문자열 → 빈 배열', () => assert(richText('').length === 0));
  check('짧은 텍스트 → 1조각', () => assert(richText('안녕').length === 1));
  const long = richText('가'.repeat(5000));
  check('5000자 → 3조각', () => assert(long.length === 3, `실제 ${long.length}`));
  check('각 조각이 2000자 미만', () =>
    assert(long.every(c => c.text.content.length <= NOTION_TEXT_CHUNK), '조각이 한도 초과'));
  check('청킹 후 원문 보존', () =>
    assert(long.map(c => c.text.content).join('') === '가'.repeat(5000), '내용 유실'));

  console.log('\n[5] 날짜');
  check('KST 날짜가 YYYY-MM-DD 형식', () => assert(/^\d{4}-\d{2}-\d{2}$/.test(TODAY), TODAY));
  console.log(`     오늘(KST) = ${TODAY}`);

  console.log(failed === 0 ? '\n=== 전체 통과 ===' : `\n=== ${failed}건 실패 ===`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('\n[실패]', e.message);
  process.exit(1);
});
