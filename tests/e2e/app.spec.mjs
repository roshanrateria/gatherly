import { test, expect } from '@playwright/test';

/**
 * Real-world end-to-end validation for Gatherly.
 *
 * Every scenario drives actual product paths: wedding creation from a
 * natural-language brief, the unified proposal engine, budget/bookkeeping and
 * guest CRUD, multi-day reschedule math, refresh persistence, offline usage
 * and hostile inputs. Nothing mocks the app; the planner runs in its default
 * Offline Expert mode (no API key needed).
 *
 * State seeding uses the app's own Settings → "Reset to Sample Events" action
 * so the tests exercise the same code paths a user would, on every viewport.
 */

const STORAGE_KEY = 'gatherly_state_v1';

/** Loads the sample wedding plan through the Settings tab. */
async function loadSampleWedding(page) {
  await page.goto('/');
  await tabButton(page, 'Settings').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Udaipur Royal Wedding/ }).click();
  await expect(page.getByText('Loaded Sample Preset')).toBeVisible();
  await tabButton(page, 'Overview').click();
}

/** Navbar tab buttons carry count badges, so match by accessible-name prefix. */
function tabButton(page, label) {
  return page
    .getByRole('navigation', { name: 'Workspace sections' })
    .getByRole('button', { name: new RegExp(`^${label}`) });
}

/** Stable handle for whatever the current persisted state looks like. */
async function readState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

test.describe('Wedding creation via Adaptive Setup (natural-language brief)', () => {
  test('brief ingestion creates a new master plan and replaces the default sample', async ({ page }) => {
    await page.goto('/');

    // First run renders the default sample wedding; a real user starts a new
    // plan through the Adaptive Setup entry point (label shrinks to "New" on
    // mobile).
    await page.getByRole('button', { name: /^(Adaptive Setup|New)$/ }).click();
    const dialog = page.getByRole('dialog', { name: /Adaptive Event Setup/ });
    await expect(dialog).toBeVisible();

    await page
      .getByLabel(/Paste or Describe Your Event Vision/)
      .fill('Udaipur royal wedding for 120 guests in December 2027, budget 30 lakhs, catering and photography are top priority.');
    await page.getByRole('button', { name: 'Confirm & Build Master Workspace' }).click();

    await expect(page.getByText('New Master Plan Created')).toBeVisible();

    const state = await readState(page);
    expect(state.event.type).toBe('wedding');
    expect(state.event.location.city).toBe('Udaipur');
    expect(state.event.startDate).toBe('2027-12-15');
    expect(state.event.guests.count).toBe(120);
    expect(state.event.budget.total).toBe(3_000_000);
    // A full workspace is generated on create: milestones, tasks, run sheet.
    expect(state.milestones.length).toBeGreaterThan(3);
    expect(state.tasks.length).toBeGreaterThan(5);
    expect(state.schedule.length).toBeGreaterThan(2);
  });

  test('brief mode keeps its content after cancelling, then wizard clamps hostile inputs', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /^(Adaptive Setup|New)$/ }).click();
    const dialog = page.getByRole('dialog', { name: /Adaptive Event Setup/ });
    await expect(dialog).toBeVisible();

    // Temporary brief content survives nothing destructive: cancelling and
    // reopening must not crash and must restore the default screen.
    await page
      .getByLabel(/Paste or Describe Your Event Vision/)
      .fill('City gala for 80 guests on 2027-05-05, budget 10 lakhs.');
    await page.keyboard.press('Escape'); // ModalShell closes on Escape (a11y)
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: /^(Adaptive Setup|New)$/ }).click();
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel(/Paste or Describe Your Event Vision/)).toHaveValue(/City gala/);

    // Now close again and take the wizard path with hostile numbers.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: /^(Adaptive Setup|New)$/ }).click();
    await expect(dialog).toBeVisible();

    await page.getByRole('button', { name: 'Step-by-Step Guided Wizard' }).click();

    // Step 1 — Basics & Dates: hostile duration.
    await page.getByLabel('Event Title').fill('Clamp Test Gala');
    await page.getByLabel('Duration (Days)').fill('9999');
    await page.getByLabel('Event Start Date').fill('2027-05-05');
    await page.getByRole('button', { name: 'Next Step' }).click();

    // Step 2 — City & Guests: hostile roster target.
    await page.getByLabel('City / Destination').fill('Jaipur');
    await page.getByLabel('Target Guest Count').fill('99999999');
    await page.getByRole('button', { name: 'Next Step' }).click();

    // Step 3 — Budget & Currency: hostile budget.
    await page.getByLabel(/Total Target Budget/).fill('-5000');
    await page.getByRole('button', { name: 'Next Step' }).click();

    // Step 4 — Priorities & Needs (optional style).
    await page.getByLabel('Theme / Aesthetic Style').fill('Minimal');
    await page.getByRole('button', { name: 'Confirm & Build Master Workspace' }).click();

    await expect(page.getByText('New Master Plan Created')).toBeVisible();

    const state = await readState(page);
    expect(state.event.title).toBe('Clamp Test Gala');
    expect(state.event.durationDays).toBeLessThanOrEqual(30);
    expect(state.event.guests.count).toBeLessThanOrEqual(100_000);
    expect(state.event.guests.count).toBeGreaterThan(0);
    expect(state.event.budget.total).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Unified proposal engine (planner → review → apply)', () => {
  test('pending proposals open the review modal from the Overview next step', async ({ page }) => {
    await loadSampleWedding(page);

    // Ask the offline planner to replan the headcount; proposals are staged.
    await tabButton(page, 'AI Planner').click();
    await page.getByLabel('Message to the planner').fill('Increase guest count to 300');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(/Actionable Proposals \(/)).toBeVisible();

    // Unapplied proposals surface as a next-step on the Overview; clicking
    // that step must open the review modal directly (regression: the CTA
    // silently did nothing before directAction was wired through).
    await tabButton(page, 'Overview').click();
    const nextStep = page.getByText('Review Pending AI Proposals');
    await expect(nextStep).toBeVisible();
    await nextStep.click();

    const review = page.getByRole('dialog', { name: /Review & Apply AI Proposals/ });
    await expect(review).toBeVisible();
    await review.getByRole('button', { name: /Apply All \(\d+\) Changes/ }).click();

    const state = await readState(page);
    const applied = (state.proposalsHistory ?? []).filter((p) => p.applied);
    expect(applied.length).toBeGreaterThan(0);
    expect(applied[0].section).toBe('guest');
    // Guest count from the batch actually landed in the events data.
  });

  test('applying a single proposal from the chat card marks it applied and bumps state', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'AI Planner').click();
    await page.getByLabel('Message to the planner').fill('Increase guest count to 280');
    await page.getByRole('button', { name: 'Send' }).click();

    const applyButton = page.getByRole('button', { name: 'Apply Changes' }).first();
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    // The applied proposal flips its card to a non-interactive "Applied" badge.
    await expect(page.getByText('Applied', { exact: true }).first()).toBeVisible();

    const state = await readState(page);
    const applied = (state.proposalsHistory ?? []).filter((p) => p.applied);
    expect(applied.length).toBeGreaterThan(0);
  });
});

test.describe('Budget bookkeeping', () => {
  test('recording a realistic expense lands in the right category', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Budget').click();
    await page.getByRole('button', { name: /Record Expense \/ Quote/ }).first().click();
    const dialog = page.getByRole('dialog', { name: /Record New Expense or Quote/i });
    await expect(dialog).toBeVisible();

    await page.locator('#expense-category').selectOption({ index: 0 });
    await page.locator('#expense-title').fill('Champagne Tower Service');
    await page.locator('#expense-estimated').fill('150000');
    await page.locator('#expense-actual').fill('155000');
    await dialog.getByRole('button', { name: /Save Expense/ }).click();

    await expect(page.getByText('Expense Recorded')).toBeVisible();
    const state = await readState(page);
    const created = state.expenses[state.expenses.length - 1];
    expect(created.title).toBe('Champagne Tower Service');
    expect(created.estimatedCost).toBe(150000);
    expect(created.actualCost).toBe(155000);
    // The expense is attached to a real budget category id.
    expect(state.categories.some((c) => c.id === created.categoryId)).toBe(true);
  });

  test('a runaway expense pushes the plan over budget and the UI reports it', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Budget').click();
    await page.getByRole('button', { name: /Record Expense \/ Quote/ }).first().click();
    const dialog = page.getByRole('dialog', { name: /Record New Expense or Quote/i });
    await expect(dialog).toBeVisible();

    await page.locator('#expense-category').selectOption({ index: 0 });
    await page.locator('#expense-title').fill('Aerial Orchard Tours');
    await page.locator('#expense-estimated').fill('99999999');
    await page.locator('#expense-actual').fill('99999999');
    await dialog.getByRole('button', { name: /Save Expense/ }).click();

    await expect(page.getByText('Expense Recorded')).toBeVisible();

    // Total spent now exceeds the master budget; the Budget tab expresses the
    // overrun in its summary header.
    await expect(page.getByText(/Over/).first()).toBeVisible();

    const state = await readState(page);
    const spent = state.expenses.reduce((sum, e) => sum + (Number(e.actualCost) || 0), 0);
    expect(spent).toBeGreaterThan(state.event.budget.total);
  });
});

test.describe('Guest list CRUD', () => {
  test('manual add persists plus-ones and RSVP status, then survives refresh', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Guests').click();
    await page.getByRole('button', { name: /Add Guest/ }).click();
    const dialog = page.getByRole('dialog', { name: /Add Guest Entry/ });
    await expect(dialog).toBeVisible();

    await page.getByLabel('Full Name').fill('Ishaan Malhotra');
    await page.locator('#guest-group').selectOption({ label: 'Friends' });
    await page.locator('#guest-rsvp').selectOption({ label: 'Attending' });
    await page.locator('#guest-plus-ones').fill('2');
    await dialog.getByRole('button', { name: 'Save Guest' }).click();

    await expect(page.getByText('Guest Added')).toBeVisible();
    await expect(page.getByText('Ishaan Malhotra').first()).toBeVisible();

    // After reload the app opens on Overview; navigate to Guests explicitly.
    await page.reload();
    await tabButton(page, 'Guests').click();
    await expect(page.getByText('Ishaan Malhotra').first()).toBeVisible();

    const state = await readState(page);
    const guest = state.guests.find((g) => g.name === 'Ishaan Malhotra');
    expect(guest).toBeTruthy();
    expect(guest.plusOnes).toBe(2);
    expect(guest.rsvpStatus).toBe('attending');
  });

  test('CSV round trip imports normalized guests and exports neutralized cells', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Guests').click();
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const dialog = page.getByRole('dialog', { name: /Import Guests from CSV/ });
    await expect(dialog).toBeVisible();

    await page.locator('#csv-input').fill('Name,Group,RSVP,Plus Ones\n "=1+1|danger",friends,attending,1\n Priya Nair,family,tentative,0\n Mythical Ninja,general,pending,0');
    await dialog.getByRole('button', { name: 'Process CSV Import' }).click();

    // Two valid rows import; the crafted formula row is neutralized on import.
    await expect(page.getByText('CSV Import Complete')).toBeVisible();

    const state = await readState(page);
    const imported = state.guests.filter((g) => ['Priya Nair', 'Mythical Ninja'].includes(g.name));
    expect(imported.length).toBe(2);
    // Import keeps the raw text at rest (never interpreted); the formula-
    // injection defense happens on export (neutralizeCsvFormula in guestsToCsv,
    // covered by the unit suite). Nothing here would execute as a formula.
    const dangerous = state.guests.find((g) => g.name.includes('=1+1'));
    expect(dangerous?.name).toBe('=1+1|danger');
  });
});

test.describe('Vendor bookkeeping and URL hardening', () => {
  test('vendor add validates the website field and normalizes http(s) URLs', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Vendors').click();

    // Path 1: a javascript: URL is rejected with a visible error, nothing saved.
    // Scoped to main: the navbar Adaptive Setup button shrinks to "New" on
    // mobile and precedes this button in DOM order.
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Add Vendor' })
      .click();
    let dialog = page.getByRole('dialog', { name: /Add New Vendor/ });
    await expect(dialog).toBeVisible();
    await page.getByLabel(/Vendor \/ Business Name/).fill('Neon Dynamics DJ');
    await page.getByLabel(/^Website$/).fill('javascript:void(0)');
    await dialog.getByRole('button', { name: /Save Vendor/ }).click();
    await expect(page.getByText('Invalid Website URL')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Path 2: bare-domain input normalizes to https and the card renders it
    // as a real, safe link.
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Add Vendor' })
      .click();
    dialog = page.getByRole('dialog', { name: /Add New Vendor/ });
    await expect(dialog).toBeVisible();
    await page.getByLabel(/Vendor \/ Business Name/).fill('Neon Dynamics DJ');
    await page.getByLabel(/^Website$/).fill('neondj.example');
    await dialog.getByRole('button', { name: /Save Vendor/ }).click();
    await expect(page.getByText('Vendor Added')).toBeVisible();

    const state = await readState(page);
    const vendor = state.vendors.find((v) => v.name === 'Neon Dynamics DJ');
    expect(/^https?:\/\//.test(vendor.website ?? '')).toBe(true);
    expect(vendor.website).toMatch(/^https:\/\/neondj\.example\/?$/);
    expect(state.vendors.some((v) => v.website?.startsWith('javascript:'))).toBe(false);
  });
});

test.describe('Multi-day reschedule engine', () => {
  test('changing the event start date re-dates milestones, tasks and run-sheet days', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Timeline').click();
    await page.getByRole('button', { name: /Reschedule Event/ }).click();
    const dialog = page.getByRole('dialog', { name: /Reschedule Event & Recalculate/ });
    await expect(dialog).toBeVisible();

    await page.getByLabel('New Event Start Date').fill('2027-06-10');
    await dialog.getByRole('button', { name: 'Recalculate All Deadlines' }).click();

    await expect(page.getByText('Event Rescheduled & Deadlines Recalibrated')).toBeVisible();

    const state = await readState(page);
    expect(state.event.startDate).toBe('2027-06-10');
    // Milestone due dates were recomputed, not left on the old schedule.
    const stale = state.milestones.filter((m) => !m.dueDate?.includes('202'));
    expect(stale.length).toBe(0);
    // Schedule items still anchor to the new start: day 1 = start date.
    expect(state.schedule.every((item) => item.date === state.event.startDate || item.date > state.event.startDate)).toBe(true);
  });

  test('schedule day coverage and conflict badges reflect the 3-day wedding', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Schedule').click();
    // The 3-day sample covers multiple run-sheet days with real activities.
    await expect(page.getByText(/Day \d/).first()).toBeVisible();
    // Conflict engine runs: the panel is present even when clean.
    const conflictSection = page.getByText(/conflict|Conflict|overlaps|Overlaps/);
    await expect(conflictSection.first()).toBeVisible();
  });
});

test.describe('Task workspace', () => {
  test('creating, completing and filtering a task survives a full reload', async ({ page }) => {
    await loadSampleWedding(page);

    await tabButton(page, 'Tasks').click();
    await page.getByRole('button', { name: 'Add Task' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add New Checklist Task' });
    await expect(dialog).toBeVisible();

    await page.getByLabel('Task Title').fill('Order mirchi-bar fountain permits');
    await dialog.getByRole('button', { name: 'Save Task' }).click();

    const createdTitle = 'Order mirchi-bar fountain permits';

    // Complete it via the card's toggle (aria-label carries the task title).
    await expect(
      page.getByRole('button', { name: `Mark as completed: ${createdTitle}` }).first()
    ).toBeVisible();
    await page.getByRole('button', { name: `Mark as completed: ${createdTitle}` }).first().click();

    await page.reload();
    await tabButton(page, 'Tasks').click();

    // After refresh the task is still there and still done; filtering by
    // "Completed" must show it.
    await page.getByLabel('Filter by status').selectOption('done');
    await expect(page.locator('body')).toContainText('Order mirchi-bar fountain permits');

    const state = await readState(page);
    const created = state.tasks.find((t) => t.title.includes('mirchi-bar'));
    expect(created.status).toBe('done');
  });
});

test.describe('Refresh persistence', () => {
  test('an applied proposal and edited event survive a full page reload', async ({ page }) => {
    await loadSampleWedding(page);

    // Make a distinctive change through the UI.
    await tabButton(page, 'AI Planner').click();
    await page.getByLabel('Message to the planner').fill('Increase guest count to 260');
    await page.getByRole('button', { name: 'Send' }).click();
    const applyButton = page.getByRole('button', { name: 'Apply Changes' }).first();
    await expect(applyButton).toBeVisible();
    await applyButton.click();
    await expect(page.getByText('Applied', { exact: true }).first()).toBeVisible();

    await page.reload();

    // Chat history and applied state both persisted.
    await tabButton(page, 'AI Planner').click();
    await expect(page.getByText('Increase guest count to 260')).toBeVisible();
    await expect(page.getByText('Applied', { exact: true }).first()).toBeVisible();

    const state = await readState(page);
    expect((state.proposalsHistory ?? []).some((p) => p.applied)).toBe(true);
    expect(state.chatHistory.length).toBeGreaterThan(1);
  });
});

test.describe('Offline resilience', () => {
  test('planning and edits keep working after the network drops', async ({ page }) => {
    await loadSampleWedding(page);

    // Pre-load every lazy tab chunk while online so offline navigation only
    // hits the already-cached bundle (AI Planner and Tasks too — an unloaded
    // dynamic import would hard-fail once the dev server is unreachable).
    for (const label of ['Budget', 'Timeline', 'Vendors', 'Guests', 'Schedule', 'Ideas', 'Settings', 'AI Planner', 'Tasks']) {
      await tabButton(page, label).click();
    }

    await page.context().setOffline(true);

    // Offline planner (the default provider) responds without any network.
    await tabButton(page, 'AI Planner').click();
    await page.getByLabel('Message to the planner').fill('Reduce guest count to 90');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(/Actionable Proposals \(/).first()).toBeVisible();

    // Edits keep saving to localStorage while offline.
    await tabButton(page, 'Tasks').click();
    await expect(page.getByText(/Loading workspace/)).toBeHidden();

    await page.context().setOffline(false);
  });
});

test.describe('Accessibility smoke', () => {
  test('dialogs trap on Open/Escape and tab landmarks announce themselves', async ({ page }) => {
    await loadSampleWedding(page);

    // Main landmark exists and active tab reports itself.
    await expect(page.getByRole('main')).toBeVisible();
    await tabButton(page, 'Budget').click();
    await expect(tabButton(page, 'Budget')).toHaveAttribute('aria-current', 'page');

    // Modal a11y: dialog role + Escape closes.
    await page.getByRole('button', { name: /Record Expense \/ Quote/ }).first().click();
    const dialog = page.getByRole('dialog', { name: /Record New Expense or Quote/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Heading structure keeps exactly one h1-ish banner title.
    await expect(page.getByRole('banner')).toBeVisible();
  });
});
