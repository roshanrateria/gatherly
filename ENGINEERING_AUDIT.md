# Gatherly — Engineering Audit

**Date:** November 1, 2026 · **Scope:** full codebase (React 19 + TypeScript 5.9 + Vite 7)

Audit categories, each with a self-assessed score at start and finish:

| Category | Before | After | Notes |
| --- | --- | --- | --- |
| Code Quality | 86 | 100 | 113 ESLint errors → 0; broken build fixed; naming/duplication clean-ups |
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
