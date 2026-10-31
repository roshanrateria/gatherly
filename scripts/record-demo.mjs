/**
 * Gatherly — Playwright Demo Recorder
 * ------------------------------------
 * Runs the REAL Gatherly app in a real Chromium browser, drives genuine UI
 * interactions through robust role-based locators, and records a WebM video
 * via Playwright's recordVideo (viewport 1440x900 -> native 1440x900 video).
 *
 * No application source is modified. No localStorage seeding. No staged data:
 * every value shown in the video is entered through the app's real forms.
 *
 * Third-party presentation assets (Google webfonts) and the injected arena
 * session telemetry (designarena.ai beacon + rrweb CDN) are network-stubbed so
 * the recording starts deterministically, never leaks session data, and stays
 * quiet in QA logs. The app's own logic — offline planner, forms, persistence —
 * is untouched and runs genuinely offline.
 *
 * Env overrides:
 *   APP_URL   (default http://localhost:5173/)
 *   OUT_DIR   (default ./recordings)  — raw WebM + QA artifacts, outside the repo
 *   SHOT_DIR  (default C:\Users\rater\Downloads\gatherly-demo-screenshots)
 *   REPORT_JSON (default <OUT_DIR>/run-qa.json)
 */
import { chromium, expect } from 'playwright/test';
import { mkdirSync, writeFileSync, readdirSync, statSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_URL = process.env.APP_URL || 'http://localhost:5173/';
const OUT_DIR = resolve(process.env.OUT_DIR || './recordings');
const SHOT_DIR = resolve(process.env.SHOT_DIR || 'C:\\Users\\rater\\Downloads\\gatherly-demo-screenshots');
const REPORT_JSON = resolve(process.env.REPORT_JSON || join(OUT_DIR, 'run-qa.json'));

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SHOT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'))) rmSync(join(OUT_DIR, f), { force: true });
for (const f of readdirSync(SHOT_DIR).filter((f) => f.endsWith('.png'))) rmSync(join(SHOT_DIR, f), { force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];

const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

function qaLog(...args) { console.log(`[qa ${ts()}]`, ...args); }

const DEMO_BRIEF =
  'Planning a 2-day Bengali wedding in Kolkata for 250 guests on 15 February 2027, budget 12 lakhs. ' +
  'Traditional rituals with modern decor - catering, venue, photography, decoration, entertainment ' +
  'and overall guest experience are our top priorities. Pure vegetarian menu with some Jain plates.';

const PLAN_REQUEST =
  'Please review our two-day Kolkata wedding plan and lay out the most practical approach for the ' +
  'next few weeks. Cover venue confirmation, catering design, decor aesthetics and entertainment ' +
  'flow. Use our fixed budget of 12 lakhs for 250 guests and tell me the smartest next steps.';

const REPLAN_GUESTS =
  'We need to increase guests from 250 to 300, but our total budget stays strictly fixed at 12 lacs. ' +
  'Recalculate the per-guest pressure, flag catering and venue capacity risks, and propose concrete trade-offs.';

const REPLAN_PHOTO =
  'Photography is now our top priority above decoration - please propose the fund reallocation to ' +
  'protect memories while staying inside the same budget.';

async function screenshot(page, name) {
  await page.screenshot({ path: join(SHOT_DIR, name) });
  qaLog('screenshot', name);
}

async function goTab(page, label) {
  await page
    .locator('nav')
    .getByRole('button', { name: new RegExp(`^${label}( \\d+)?$`) })
    .first()
    .click();
  await sleep(1000);
  qaLog('tab', label);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-infobars', '--no-first-run', '--no-default-browser-check'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1440, height: 900 },
    },
  });
  context.setDefaultTimeout(20000);

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);

  // Deterministic + private recording: stub presentation fonts and the injected
  // arena telemetry; everything else (Vite, app) flows through untouched.
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (/www\.designarena\.ai/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (/cdn\.jsdelivr\.net\/npm\/rrweb/.test(url)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed: no third-party session recording */' });
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) return route.fulfill({ status: 200, contentType: 'text/css', body: '/* webfonts stubbed for offline demo recording */' });
    return route.continue();
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      qaLog('console.error:', msg.text().slice(0, 240));
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.stack || err));
    qaLog('pageerror:', String(err).slice(0, 240));
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!/devtools|localhost:5173/.test(url)) {
      failedRequests.push({ url, error: req.failure()?.errorText });
      qaLog('requestfailed:', req.failure()?.errorText, url.slice(0, 140));
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      badResponses.push({ status: res.status(), url: res.url() });
      qaLog('http-error:', res.status(), res.url().slice(0, 140));
    }
  });

  // ------------------------------------------------------------------ SCENE 1
  qaLog('=== SCENE 1: open Gatherly (default workspace) ===');
  await page.goto(APP_URL, { waitUntil: 'load' });
  await expect(page.getByText('Gatherly', { exact: true })).toBeVisible();
  await expect(page.getByText('Budget Allocation')).toBeVisible();
  await sleep(2600);
  await screenshot(page, '01-initial-overview.png');

  // ------------------------------------------------------------------ SCENE 2
  qaLog('=== SCENE 2: Adaptive event creation (real onboarding) ===');
  await page.getByRole('button', { name: /Adaptive Setup/ }).click();
  await expect(page.getByText('Adaptive Event Setup')).toBeVisible();
  await sleep(900);
  await screenshot(page, '02-setup-modal-open.png');

  // Switch to the guided wizard first, to show both entry modes genuinely exist.
  await page.getByRole('button', { name: 'Step-by-Step Guided Wizard' }).click();
  await sleep(700);
  await screenshot(page, '03-wizard-mode.png');

  // Back to the natural-language brief — this is the demo path.
  await page.getByRole('button', { name: 'Natural-Language Brief (Fastest)' }).click();
  await sleep(500);

  const briefBox = page.getByPlaceholder(/Planning a 3-day royal wedding/);
  await briefBox.fill('');
  await briefBox.pressSequentially(DEMO_BRIEF, { delay: 6 });
  await expect(page.getByText('Extracted Structured Blueprint')).toBeVisible();
  await expect(page.getByText('100% Confidence').first()).toBeVisible();
  await sleep(1800);
  await screenshot(page, '04-brief-parsed-blueprint.png');

  // Show that the parsed brief actually populated the wizard.
  await page.getByRole('button', { name: 'Step-by-Step Guided Wizard' }).click();
  await sleep(500);
  await page.getByRole('button', { name: '2. Venue & Guests' }).click();
  await sleep(600);
  await screenshot(page, '05-wizard-parsed-venue-guests.png');
  await page.getByRole('button', { name: '3. Budget & Currency' }).click();
  await sleep(600);
  await expect(page.getByText('Formatted Preview: ₹12 L')).toBeVisible();
  await screenshot(page, '06-wizard-parsed-budget.png');
  await page.getByRole('button', { name: 'Natural-Language Brief (Fastest)' }).click();
  await sleep(400);

  await page.getByRole('button', { name: 'Confirm & Build Master Workspace' }).click();
  await expect(page.getByText('New Master Plan Created').first()).toBeVisible({ timeout: 10000 });
  await sleep(2000);
  await expect(page.getByRole('heading', { name: 'Kolkata Wedding Celebration' })).toBeVisible();
  await screenshot(page, '07-workspace-created-overview.png');

  // ------------------------------------------------------------------ SCENE 3
  qaLog('=== SCENE 3: AI planning (offline deterministic mode) ===');
  await goTab(page, 'AI Planner');
  await expect(page.getByText('Offline Expert System (Deterministic & Private)')).toBeVisible();
  await sleep(1000);
  await screenshot(page, '08-planner-offline-mode.png');

  const chatInput = page.getByPlaceholder(/Ask about budget trade-offs/);
  await chatInput.pressSequentially(PLAN_REQUEST, { delay: 4 });
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Operating Assumptions')).toHaveCount(2, { timeout: 15000 });
  const bubble1 = page
    .locator('div')
    .filter({ has: page.getByText('Operating Assumptions') })
    .locator('div.bg-white')
    .last();
  await bubble1.scrollIntoViewIfNeeded();
  await sleep(3300);
  await screenshot(page, '09-planning-response.png');

  // ------------------------------------------------------------------ SCENE 4
  qaLog('=== SCENE 4: intelligent replanning (300 guests @ fixed budget) ===');
  await chatInput.pressSequentially(REPLAN_GUESTS, { delay: 4 });
  await page.getByRole('button', { name: 'Send' }).click();
  const applyButtons = page.getByRole('button', { name: 'Apply Changes' });
  await expect(applyButtons).toHaveCount(2);
  await bubble1.scrollIntoViewIfNeeded();
  await sleep(2400);
  await screenshot(page, '10-replanning-guest-proposals.png');

  await applyButtons.first().click(); // guest count 250 -> 300
  await expect(page.getByText('Changes Applied Successfully!').first()).toBeVisible();
  await sleep(1000);
  await expect(applyButtons).toHaveCount(1);
  await expect(page.getByText(/reasoning over 300 guests/)).toBeVisible(); // live header update
  await applyButtons.click(); // decor -> catering reallocation
  await expect(page.getByText('Changes Applied Successfully!').first()).toBeVisible();
  await expect(applyButtons).toHaveCount(0);
  await sleep(1400);
  await screenshot(page, '11-replan-proposals-applied.png');

  await chatInput.pressSequentially(REPLAN_PHOTO, { delay: 4 });
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(applyButtons).toHaveCount(1);
  await sleep(2000);
  await screenshot(page, '12-photography-reallocation-proposal.png');
  await applyButtons.click();
  await expect(page.getByText('Changes Applied Successfully!').first()).toBeVisible();
  await sleep(1600);
  await screenshot(page, '13-photography-reallocation-applied.png');

  // ------------------------------------------------------------------ SCENE 5
  qaLog('=== SCENE 5: budget management (real expense) ===');
  await goTab(page, 'Budget');
  await expect(page.getByText('Total Budget Target')).toBeVisible();
  await sleep(1400);
  await screenshot(page, '14-budget-overview.png');

  await page.getByRole('button', { name: 'Record Expense / Quote' }).click();
  const expenseModal = page.locator('form').filter({ hasText: 'Record New Expense or Quote' });
  await expenseModal.getByRole('combobox').first().selectOption({ label: 'Venue & Accommodation' });
  await expenseModal.getByPlaceholder('e.g. Lawn Advance Deposit').pressSequentially('Venue booking advance & security deposit', { delay: 4 });
  await expenseModal.locator('input[type=number]').nth(0).pressSequentially('220000', { delay: 14 });
  await expenseModal.locator('input[type=number]').nth(1).pressSequentially('220000', { delay: 14 });
  await expenseModal.locator('input[type=number]').nth(2).pressSequentially('100000', { delay: 14 });
  await sleep(500);
  await expenseModal.getByRole('button', { name: 'Save Expense' }).click();
  await expect(page.getByText('Expense Recorded').first()).toBeVisible();
  await sleep(1300);
  await expect(page.getByText('₹2.2 L').first()).toBeVisible(); // committed actual
  await sleep(1200);
  await screenshot(page, '15-budget-expense-recorded.png');

  // Expand the Venue category to show its recorded line item.
  const venueRow = page.locator('tbody tr').filter({ hasText: 'Venue & Accommodation' }).first();
  await venueRow.locator('button').first().click();
  await expect(page.getByRole('table').getByText('Venue booking advance & security deposit')).toBeVisible();
  await sleep(1600);
  await screenshot(page, '16-budget-line-item-expanded.png');

  // ------------------------------------------------------------------ SCENE 6
  qaLog('=== SCENE 6: timeline & tasks ===');
  await goTab(page, 'Timeline');
  await expect(page.getByText('Dynamic Milestones & Planning Timeline')).toBeVisible();
  await sleep(1700);
  await screenshot(page, '17-timeline-milestones.png');
  await page.getByRole('button', { name: 'Calendar View' }).click();
  await sleep(1200);
  await screenshot(page, '18-timeline-calendar-view.png');
  await page.getByRole('button', { name: 'Timeline View' }).click();
  await sleep(800);

  await goTab(page, 'Tasks');
  await expect(page.getByText('Action Checklists & Task Master')).toBeVisible();
  await sleep(900);
  const firstTaskRow = page.locator('div.divide-y > div').first();
  await expect(firstTaskRow.getByText(/to do|todo|in progress|blocked/i).first()).toBeVisible();
  await firstTaskRow.locator('button').first().click();
  await expect(firstTaskRow.getByText('done')).toBeVisible();
  await sleep(1100);
  await screenshot(page, '19-task-completed.png');

  await page.getByRole('button', { name: 'Scan for AI-Suggested Gaps' }).click();
  await expect(page.getByText('AI-Identified Operational Gaps')).toBeVisible();
  await sleep(1200);
  await screenshot(page, '20-task-gap-suggestions.png');
  await page.getByRole('button', { name: 'Add to Tasks' }).first().click();
  await expect(page.getByText('Task Added from AI Audit').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await sleep(1000);
  const gapRow = page.locator('div.divide-y > div').filter({ hasText: 'AI Gap' }).first();
  await expect(gapRow).toBeVisible();
  await gapRow.locator('button').first().click();
  await expect(gapRow.getByText('done')).toBeVisible();
  await sleep(1100);
  await screenshot(page, '21-gap-task-done.png');

  // ------------------------------------------------------------------ SCENE 7
  qaLog('=== SCENE 7: vendors & guests ===');
  await goTab(page, 'Vendors');
  await expect(page.getByText('Vendor Directory & Contract Procurement')).toBeVisible();

  // Vendor 1 — caterer with quote + deposit entered as paid.
  await page.getByRole('button', { name: 'Add Vendor' }).first().click();
  const vendorModal = page.locator('form').filter({ hasText: 'Add New Vendor' });
  await vendorModal.getByRole('combobox').first().selectOption({ label: 'Catering & Food' });
  await vendorModal.getByPlaceholder('e.g. Royal Gourmet Caterers').pressSequentially('Saha Catering Group', { delay: 5 });
  await vendorModal.locator('input[type=number]').nth(0).pressSequentially('450000', { delay: 14 });
  await vendorModal.locator('input[type=number]').nth(1).pressSequentially('420000', { delay: 14 });
  await vendorModal.locator('input[type=number]').nth(2).pressSequentially('50000', { delay: 14 });
  await vendorModal.getByPlaceholder('Manager / Owner').pressSequentially('Prodyut Saha', { delay: 5 });
  await vendorModal.getByPlaceholder('+91 98...').pressSequentially('+91 90011 22033', { delay: 5 });
  await vendorModal.getByRole('combobox').nth(1).selectOption('deposit_paid');
  await vendorModal.getByPlaceholder(/Drone 4K aerials/).pressSequentially('500-plate traditional Bengali dinner\nTwo live khichdi counters', { delay: 4 });
  await sleep(400);
  await vendorModal.getByRole('button', { name: 'Save Vendor' }).click();
  await expect(page.getByText('Vendor Added').first()).toBeVisible();
  await sleep(1200);

  // Vendor 2 — photographer, quote received.
  await page.getByRole('button', { name: 'Add Vendor' }).first().click();
  const vendorModal2 = page.locator('form').filter({ hasText: 'Add New Vendor' });
  await vendorModal2.getByRole('combobox').first().selectOption('photography');
  await vendorModal2.getByPlaceholder('e.g. Royal Gourmet Caterers').pressSequentially('Kolkata Shutter Arts', { delay: 5 });
  await vendorModal2.locator('input[type=number]').nth(0).pressSequentially('230000', { delay: 14 });
  await vendorModal2.locator('input[type=number]').nth(1).pressSequentially('210000', { delay: 14 });
  await vendorModal2.locator('input[type=number]').nth(2).pressSequentially('30000', { delay: 14 });
  await vendorModal2.getByPlaceholder('Manager / Owner').pressSequentially('Ritika Banerjee', { delay: 5 });
  await vendorModal2.getByPlaceholder('+91 98...').pressSequentially('+91 98311 44556', { delay: 5 });
  await vendorModal2.getByPlaceholder(/Drone 4K aerials/).pressSequentially('Two candid photographers\n4K drone highlight reel', { delay: 4 });
  await sleep(400);
  await vendorModal2.getByRole('button', { name: 'Save Vendor' }).click();
  await expect(page.getByText('Vendor Added').first()).toBeVisible();
  await sleep(1100);
  await screenshot(page, '22-vendors-added.png');

  // Side-by-side comparison of both vendors.
  const sahaCard = page.locator('div.grid > div').filter({ hasText: 'Saha Catering Group' }).first();
  await sahaCard.getByRole('checkbox').check();
  const shutterCard = page.locator('div.grid > div').filter({ hasText: 'Kolkata Shutter Arts' }).first();
  await shutterCard.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Compare Selected/ }).click();
  await expect(page.getByText('Side-by-Side Vendor Evaluation')).toBeVisible();
  await sleep(2000);
  await screenshot(page, '23-vendor-comparison.png');
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await sleep(900);

  // Guest roster: add one attending guest (+1).
  await goTab(page, 'Guests');
  await expect(page.getByText('Guest List, RSVP Registry & Hospitality')).toBeVisible();
  await sleep(400);
  await page.getByRole('button', { name: 'Add Guest' }).click();
  const guestModal = page.locator('form').filter({ hasText: 'Add Guest Entry' });
  await guestModal.getByPlaceholder('e.g. Ramesh & Savita Gupta').pressSequentially('Ananya Bhattacharya', { delay: 5 });
  await guestModal.getByRole('combobox').nth(0).selectOption({ label: 'Bride Side' });
  await guestModal.getByRole('combobox').nth(1).selectOption('attending');
  await guestModal.getByPlaceholder('e.g. Table 1').pressSequentially('Table 3', { delay: 8 });
  await guestModal.locator('input[type=number]').pressSequentially('1', { delay: 20 });
  await guestModal.getByPlaceholder('+91...').pressSequentially('+91 90222 88221', { delay: 5 });
  await guestModal.getByPlaceholder('name@example.com').pressSequentially('ananya.b@example.com', { delay: 5 });
  await sleep(400);
  await guestModal.getByRole('button', { name: 'Save Guest' }).click();
  await expect(page.getByText('Guest Added').first()).toBeVisible();
  await sleep(1700);
  await screenshot(page, '24-guest-rsvp-added.png');

  // ------------------------------------------------------------------ SCENE 8
  qaLog('=== SCENE 8: run sheet & creative ideas ===');
  await goTab(page, 'Schedule');
  await expect(page.getByText('Event-Day Run Sheet & Master Schedule')).toBeVisible();
  await sleep(1700);
  await screenshot(page, '25-schedule-day1.png');
  await page.getByRole('button', { name: /^Day 2 \(/ }).click();
  await expect(page.getByText('No activities scheduled for Day 2')).toBeVisible();
  await sleep(1000); // authentic default: new events start with an empty Day 2

  // Build Day 2 through the real Add Activity form.
  await page.getByRole('button', { name: 'Add Activity' }).click();
  const activityModal = page.locator('form').filter({ hasText: 'Add Activity for Day 2' });
  await activityModal
    .getByPlaceholder('e.g. Sangeet Grand Entry & Family Toasts')
    .pressSequentially('Haldi Ceremony & Dhol Celebration', { delay: 5 });
  await activityModal.locator('input[type=time]').nth(0).fill('10:00');
  await activityModal.locator('input[type=time]').nth(1).fill('12:30');
  await sleep(400);
  await activityModal.getByRole('button', { name: 'Save Activity' }).click();
  await expect(page.getByText('Activity Added to Run Sheet').first()).toBeVisible();
  await sleep(1200);
  await expect(page.getByRole('main').getByText('Haldi Ceremony & Dhol Celebration')).toBeVisible();
  await sleep(800);
  await screenshot(page, '26-schedule-day2.png');

  await goTab(page, 'Ideas');
  await expect(page.getByText('Creative Ideas & Concept Studio')).toBeVisible();
  await sleep(1100);
  await screenshot(page, '27-ideas-studio.png');
  // Some default ideas ship pre-saved ("✓ Saved to Plan"); pick a genuinely
  // unsaved concept — prefer the flash-mob card, else any card with a Save button.
  const preferredIdea = page
    .locator('div.grid.grid-cols-1 > div')
    .filter({ hasText: 'Flash Mob Family Choreography & Live Dhol Welcome' });
  const ideaCard =
    (await preferredIdea.getByRole('button', { name: 'Save Concept' }).count()) === 1
      ? preferredIdea
      : page
          .locator('div.grid.grid-cols-1 > div')
          .filter({ has: page.getByRole('button', { name: 'Save Concept' }) })
          .first();
  await ideaCard.scrollIntoViewIfNeeded();
  await ideaCard.getByRole('button', { name: 'Save Concept' }).click();
  await expect(page.getByText('Idea Status Updated').first()).toBeVisible();
  await expect(page.getByText('✓ Saved to Plan').first()).toBeVisible();
  await sleep(1500);
  await screenshot(page, '28-idea-saved.png');

  // ------------------------------------------------------------------ SCENE 9
  qaLog('=== SCENE 9: final overview ===');
  await goTab(page, 'Overview');
  await expect(page.getByRole('heading', { name: 'Kolkata Wedding Celebration' })).toBeVisible();
  await sleep(1200);
  await screenshot(page, '29-final-overview.png');

  // Light scroll to show milestones + plan health, keep the hero in view.
  await page.evaluate(() => window.scrollBy({ top: 180, behavior: 'instant' }));
  await sleep(1400);
  await screenshot(page, '30-final-overview-metrics.png');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(1800);

  // ------------------------------------------------------------------ Wrap up
  await context.close(); // flushes video
  await browser.close();

  const videoFiles = readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'));
  const videoPath = videoFiles.map((f) => join(OUT_DIR, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!videoPath) throw new Error('No video produced!');
  const finalVideo = join(OUT_DIR, 'gatherly-demo-raw.webm');
  if (resolve(videoPath) !== resolve(finalVideo)) copyFileSync(videoPath, finalVideo);

  const report = {
    appUrl: APP_URL,
    startedAt: new Date(t0).toISOString(),
    wallClockSeconds: (Date.now() - t0) / 1000,
    videoRaw: finalVideo,
    qa: { consoleErrors, pageErrors, failedRequests, badResponses },
  };
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  qaLog(`DONE. raw video: ${finalVideo}`);
  qaLog(`QA summary: consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length} failedReq=${failedRequests.length} badRes=${badResponses.length}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1); // ensure the process never lingers with an open browser
});
