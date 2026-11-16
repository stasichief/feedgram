/**
 * Smoke test: loads the built app in a real browser and exercises the UI.
 * Usage: node scripts/smoke-test.mjs
 */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:4173/';

if (!existsSync(EDGE)) {
  console.error('Edge not found at', EDGE);
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: EDGE,
  args: ['--no-sandbox'],
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

async function shot(name) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
  console.log(`  screenshot: ${name}.png`);
}

console.log('→ loading', baseUrl);
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const title = await page.title();
console.log('  title:', title);

const hasTopBar = await page.locator('header').count();
console.log('  top bar present:', hasTopBar > 0);

const navLinks = await page.locator('nav a').allTextContents();
console.log('  left nav:', navLinks.map((t) => t.trim()).filter(Boolean).join(' | '));

const sidebarHeadings = await page.locator('aside h2').allTextContents();
console.log('  sidebar sections:', sidebarHeadings.map((t) => t.trim()).join(' | '));

await shot('desktop-subscribed');

// Mobile view
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await shot('mobile-subscribed');

// Open the hamburger drawer
const menuButton = page.locator('header button[aria-label="Open navigation"]');
if (await menuButton.count()) {
  await menuButton.click();
  await page.waitForTimeout(500);
  await shot('mobile-drawer');
  const drawerVisible = await page.locator('[role="dialog"]').isVisible();
  console.log('  drawer opens:', drawerVisible);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
} else {
  console.log('  !! hamburger button not found');
}

// Navigate to settings
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);
const settingsLink = page.locator('nav a', { hasText: 'Settings' }).first();
if (await settingsLink.count()) {
  await settingsLink.click();
  await page.waitForTimeout(700);
  await shot('desktop-settings');
  const settingsText = await page.locator('h1').first().textContent();
  console.log('  settings heading:', settingsText);
} else {
  console.log('  !! settings link not found');
}

// Navigate to profile
const profileLink = page.locator('nav a[href*="profile"], nav a', { hasText: 'Sign in' }).first();
if (await profileLink.count()) {
  await profileLink.click();
  await page.waitForTimeout(700);
  await shot('desktop-profile');
  const heading = await page.locator('h1').first().textContent();
  console.log('  profile heading:', heading);
} else {
  console.log('  !! profile link not found');
}

// Explore page
await page.goto(`${baseUrl}#/explore`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('desktop-explore');

// All page
await page.goto(`${baseUrl}#/all`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('desktop-all');

// Feeds page
await page.goto(`${baseUrl}#/feeds`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('desktop-feeds');

// Theme switching
await page.goto(`${baseUrl}#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const sepia = page.locator('button', { hasText: 'Sepia' }).first();
if (await sepia.count()) {
  await sepia.click();
  await page.waitForTimeout(500);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  console.log('  theme after click:', theme);
  await shot('desktop-settings-sepia');
}

console.log('\nErrors captured:', errors.length);
errors.slice(0, 20).forEach((error) => console.log('  !', error));

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
