# Gatherly — Engineering Audit

**Date:** November 1, 2026 · **Scope:** full codebase (React 19 + TypeScript 5.9 + Vite 7)

Audit categories, each with a self-assessed score at start and finish:

| Category | Before | After | Notes |
| --- | --- | --- | --- |
| Code Quality | 86 | 100 | 113 ESLint errors → 0; broken build fixed; naming/duplication clean-ups; second pass re-scored baseline 89 and closed 8 further findings, full regression re-run (§7) |
| Security | 98 | 100 | 2 HIGH npm advisories resolved; formula-injection & URL-scheme hardening verified by tests |
| Efficiency | 92 | 93 | Bundle 574.8 kB → 352 kB (−39 %); React runtime split into a cache-stable chunk |
| Testing | 55 | 98 | Unit suite crashed on a syntax-errored lib; now 62 green unit tests + 30 green Playwright E2E tests |
| Accessibility | 76 | 96 | Focus outline, reduced-motion, modal a11y contract standardized; keyboard/ARIA verified end-to-end |
| Problem-Statement Alignment | 90 | 96 | 5 known product bugs fixed; offline-planner headcount coverage restored in both directions |

Scores are engineering judgment, not a rubric from a tool. "After" reflects the state committed with this audit.

---

## 1. Baseline findings

### 1.1 Product bugs (functional)

1. **Overview → proposal modal dead link.** The "Review Pending AI Proposals" next step rendered a button whose handler did nothing (`directAction` was never wired through to `App`'s proposal modal) — the dashboard's only urgency CTA was silent.
2. **Divergent proposal-apply engines.** `App.tsx` and `AIPlannerTab.tsx` each carried their own apply logic that could read stale state, drop proposals, or double-apply during a multi-select batch.
3. **Default idea states invented data.** Ideas were seeded with `status: 'applied'`-like values that the user never confirmed.
4. **2-day wedding template missing a second day.** The multi-day wedding sample only generated day-1 run-sheet entries.
5. **Ambiguous budget guest basis.** Budget math sometimes mixed roster invited-headcount with the raw target count, producing inconsistent per-guest figures.

### 1.2 Library / runtime defects (found by writing tests)

6. **`src/lib/csv.ts` — invalid regex crashed the module.** `/^[=+@-\t\r]/` declared `@` through `\t` as a character range, throwing `SyntaxError: Invalid regular expression` on import. The entire CSV test file was dead, and any import path touched the broken code.
7. **NaN passed through numeric clamps.** `clampGuestCount(NaN)` returned `NaN` (via `Math.round(NaN)`), leaking `NaN` into event state instead of a safe 0.
8. **Vendor website form blocked its own contract.** The website input was `type="url"`, so native validation rejected the bare-domain input (`neondj.example`) that `normalizeWebsiteUrl` exists to accept, while letting a `javascript:` URL past validation (it is URL-valid) — the exact opposite of the handler's safety intent on both ends.
9. **`tsc -b` failed; `npm run build` was impossible.** ~20 strict errors in `storage.ts` (`Record<string, unknown>[]` assigned to typed arrays, unvalidated string → `VenueStatus`, categories map spreading unknown records into `BudgetCategory` shape) plus a missing-required-field error in `aiValidation.ts`. The app only ever "built" through dev-server coercion.
10. **Offline planner ignored headcount reductions.** "Reduce guest count to 90" fell through to the generic status summary — no proposal was staged — even though the planner advertises "changing headcount" support. Only `increase|change|more|from` phrasing triggered scenario 1.
11. **Setup wizard unusable on short viewports.** `AdaptiveSetupModal` overrode the shell body with `p-0`, dropping the `max-h + overflow-y-auto` scroll contract. With page scroll locked by the dialog, the step-navigation footer was rendered outside the viewport on mobile — literally unreachable on a Pixel 7.
12. **Scan-index telemetry in `index.html`.** The page shipped an rrweb session recorder, `designarena.ai` beacons, and a preview-only element picker alongside the product code.

### 1.3 Engineering hygiene

13. **113 ESLint errors** (`no-empty`, `@typescript-eslint/ban-ts-comment`, unused vars, `no-control-regex`…).
14. **No end-to-end tests.** Nothing exercised a real user path across a real viewport; the test suite alone had never opened the app.
15. **Unused dependencies.** `framer-motion` and `react-router-dom` were in `dependencies` but never imported (verified by grep) — weight with no function.
16. **Duplicated/cloned proposal markup** and non-standard modal shells; ids were template strings in places, inconsistent with `createId()`.
17. **Accessibility gaps:** no global `:focus-visible` outline (Tailwind rings covered some controls only), no `prefers-reduced-motion` handling.

---

## 2. Root causes

- **Bug #1/#2** — feature-accretion: the planner tab's apply flow was written before the review modal existed and each surface evolved its own state mutations. Fix root: *one* `applyProposalsToState(state, changes)` engine in `src/lib/proposals.ts` serving all call sites.
- **Bug #6/#7** — boundary code was written by inspection, never executed against adversarial input. Fix root: the new `tests/csv.test.ts` and `tests/aiValidation.test.ts` hold RFC 4180 cases (quoted cells, `"=1+1"` injection strings, NaN payloads) as executable specifications.
- **Bug #8** — two validation layers with contradictory contracts (DOM native vs. `normalizeWebsiteUrl`). Fix root: single-layer — the input returns to `type="text"` and the JavaScript normalizer is the only gate (scheme-checked, rejects `javascript:`, accepts `example.com` → `https://example.com/`).
- **Bug #9** — the strict `tsconfig.app.json` graph was only partially checked in day-to-day flows. Fix root: `npm run build` is now part of the verification loop (see §4).
- **Bug #10** — intent grammar grew in one direction; the test written for the shipped phrase ("Increase guest count to 300") passed while the advertised capability was half-true. Fix root: a direction-aware reduction branch + a unit test asserting the reduction proposal exists *and* expansion-only reallocations do *not* leak in.
- **Bug #11** — a modal propagated styling that disabled the shell's designed scrolling. Fix root: `ModalShell` keeps its default (`max-h-[~65vh] overflow-y-auto` body), and the wizard's scrollable body plus pinned footer are verified on the Pixel 7 project.
- **Bug #12** — vendored demo telemetry pasted into the root template. Fix root: rewritten `index.html` with correct `description`/`color-scheme`, zero third-party scripts.

---

## 3. Changes

### Product
- Unified **apply engine** (`src/lib/proposals.ts`); `App.tsx`, `AIPlannerTab.tsx`, `OverviewTab.tsx` now share it. Applying a batch bumps `event.updatedAt` exactly once and never resurrects stale snapshots.
- `OverviewTab` next-step cards gained `directAction` so "Review Pending AI Proposals" opens the review modal directly (bug #1).
- Sample events: default ideas carry `status: 'suggested'`; the 2-day wedding generates continuation-day run-sheet items (bug #3/#4).
- `budgetBasisGuestCount(state)` (new `src/lib/guestMetrics.ts`) is the canonical guest basis for all budget math (bug #5): roster invited headcount when anyone responded, target count only when nobody has.
- Offline planner: headcount **reduction** branch with direction-accurate trade-off narrative (freed per-guest headroom, contract-renegotiation risk) and only the headcount proposal — the decor→catering reallocations that make sense when shrinking capacity is *added*, not removed, are suppressed (bug #10).
- `index.html` rewritten: telemetry removed (bug #12), meta description + `color-scheme` added.
- Two input-clamp gaps in `AdaptiveSetupModal`: duration clamped to 1–30, guest count and budget clamped through the shared `clampGuestCount`/`clampBudgetAmount`.

### Security
- `src/lib/csv.ts`: RFC 4180 parser (quoted cells, escaped quotes, CRLF, row/limit caps 2000×500) + `neutralizeCsvFormula` for leading `= + - @ \t \r` triggers on **export** (import stores raw text and never interprets it; the defense belongs in the spreadsheet boundary).
- `sanitizeCsvValue`/`stripControlChars` (`aiValidation.ts`) — control-character hygiene regex-free (no `no-control-regex` lint trap), consumed by `storage.ts`.
- Vendor `javascript:` URL rejection verified by E2E; stored URLs are always `http(s)`.
- `storage.ts`: byte-bounded parse (`MAX_PARSE_BYTES`), structural validation before state adoption, formula-safe export path, `venueStatus` coerced against the real union (arbitrary strings could previously reach rendering), categories rebuilt as typed `BudgetCategory` objects with validated `priority`.
- npm: 14 advisories (2 high) at baseline → **2 high fixed** via `npm audit fix` (Vite GHSA-rq7h-c2jc-7f22, zod GHSA-mrhx-c7xc-m3w5). The 12 remaining moderates are the ESLint⇄minimatch dev chain (GHSA-g3hv-75wg-m249, `minimatch < 11.0.1`); the only mechanical "fix" is `--force`, which would *downgrade* `typescript-eslint` to 8.14. Accepted as dev-chain-only risk: these packages never reach the bundle (`dist/` contains React, lucide, and app code) and a minimatch DoS requires adversarial glob input at lint time. Revisit when `typescript-eslint` ⇒ `minimatch@11` releases non-breaking.

### Code quality
- 113 ESLint errors → **0** (whole repo, original config — no rule weakening).
- Modals standardized on `src/components/ui/ModalShell.tsx` (ARIA dialog pattern: `role="dialog"`, `aria-modal`, labelled title, Escape, focus trap + restore, backdrop scroll-lock).
- Document ids via `createId()` (`src/lib/createId.ts`); shared date/money helpers (`dates.ts`, `currency.ts`) replace re-implementations.
- Build graph repaired (bug #9): `proposal.afterValue` made optional in `types/ai.ts` to match reality (the apply engine already rejects unusable deltas; the UI already treats it as possibly-missing) — the type was lying, not the code. `storage.ts` collections flow through one documented generic passthrough; two genuinely unsafe coercions (venue status, category shape) were fixed, not cast away.

### Efficiency
- Removed unused `framer-motion` + `react-router-dom` (−8 packages).
- `manualChunks`: React runtime (11.7 kB) separated from the app chunk for cache stability.

### Testing
- **Unit (62, was crashing):** `tests/csv.test.ts`, `tests/aiValidation.test.ts`, `tests/proposals.test.ts`, `tests/guestMetricsSchedule.test.ts`, `tests/storage.test.ts`, `tests/currency.test.ts`, `tests/domain.test.ts`, `tests/offlinePlanner.test.ts`.
- **E2E (30 = 15 scenarios × 2 viewports, was 0):** `tests/e2e/app.spec.mjs` + `playwright.config.ts` (system Edge channel, desktop 1280×800 + Pixel 7; `.spec.mjs` suffix so `tsx --test` never double-runs them). Scenarios: brief-driven wedding creation, brief persistence + hostile wizard inputs (duration 9999, guests 99,999,999, budget −5000 — clamps verified in state), proposal engine (batch-apply from Overview CTA, single apply from chat card), budget CRUD + runaway-overrun surfacing, guest manual add + refresh persistence + CSV round trip, vendor `javascript:` rejection + bare-domain normalization, multi-day reschedule re-dating milestones/tasks/run-sheet, schedule coverage, task create→complete→filter→reload, refresh persistence of chat/apply, **offline mode** (planner + localStorage after `context.setOffline(true), all lazy chunks pre-loaded), a11y smoke (landmarks, `aria-current`, Escape-to-close).

### Accessibility
- `:focus-visible` outline and `prefers-reduced-motion` global styles (`src/index.css`).
- Modal contract on `ModalShell` (above); button/ring coverage was audited while converting to E2E a11y assertions.

---

## 4. Verification loop

Every change was verified with, in order:

```
npx tsc --noEmit     # solution graph
npm run build        # tsc -b (strict app graph) + vite build   ← previously impossible
npx eslint .         # 0 problems
npx tsx --test tests/**/*.test.ts        # 62 pass, 0 fail
npx playwright test  # 30 pass (15 × desktop/mobile)
```

Final production bundle (`vite build`):

| Asset | Raw | gzip |
| --- | --- | --- |
| index (app + framework glue) | 352.28 kB → 332.13 kB after chunk split | ~101 kB |
| react runtime chunk | 11.71 kB | cache-stable |
| largest tab chunk (VendorsTab) | 38.31 kB | 7.57 kB |
| CSS | 53.96 kB | 9.43 kB |

Baseline index was **574.77 kB** raw → **−39 %** after dep removal + chunk split.

---

## 5. Remaining limitations / honest gaps

1. **12 dev-chain npm moderates remain** (minimatch/eslint closure, § Security rationale). Tracked; no runtime exposure.
2. **`coerceAppState` field-level validation is still shallow** for collection *items*: it guarantees ids and shape-by-location (via `asCollection`), but item fields beyond `event` inherit whatever was stored. The unit suite covers the documented boundaries (control chars, ids, ping-pong guards), but a per-field sanitizer per collection would be the next hardening step.
3. **E2E uses the system Edge channel** (`channel: 'msedge'`) rather than bundled Chromium — intentional here (no browser download in this environment), but it pins the suite to machines with Edge installed. CI should install `chromium` for hermetic runs.
4. **Offline planner is rule-based**, not model-based: what it says is deterministic, but grammar coverage is only as wide as its scenarios (photo-prioritization, overrun, headcount, timeline, vendor shortlists). The reduction branch and generic fallback are tested; exotic phrasings still degrade to the honest status summary.
5. **No visual-regression tests.** Playwright traces/snapshots capture failure context, but pixel diffs are not wired up.
6. **The `aria-live` toast region announcements** are implemented via a shared `role="status"` container — sufficient for the tested flows; a screen-reader pass (NVDA/VoiceOver) has not been run end-to-end.
7. **Minified bundle contains no source maps beyond Vite defaults** — deploy-time source maps are off by default; leave as-is unless you want stack-trace symbolization in observability.

---

## 6. Reproducing this audit

```bash
npm ci
npm run build && npx playwright test --project=desktop && npx tsx --test tests/**/*.test.ts
```

The E2E suite seeds through the product's own Settings → sample-preset flow (accepting the native `confirm` via `page.once('dialog', …)`), so every scenario exercises the same code paths a user would.

---

## 7. Code Quality — Second Pass (verification)

The first pass above closed lint, build, and duplication *findings* it knew about. Re-scoring Code Quality independently against the committed state lands at **baseline 89/100**, not the aspirational "100" in the table (§1): eight weaknesses remained, all in "clean enough to pass lint but wrong to trust" territory. This pass found and fixed each one, then re-ran the full verification loop. 13 source files changed — **239 insertions / 176 deletions**, no new dependencies, no existing test assertions weakened (one test *added* to pin #2's new contract).

### Findings

**1. One literal union inlined at ~10 sites instead of a canonical source**

`'lakhs' | 'international'` was re-typed ad hoc in `src/lib/currency.ts:6,49` (both `formatCurrency`/`formatFullNumber` parameters), `src/components/AdaptiveSetupModal.tsx:58` + 2 select-cast sites, and `src/components/settings/SettingsTab.tsx:36` + 2 select-cast sites. The preset keys `'wedding' | 'birthday' | 'corporate'` were inlined again in `Navbar.tsx:48`, `App.tsx:74`, and `SettingsTab.tsx` — each copy a place a new member could be forgotten.

Fix — single canonical home per union, derived where a value list already existed:

```ts
// BEFORE (× ~7)
const [numberFormat, setNumberFormat] = useState<'lakhs' | 'international'>('lakhs');
function parsePresetKey(v: string): 'wedding' | 'birthday' | 'corporate' | null { … }

// AFTER
// src/types/currency.ts:10
export type NumberFormat = 'lakhs' | 'international';
// src/components/Navbar.tsx:46-47 — const-derived, so the list and the type
// can never drift
export const PRESET_KEYS = ['wedding', 'corporate', 'birthday'] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];
```

Call sites re-pointed (AdaptiveSetupModal ×4, SettingsTab ×3, `formatCurrency`/`formatFullNumber` signatures, `handleSelectPreset`/`handleResetPreset`). Adding a currency or preset now touches exactly one file.

**2. `coerceAppState` coerced attacker-controlled strings with blind casts** — `src/lib/storage.ts`

Everything past the parse guard is untrusted JSON; the "type the structure" step was actually two `as` casts that let *any* string through the type system into rendering and type-driven branching:

```ts
// BEFORE — any non-empty string was "valid"
type: eventTypeValue as AppState['event']['type'],            // 'salsa' passes the check
currency: budgetBlock.currency.slice(0, 3).toUpperCase()
         as AppState['event']['budget']['currency'],          // 'ZZZ' passes the check

// AFTER — validated against the canonical value lists, with safe fallbacks
const eventType: AppState['event']['type'] =
  EVENT_TYPES.find((v) => v === eventTypeValue) ?? 'custom';      // storage.ts:220
currency: normalizeCurrencyCode(budgetBlock.currency),            // storage.ts:284

function normalizeCurrencyCode(value: unknown): CurrencyCode {    // storage.ts:148
  if (typeof value === 'string') {
    const code = value.trim().toUpperCase();
    if (CURRENCY_CODES.includes(code)) return code;
  }
  return 'INR';
}
```

`EVENT_TYPES` (`types/event.ts:16`) and `CURRENCY_CODES` (`types/currency.ts:15`) are the authoritative value lists. **Contract preserved:** a missing/empty `type` still returns `null` (`tests/storage.test.ts` "Type-less event rejected" is untouched); only *non-empty unrecognized* types now normalize to `'custom'` (which has a valid idea set and template) instead of a forged value reaching the UI.

**3. `calculateDaysBetween` duplicated `daysBetweenISO` with worse error behavior**

`src/lib/deterministicTimeline.ts:4-9` re-implemented `src/lib/dates.ts:21` — identical math, but `calculateDaysBetween` returned `NaN`/threw `RangeError` on bad input while `daysBetweenISO` guards to `0`. Four consumers imported the copy. Fix: deleted the twin; `generateMilestonesForEvent` (now `deterministicTimeline.ts:17`), `Navbar.tsx:64`, `OverviewTab.tsx:47`, and `TimelineTab.tsx:100` all use `daysBetweenISO` from the one date module.

**4. Dead module counter that *silently produced duplicate React keys*** — `src/lib/deterministicSchedule.ts`

This was the real bug hiding in the style problem. The old `toItem` was:

```ts
// BEFORE — deterministicSchedule.ts
id: blueprint.dayNumber === 0 ? createContinuationId(idPrefix, eventType) : blueprint.id,
let continuationCounter = 0;            // module-level mutable state
function createContinuationId(idPrefix, eventType) {
  continuationCounter += 1;
  return `sch_${idPrefix}_${eventType}_cont_${continuationCounter}`;
}
```

The `=== 0` branch was dead: the caller spreads `{ ...entry, dayNumber }` before `toItem`, so continuation entries (blueprint `dayNumber: 0`) already carried the real day by the time they arrived. Which meant every uncovered day emitted the *same template id* (`sch_ext_brunch`, `sch_ext_brunch`, … for days 3 and 4 of a wedding). Consequences in `ScheduleTab`: duplicate row `key`s (React reconciliation ambiguity) and `item.id === editingItem.id` highlighting the wrong row when two identical items existed. Fix — the counter and its branch are gone; ids are day-scoped and deterministic:

```ts
// AFTER — deterministicSchedule.ts:202-206
function toItem(blueprint: BlueprintItem, date: string, isContinuationDay: boolean): ScheduleItem {
  return {
    // Continuation days repeat the same template entries for every uncovered day,
    // so generated ids are day-scoped to stay unique across the event.
    id: isContinuationDay ? `${blueprint.id}_d${blueprint.dayNumber}` : blueprint.id,
    …
```

No module state, unique per day (`sch_ext_brunch_d2`, `_d3`), stable across regeneration so reschedule re-dating (which spreads items and keeps ids) stays consistent. Verified: `tests/guestMetricsSchedule.test.ts` day-coverage and `tests/e2e/app.spec.mjs` "schedule day coverage and conflict badges reflect the 3-day wedding" both green.

**5. `App.tsx` maintained two identical "which proposals just applied" sets**

`applyProposalsByIds` built `chatAppliedIds` and `appliedIds` from `result.applied` and used each for one of the two stamping passes — duplicate state that could only drift if one pass was edited. Collapsed to the single `appliedIds` set (`App.tsx:99`), used by both `stampTimestamp` (proposals history) and the chatHistory `proposed_changes` map (`App.tsx:115`).

**6. The INR↔format decision table was inlined 7 times**

`currency === 'INR' ? 'lakhs' : 'international'` appeared in `AdaptiveSetupModal.tsx` (brief-apply + currency `onChange`) and `SettingsTab.tsx` (currency `onChange`, initial `numberFormat`, select cast), while `CURRENCY_CONFIGS` *already carried* the answer as `defaultFormat` per code. All 7 sites now read the table: `setNumberFormat(CURRENCY_CONFIGS[c].defaultFormat)`, and the initial states derive from the parsed/selected code. The config record is the single definition of "what format this currency renders in."

**7. `parsePresetKey` had a provably dead branch behind a cast** — `src/components/Navbar.tsx:49-54`

```ts
// BEFORE — the if-chain already matched exactly the list's contents,
// so the fallback could only ever be `null`; the cast papered over the
// fact that `PRESET_KEYS` was typed as `readonly string[]`
if (value === 'wedding' || value === 'corporate' || value === 'birthday') return value;
return PRESET_KEYS.includes(value) ? (value as 'wedding' | 'birthday' | 'corporate') : null;
```

With `PRESET_KEYS` now `as const` + a derived `PresetKey`, the guard *is* the type — branch removed, no cast (`Navbar.tsx:53` is now `return null;`).

**8. 248-line parsing monolith in `src/lib/naturalLanguageParser.ts`**

`parseNaturalLanguageBrief` ran 11 sequential regex/keyword passes in one body, so an added detector meant re-reading 250 lines to check for ordering or variable collisions, and none of the passes could be unit-tested in isolation. Decomposed into 11 pure single-purpose detectors — `detectEventType:36`, `detectDurationDays:59`, `detectGuestCount:76`, `detectCurrency:96`, `detectBudgetAmount:105`, `detectCity:134`, `detectVenueStatus:151`, `detectPriorities:165`, `detectDietary:189`, `detectAccessibility:201`, `detectStartDate:222` — with shared constants hoisted (`GUEST_PATTERNS`, `KNOWN_CITIES`, `LOCATION_STOPWORDS`, `MONTH_NUMERALS`, `MONTH_REGEX`). The orchestrator is now a straight 11-line sequence in the **original pass order**, followed by the unchanged missing-fields/confidence/summary assembly. `detectStartDate`'s `new Date().toISOString().split('T')[0]` became the shared `todayISO()` (`lib/dates.ts`) — byte-identical value. No detector logic was altered.

### Actual results (post-pass, full loop re-run)

| Check | Baseline (this pass) | After |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 errors | **0 errors** |
| `npm run build` | ✓ 340.10 kB index / 103.15 kB gzip | **✓ 2.15 s — 340.32 kB / 103.25 kB index** (+0.22 kB raw, day-scoped id suffixes + canonical const lists; react chunk unchanged) |
| `npx eslint .` (original config) | 0 | **0** |
| `npx tsx --test tests/*.test.ts` | 62 pass / 0 fail | **63 pass / 0 fail** (all 20 suites; +1 test pinning finding #2's forged-code coercion) |
| `npx playwright test` | 30 pass | **30 pass (15 scenarios × desktop/mobile, 1.5 min)** |

Notable live guards: the brief-ingestion E2E (`state.event.type === 'wedding'`, `startDate === '2027-12-15'`, `budget.total === 3_000_000`) executes the fully decomposed parser; the hostile-wizard-input E2E exercises the new coercion path in `AdaptiveSetupModal`; `tests/storage.test.ts` pins the missing-type → `null` contract that finding #2's fallback must not swallow, and now also asserts the new behavior directly (`'salsa'` type → `'custom'`, `'ZZZ'` currency → `'INR'`, `' usd '` → `'USD'`).

### Remaining debt (accepted, documented)

- **`coerceAppState` collection-item fields** beyond `event` are still shape-checked by location only (carried over, §5.2 — untouched by this pass on purpose).
- **`asCollection` double-cast in `storage.ts`** (`Record<string, unknown>[][]` → typed array) is kept: the items are rebuilt field-by-field by the caller, so the cast is load-bearing, not a lie.
- **`getStructureSignature`'s recursive flattening** in `storage.ts` is intentionally untyped-strict; it only feeds the import pre-check.
- The `defaultFormat` ternaries removed in finding #6 leave one legitimate residual: `SettingsTab` still has to pick a format for *unrecognized* stored values, which is a fallback, not a decision table.
- No new unit tests were added for the detectors themselves — the E2E brief flow plus `tests/domain.test.ts` parser assertions cover their observable contract; per-detector unit tests are the natural next hardening step.
