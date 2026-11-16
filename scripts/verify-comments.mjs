/** Renders a Lemmy post with real comments, and subscribes via the Subscribed tab. */
import { chromium } from 'playwright-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = process.env.APP_URL ?? 'http://localhost:5174/';

const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

// --- Subscribe from the Subscribed tab using the Lemmy source ---------------
await page.goto(`${APP}#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('button', { hasText: 'Add feed' }).first().click();
await page.selectOption('#add-feed-source', 'lemmy');
await page.fill('#add-feed-url', 'https://lemmy.sdf.org/c/humanrights');
await page.locator('button', { hasText: /^Subscribe$/ }).first().click();
await page.waitForFunction(
  () => /Subscribed to|already subscribed/i.test(document.querySelector('#home-feed-panel')?.textContent ?? ''),
  null,
  { timeout: 60000 },
);
await page.waitForTimeout(1500);
const header = await page.locator('main p').filter({ hasText: /feed/ }).first().textContent();
console.log('subscribed header:', header?.trim());

const stored = await page.evaluate(async () => {
  const { getAllFeeds } = await import('/src/lib/db.ts');
  return (await getAllFeeds()).map((f) => ({ id: f.id, source: f.source, kind: f.kind, explore: !!f.explore }));
});
console.log('stored feeds    :', JSON.stringify(stored));

// --- Open a Lemmy post that has comments -----------------------------------
const target = page.locator('article').filter({ hasText: 'A woman who went missing 26 years ago' }).first();
console.log('target found    :', await target.count());
if (await target.count()) {
  await target.locator('button.text-left').first().click();
  await page.waitForTimeout(6000);
  const panel = page.locator('section').filter({ hasText: /via Lemmy/ }).first();
  const text = (await panel.textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
  console.log('comments panel  :', text.slice(0, 400));
  await page.screenshot({ path: 'screenshots/source-lemmy-thread.png' });
}

await browser.close();
