import { AppState } from '../types/index';
import { AIConfig, AIProviderType } from '../types/ai';
import { createSampleWedding } from './sampleEvents';
import { createId } from './createId';
import { stripControlChars } from './aiValidation';

/**
 * Local persistence layer.
 *
 * Everything in localStorage is attacker-influenced input (crafted export
 * files, shared links, a compromised dependency writing to storage), so the
 * loader runs untrusted JSON through:
 *  1. a parse-time `__proto__`/`constructor`/`prototype` rejection guard
 *  2. size + depth + string-length caps
 *  3. structural coercion into `AppState` with numeric clamping
 */

const STORAGE_KEY = 'gatherly_state_v1';

const MAX_PARSE_BYTES = 5 * 1024 * 1024;
const MAX_COLLECTION_ITEMS = 2000;
const MAX_TEXT_CHARS = 4000;
const MAX_ID_CHARS = 80;
const MAX_KEY_CHARS = 100;
const MAX_DEPTH = 12;

const MAX_MONEY = 1_000_000_000_000;
const MAX_GUEST_COUNT = 1_000_000;
const MAX_DURATION_DAYS = 30;

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const VALID_PROVIDERS: readonly AIProviderType[] = ['offline', 'openai', 'anthropic', 'gemini', 'groq'];

type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

function parseJsonGuarded(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text, (key, val) => {
      if (UNSAFE_KEYS.has(key)) {
        throw new Error(`Unsafe property "${key}" in JSON`);
      }
      return val;
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON syntax' };
  }
  return { ok: true, value };
}

function truncateText(value: string, maxLength = MAX_TEXT_CHARS): string {
  // Strip control characters that break rendering, exports, or diff tools.
  const cleaned = stripControlChars(value);
  return cleaned.slice(0, maxLength);
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Recursive sanitizer: truncates strings, keeps finite numbers, drops junk. */
function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return null;
  if (typeof value === 'string') return truncateText(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_COLLECTION_ITEMS)
      .map((item) => sanitizeUnknown(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (UNSAFE_KEYS.has(key) || key.length > MAX_KEY_CHARS) continue;
      out[key] = sanitizeUnknown(raw, depth + 1);
    }
    return out;
  }
  return null; // functions, symbols, bigints, etc.
}

function asAnonymizedObjects(value: unknown, idPrefix: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => {
      const clone = { ...item };
      if (
        typeof clone.id !== 'string' ||
        clone.id.trim() === '' ||
        clone.id.length > MAX_ID_CHARS
      ) {
        clone.id = createId(idPrefix);
      }
      return clone;
    })
    .slice(0, MAX_COLLECTION_ITEMS);
}

function normalizeAIConfig(value: unknown): AIConfig {
  const base: AIConfig = {
    provider: 'offline',
    apiKey: '',
    model: 'offline-deterministic',
    discloseDataSharing: false,
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const record = value as Record<string, unknown>;
  const provider = VALID_PROVIDERS.includes(record.provider as AIProviderType)
    ? (record.provider as AIProviderType)
    : 'offline';
  const apiKey = typeof record.apiKey === 'string' ? record.apiKey.slice(0, 200) : '';
  const model = typeof record.model === 'string' && record.model.trim()
    ? record.model.slice(0, 120)
    : base.model;
  const baseUrl = typeof record.baseUrl === 'string' && record.baseUrl.trim()
    ? record.baseUrl.slice(0, 300)
    : undefined;
  return {
    provider,
    apiKey,
    model,
    baseUrl,
    discloseDataSharing: record.discloseDataSharing === true,
  };
}

function blankDefaults(): Partial<AppState> {
  return {
    expenses: [],
    scenarios: [],
    milestones: [],
    tasks: [],
    vendors: [],
    guests: [],
    schedule: [],
    ideas: [],
    chatHistory: [],
    proposalsHistory: [],
  };
}

/**
 * `asAnonymizedObjects` guarantees every entry is a record that carries its
 * id; coerceAppState is the per-field trust boundary for the rest of the
 * shape. This passthrough just carries what that boundary produced across the
 * storage-facing typed gap in one place.
 */
function asCollection<T extends readonly unknown[]>(collection: unknown, prefix: string): T {
  return asAnonymizedObjects(collection, prefix) as unknown as T;
}

/** Ensures every collection entry that the app indexes by id keeps an id. */
function finalizeCollections(state: Record<string, unknown>, stateDraft: Partial<AppState>): void {
  stateDraft.expenses = asCollection<AppState['expenses']>(state.expenses, 'exp');
  stateDraft.scenarios = asCollection<AppState['scenarios']>(state.scenarios, 'scen');
  stateDraft.milestones = asCollection<AppState['milestones']>(state.milestones, 'm');
  stateDraft.tasks = asCollection<AppState['tasks']>(state.tasks, 't');
  stateDraft.vendors = asCollection<AppState['vendors']>(state.vendors, 'v');
  stateDraft.guests = asCollection<AppState['guests']>(state.guests, 'g');
  stateDraft.schedule = asCollection<AppState['schedule']>(state.schedule, 'sch');
  stateDraft.ideas = asCollection<AppState['ideas']>(state.ideas, 'idea');
  stateDraft.chatHistory = asCollection<AppState['chatHistory']>(state.chatHistory, 'msg');
  stateDraft.proposalsHistory = asCollection<AppState['proposalsHistory']>(state.proposalsHistory, 'prop');
}

const VENUE_STATUSES: readonly string[] = ['secured', 'shortlisting', 'searching', 'home_or_private'];

/**
 * Coerces arbitrary parsed JSON into a safe `AppState`, or returns `null`
 * when the input lacks the mandatory event metadata.
 */
export function coerceAppState(value: unknown): AppState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;

  const sanitizedEvent = sanitizeUnknown(parsed.event) as Record<string, unknown> | null;
  const event = typeof sanitizedEvent === 'object' && sanitizedEvent !== null
    ? sanitizedEvent
    : null;
  if (!event) return null;

  const title = typeof event.title === 'string' ? event.title.trim() : '';
  const eventTypeValue = typeof event.type === 'string' ? event.type.trim() : '';
  if (!title || !eventTypeValue) {
    return null;
  }

  const guestsBlock =
    typeof event.guests === 'object' && event.guests !== null
      ? (event.guests as Record<string, unknown>)
      : {};
  const budgetBlock =
    typeof event.budget === 'object' && event.budget !== null
      ? (event.budget as Record<string, unknown>)
      : {};
  const locationBlock =
    typeof event.location === 'object' && event.location !== null
      ? (event.location as Record<string, unknown>)
      : {};

  const startDate = typeof event.startDate === 'string' && event.startDate.trim()
    ? event.startDate.trim().slice(0, 10)
    : new Date().toISOString().split('T')[0];
  const durationDays = clamp(
    Math.round(asFiniteNumber(event.durationDays, 1)),
    1,
    MAX_DURATION_DAYS
  );

  const categories = asAnonymizedObjects(parsed.categories, 'cat').map((cat) => {
    const rawPriority = typeof cat.priority === 'string' ? cat.priority : '';
    const priority = (['must_have', 'high', 'medium', 'flexible'] as const).includes(
      rawPriority as 'must_have'
    )
      ? (rawPriority as AppState['categories'][number]['priority'])
      : 'must_have';
    return {
      id: typeof cat.id === 'string' && cat.id ? cat.id : '',
      name: typeof cat.name === 'string' ? cat.name : 'Uncategorized',
      allocationPercent: clamp(asFiniteNumber(cat.allocationPercent, 0), 0, 100),
      allocatedAmount: clamp(asFiniteNumber(cat.allocatedAmount, 0), 0, MAX_MONEY),
      priority,
      description: typeof cat.description === 'string' ? cat.description : '',
      isCustom: cat.isCustom === true,
    };
  });

  const draft: Partial<AppState> = {
    event: {
      ...((event as unknown) as AppState['event']),
      title: title.slice(0, 120),
      type: eventTypeValue as AppState['event']['type'],
      startDate,
      endDate:
        typeof event.endDate === 'string' && event.endDate.trim()
          ? event.endDate.trim().slice(0, 10)
          : startDate,
      durationDays,
      guests: {
        count: clamp(Math.round(asFiniteNumber(guestsBlock.count, 1)), 0, MAX_GUEST_COUNT),
        bufferPercent: clamp(asFiniteNumber(guestsBlock.bufferPercent, 0), 0, 100),
        expectedAttendance: clamp(
          Math.round(asFiniteNumber(guestsBlock.expectedAttendance, 0)),
          0,
          MAX_GUEST_COUNT
        ),
      },
      budget: {
        total: clamp(asFiniteNumber(budgetBlock.total, 0), 0, MAX_MONEY),
        currency:
          typeof budgetBlock.currency === 'string' && budgetBlock.currency
            ? (budgetBlock.currency.slice(0, 3).toUpperCase() as AppState['event']['budget']['currency'])
            : 'INR',
        numberFormat: budgetBlock.numberFormat === 'international' ? 'international' : 'lakhs',
      },
      priorities: Array.isArray(event.priorities)
        ? (event.priorities.filter(p => typeof p === 'string') as string[])
        : [],
      location: {
        city: typeof locationBlock.city === 'string' ? locationBlock.city : '',
        venueStatus:
          typeof locationBlock.venueStatus === 'string' &&
          VENUE_STATUSES.includes(locationBlock.venueStatus)
            ? (locationBlock.venueStatus as AppState['event']['location']['venueStatus'])
            : 'searching',
        venueName: typeof locationBlock.venueName === 'string' ? locationBlock.venueName : undefined,
        country: typeof locationBlock.country === 'string' ? locationBlock.country : '',
      },
    },
    categories: categories.length > 0 ? categories : [],
    aiConfig: normalizeAIConfig(parsed.aiConfig),
    ...blankDefaults(),
  };

  finalizeCollections(parsed, draft);

  return draft as AppState;
}

export function loadStoredState(): AppState {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseJsonGuarded(raw);
        if (parsed.ok) {
          const state = coerceAppState(parsed.value);
          if (state) return state;
          console.error('Stored Gatherly state failed structural validation, resetting to default.');
        } else {
          console.error('Failed to parse stored Gatherly state:', parsed.error);
        }
      }
    }
  } catch (err) {
    console.error('Failed to read stored Gatherly state, resetting to default:', err);
  }
  return createSampleWedding();
}

export function saveStateToStorage(state: AppState): boolean {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(state);
      if (serialized.length > MAX_PARSE_BYTES) {
        console.error('Gatherly state exceeds localStorage budget; skipping save to protect data.');
        return false;
      }
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to save Gatherly state to localStorage:', err);
    return false;
  }
}

export function exportStateToJson(state: AppState): void {
  const jsonString = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeTitle = state.event.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const filename = `gatherly_backup_${safeTitle}_${new Date().toISOString().split('T')[0]}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { success: true; state: AppState }
  | { success: false; error: string };

/**
 * Validates an uploaded backup file. The returned state has already gone
 * through the same sanitizer as localStorage input, so it is safe to place
 * into React state directly.
 */
export function validateAndImportState(jsonString: string): ImportResult {
  if (typeof jsonString !== 'string' || jsonString.length === 0) {
    return { success: false, error: 'The selected file is empty.' };
  }
  if (jsonString.length > MAX_PARSE_BYTES) {
    return {
      success: false,
      error: `File is too large (max ${Math.floor(MAX_PARSE_BYTES / (1024 * 1024))} MB).`,
    };
  }

  const parsed = parseJsonGuarded(jsonString);
  if (!parsed.ok) {
    return { success: false, error: `Invalid JSON file syntax: ${parsed.error}` };
  }

  const state = coerceAppState(parsed.value);
  if (!state) {
    return { success: false, error: 'Missing core event metadata (title or event type).' };
  }
  if (!Array.isArray(state.categories)) {
    return { success: false, error: 'Corrupt budget categories list.' };
  }

  return { success: true, state };
}

/** Wipes the persisted state (used by "Erase all local data" in Settings). */
export function clearAllStoredData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear storage:', err);
  }
}

/** Convenience for settings screens: detect an untouched BYOK configuration. */
export function isBlankAIConfig(config: AIConfig | undefined): boolean {
  return !config || (!config.apiKey && (!config.model || config.model === 'offline-deterministic'));
}
