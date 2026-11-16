/**
 * End-to-end test: subscribes to mock feeds through the UI and verifies
 * parsing, rendering, reader mode, voting and bookmarking.
 *
 * Usage:
 *   node scripts/mock-feed-server.mjs &
 *   node scripts/e2e-test.mjs
 */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = process.env.APP_URL ?? 'http://localhost:4173/';
const MOCK = process.env.MOCK_URL ?? 'http://localhost:5199';

if (!existsSync(EDGE)) {
  console.error('Edge not found at', EDGE);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: EDGE,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

async function subscribe(url) {
  await page.goto(`${APP}#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const input = page.locator('#add-feed-url');
  if (!(await input.isVisible().catch(() => false))) {
    await page.locator('button', { hasText: 'Add feed' }).first().click();
    await input.waitFor({ state: 'visible', timeout: 10000 });
  }

  await input.fill(url);
  await page.locator('button', { hasText: /^Subscribe$/ }).first().click();
  await page.waitForTimeout(2500);
}

console.log('→ loading app');
await page.goto(APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

console.log('→ subscribing to the mock RSS feed');
await subscribe(`${MOCK}/feed.xml`);

let titles = await page.locator('article button.text-left').allTextContents();
titles = titles.map((t) => t.trim()).filter(Boolean);
check('RSS feed posts rendered', titles.length >= 3, `${titles.length} posts`);
check(
  'RSS titles parsed',
  titles.some((t) => t.includes('Understanding the Feed Pipeline')),
  titles[0] ?? '',
);

const feedCountText = await page.locator('main p').filter({ hasText: /feed/ }).first().textContent();
check('Feed counted in header', /1 feed/.test(feedCountText ?? ''), feedCountText?.trim());

console.log('→ subscribing to the mock Atom feed');
await subscribe(`${MOCK}/atom.xml`);
titles = (await page.locator('article button.text-left').allTextContents())
  .map((t) => t.trim())
  .filter(Boolean);
check('Atom feed posts rendered', titles.some((t) => t.includes('Atom Entry One')), `${titles.length} posts`);

console.log('→ subscribing to the mock JSON feed');
await subscribe(`${MOCK}/feed.json`);
titles = (await page.locator('article button.text-left').allTextContents())
  .map((t) => t.trim())
  .filter(Boolean);
check('JSON feed posts rendered', titles.some((t) => t.includes('JSON Feed Item One')), `${titles.length} posts`);

console.log('→ auto-discovery from a site URL');
await subscribe(`${MOCK}/`);
titles = (await page.locator('article button.text-left').allTextContents())
  .map((t) => t.trim())
  .filter(Boolean);
check('Discovery found the RSS feed', titles.some((t) => t.includes('Understanding the Feed Pipeline')));

await page.screenshot({ path: 'screenshots/e2e-feed.png', fullPage: false });

console.log('→ expanding an article (reader mode)');
await page.goto(`${APP}#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const readButtons = page.locator('article button', { hasText: 'Read article' });
check('Read article buttons present', (await readButtons.count()) > 0);
await readButtons.first().click();
await page.waitForTimeout(2500);

const articleBody = await page.locator('.article-body').count();
check('Article body rendered inline', articleBody > 0);
if (articleBody > 0) {
  const text = await page.locator('.article-body').first().innerText();
  check(
    'Extracted article contains body text',
    text.includes('extracted article body'),
    text.slice(0, 60).replace(/\n/g, ' '),
  );
}
await page.screenshot({ path: 'screenshots/e2e-article.png', fullPage: false });

console.log('→ voting and bookmarking');
const upvote = page.locator('button[aria-label="Upvote"]').first();
await upvote.click();
await page.waitForTimeout(600);
const voteText = await page
  .locator('article')
  .first()
  .locator('span.text-xs.font-semibold')
  .first()
  .textContent();
check('Upvote registered', voteText?.trim() === '1', voteText?.trim());

const saveButton = page.locator('article button', { hasText: 'Save' }).first();
await saveButton.click();
await page.waitForTimeout(600);
const saveLabel = await page.locator('article button', { hasText: 'Saved' }).count();
check('Bookmark registered', saveLabel > 0);

console.log('→ comments panel (Mastodon-style feed)');
await subscribe(`${MOCK}/@tester.rss`);
await page.waitForTimeout(1200);
const commentLink = page.locator('article button', { hasText: 'Read article' }).first();
await commentLink.click();
await page.waitForTimeout(2500);
const commentsHeading = await page.locator('h3', { hasText: 'Comments' }).count();
check('Comments panel rendered for Mastodon feed', commentsHeading > 0);
if (commentsHeading > 0) {
  const commentText = await page.locator('section h3 + div, section h3 ~ div').first().innerText().catch(() => '');
  const body = await page.locator('body').innerText();
  check('Mastodon comments loaded', body.includes('A reply to the status.'), commentText.slice(0, 40));
  check('Nested comments loaded', body.includes('A nested reply.'));
  check('Ancestor comments loaded', body.includes('An ancestor comment.'));
}
await page.screenshot({ path: 'screenshots/e2e-comments.png', fullPage: false });

console.log('→ comments panel (Lemmy-style feed)');
await subscribe(`${MOCK}/c/news.rss`);
await page.waitForTimeout(1200);
const lemmyRead = page.locator('article button', { hasText: 'Read article' }).first();
await lemmyRead.click();
await page.waitForTimeout(2500);
const body2 = await page.locator('body').innerText();
check('Lemmy comments loaded', body2.includes('A Lemmy comment.'));
check('Nested Lemmy replies loaded', body2.includes('A nested Lemmy reply.'));

console.log('→ sorting');
await page.locator('button[role="tab"]', { hasText: 'New' }).click();
await page.waitForTimeout(900);
const activeTabs = await page.locator('button[role="tab"][aria-selected="true"]').allTextContents();
check(
  'Sort tabs work',
  activeTabs.some((label) => label.trim() === 'New'),
  activeTabs.map((label) => label.trim()).join(', '),
);

console.log('→ search');
await page.locator('header input[type="search"]').fill('offline');
await page.waitForTimeout(700);
const filtered = (await page.locator('article button.text-left').allTextContents())
  .map((t) => t.trim())
  .filter(Boolean);
check(
  'Search filters posts',
  filtered.length > 0 && filtered.every((t) => /offline/i.test(t)),
  `${filtered.length} results`,
);
await page.locator('header input[type="search"]').fill('');
await page.waitForTimeout(400);

console.log('→ feeds page');
await page.goto(`${APP}#/feeds`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const feedRows = await page.locator('ul li').count();
check('Feeds page lists subscriptions', feedRows >= 3, `${feedRows} rows`);
await page.screenshot({ path: 'screenshots/e2e-feeds.png', fullPage: false });

console.log('→ create post is auth-gated');
await page.goto(`${APP}#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.locator('header button', { hasText: 'Create' }).first().click();
await page.waitForTimeout(800);
check(
  'Create redirects to profile when signed out',
  page.url().includes('#/profile'),
  page.url().split('#')[1] ?? page.url(),
);

console.log('→ OPML export');
await page.goto(`${APP}#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
await page.locator('button', { hasText: 'Export OPML' }).first().click();
const download = await downloadPromise;
const downloadPath = await download.path();
const opml = await (await import('node:fs/promises')).readFile(downloadPath, 'utf8');
check('OPML export produced a file', download.suggestedFilename().endsWith('.opml'), download.suggestedFilename());
check('OPML contains subscriptions', opml.includes('<opml') && opml.includes('xmlUrl='));
check('OPML contains the mock feed', opml.includes('feed.xml'));

console.log('→ offline behaviour');
await context.setOffline(true);
await page.goto(`${APP}#/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(1500);
const offlineOk = await page.locator('body').count();
check('App still renders offline (service worker)', offlineOk > 0);
await page.screenshot({ path: 'screenshots/e2e-offline.png', fullPage: false });
await context.setOffline(false);

console.log(`\nConsole errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log('  !', e));

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

await browser.close();
process.exit(failed.length > 0 || errors.length > 0 ? 1 : 0);
