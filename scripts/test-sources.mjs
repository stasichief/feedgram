/**
 * Exercises the source picker against real instances:
 *   - Lemmy REST API   : https://lemmy.sdf.org/c/humanrights
 *   - ActivityPub/Masto: https://defcon.social/explore
 *   - Bluesky ATProto  : https://bsky.app/profile/jay.bsky.team
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = process.env.APP_URL ?? 'http://localhost:5174/';

const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

async function addSource(source, url) {
  await page.goto(`${APP}#/explore`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.selectOption('#explore-add-source', source);
  await page.fill('#explore-add-url', url);
  await page.locator('button', { hasText: /^Add$/ }).first().click();

  const notice = page.locator('#explore-add-url').locator('xpath=../../../../..').locator('p.text-xs');
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('#home-feed-panel');
      const text = panel?.textContent ?? '';
      return /explore list|Could not add|not found|ActivityPub request failed|not look like/i.test(text);
    },
    null,
    { timeout: 60000 },
  ).catch(() => {});
  await page.waitForTimeout(2000);

  const noticeText = (await notice.allTextContents().catch(() => []))
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => /explore list|Could not|not found|failed|not look like/i.test(t));

  const cards = await page.locator('article').count();
  const sources = await page.locator('article span.font-medium.text-fg-muted').allTextContents();
  const unique = [...new Set(sources.map((s) => s.trim()))];

  console.log(`\n=== ${source} :: ${url}`);
  console.log('notice :', noticeText[0] ?? '(none)');
  console.log('cards  :', cards, '| feed labels:', unique.join(' | '));

  return { noticeText, cards, unique };
}

await addSource('lemmy', 'https://lemmy.sdf.org/c/humanrights');
await page.screenshot({ path: 'screenshots/source-lemmy.png' });

// Verify the Lemmy comment endpoint + tree parsing for a post known to have replies.
const lemmyComments = await page.evaluate(async () => {
  const { loadComments, resolveCommentSource } = await import('/src/lib/comments.ts');
  const feed = { id: 'https://lemmy.sdf.org/c/humanrights', kind: 'lemmy' };
  const availability = resolveCommentSource(feed, { url: '', remoteId: '61324144' });
  const comments = await loadComments('probe-lemmy', feed, {
    url: '',
    remoteId: '61324144',
  });
  return { endpoint: availability.endpoint, count: comments.length, sample: comments.slice(0, 3) };
});
console.log('\nlemmy comments endpoint:', lemmyComments.endpoint);
console.log('lemmy comments        :', lemmyComments.count, JSON.stringify(lemmyComments.sample).slice(0, 300));

await addSource('activitypub', 'https://defcon.social/explore');
await page.screenshot({ path: 'screenshots/source-activitypub.png' });

const mastoComments = await page.evaluate(async () => {
  const { loadComments, resolveCommentSource } = await import('/src/lib/comments.ts');
  const feed = { id: 'https://defcon.social/explore', kind: 'mastodon' };
  const availability = resolveCommentSource(feed, {
    url: 'https://mastodon.social/@tess/1',
    remoteId: '117622604789871520',
  });
  const comments = await loadComments('probe-masto', feed, {
    url: 'https://defcon.social/@x/1',
    remoteId: '117622604789871520',
  });
  return { endpoint: availability.endpoint, count: comments.length };
});
console.log('\nmastodon comments endpoint:', mastoComments.endpoint);
console.log('mastodon comments        :', mastoComments.count);

await addSource('bluesky', 'https://bsky.app/profile/jay.bsky.team');
await page.screenshot({ path: 'screenshots/source-bluesky.png' });

console.log('\nproblems:', problems.slice(0, 8));
await browser.close();
