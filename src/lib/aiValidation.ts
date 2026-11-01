import {
  BudgetAllocationKey,
  ProposalPayload,
  ProposedChange,
  RiskItem,
  StructuredAIResponse,
} from '../types/ai';
import { createId } from './createId';

/**
 * Defense-in-depth sanitizer for structured responses returned by external
 * LLM providers. Model output is untrusted input: length-capped text, closed
 * enum validation, whitelisted numeric payloads and strictly typed proposals
 * before anything is stored in state or offered for application.
 */
export const BUDGET_ALLOCATION_KEYS: readonly BudgetAllocationKey[] = [
  'decorAllocated',
  'cateringAllocated',
  'photoAllocated',
];

const VALID_SECTIONS: readonly ProposedChange['section'][] = [
  'budget',
  'guest',
  'timeline',
  'task',
  'schedule',
  'vendor',
  'details',
];

const VALID_SEVERITIES = new Set(['low', 'medium', 'high']);

// Publication limits: what a single AI reply may contribute to state.
const MAX_MESSAGE_CHARS = 4000;
const MAX_ITEM_TEXT_CHARS = 1200;
const MAX_TITLE_CHARS = 200;
const MAX_FIELD_ID_CHARS = 80;
const MAX_LIST_ITEMS = 30;
const MAX_PROPOSALS = 12;
const MAX_RISKS = 10;

const MAX_MONEY_VALUE = 1_000_000_000_000;
const MAX_GUEST_COUNT = 100_000;

/** Control characters that break rendering or terminal output. */
export function stripControlChars(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // Keep tab, LF and CR; strip every other C0/C1 control character.
    if (code === 0x7f || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)) {
      out += ' ';
    } else {
      out += ch;
    }
  }
  return out;
}

function toSafeText(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
  }
  const cleaned = stripControlChars(value).trim();
  return cleaned.slice(0, maxLength);
}

function toSafeTextList(value: unknown, maxLength = MAX_ITEM_TEXT_CHARS): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string | number =>
      typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))
    .map((item) => toSafeText(item, maxLength))
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_MONEY_VALUE, Math.max(0, Math.round(value)));
}

/**
 * Normalizes an `afterValue`/`beforeValue` payload: numerics stay finite and
 * in range; budget objects keep only whitelisted keys; strings are capped.
 */
export function toSafeProposalPayload(value: unknown): ProposalPayload | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const text = toSafeText(value, MAX_ITEM_TEXT_CHARS);
    return text.length > 0 ? text : undefined;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const out: Partial<Record<BudgetAllocationKey, number>> = {};
    let written = false;
    for (const key of BUDGET_ALLOCATION_KEYS) {
      const raw = (value as Record<string, unknown>)[key];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        out[key] = clampMoney(raw);
        written = true;
      }
    }
    return written ? out : undefined;
  }
  return undefined;
}

function sanitizeProposal(raw: unknown): ProposedChange | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const section = VALID_SECTIONS.includes(record.section as ProposedChange['section'])
    ? (record.section as ProposedChange['section'])
    : null;
  const title = toSafeText(record.title, MAX_TITLE_CHARS);
  const description = toSafeText(record.description, MAX_MESSAGE_CHARS);
  if (!section || !title || !description) return null;

  const directId = typeof record.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(record.id)
    ? record.id
    : null;
  const id = directId ?? createId('prop_ai');

  const proposal: ProposedChange = {
    id,
    section,
    title,
    description,
    applied: false,
    timestamp: new Date().toISOString(),
  };

  const beforeValue = toSafeProposalPayload(record.beforeValue);
  if (beforeValue !== undefined) proposal.beforeValue = beforeValue;
  const afterValue = toSafeProposalPayload(record.afterValue);
  if (afterValue !== undefined) proposal.afterValue = afterValue;

  // Note: the caller additionally de-duplicates ids within one response batch.
  return proposal;
}

function sanitizeRisk(raw: unknown): RiskItem | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const issue = toSafeText(record.issue, MAX_ITEM_TEXT_CHARS);
  const mitigation = toSafeText(record.mitigation, MAX_ITEM_TEXT_CHARS);
  if (!issue) return null;
  const severity = VALID_SEVERITIES.has(record.severity as string)
    ? (record.severity as RiskItem['severity'])
    : 'medium';
  return { severity, issue, mitigation };
}

/**
 * Converts an arbitrary parsed provider payload into a guaranteed-shape
 * `StructuredAIResponse`, or `null` when the payload lacks the minimum
 * required content (a non-empty message).
 */
export function sanitizeAIResponse(raw: unknown): StructuredAIResponse | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const message = toSafeText(record.message, MAX_MESSAGE_CHARS);
  if (!message) return null;

  const proposalsRaw = Array.isArray(record.proposed_changes) ? record.proposed_changes : [];
  const seenIds = new Set<string>();
  const proposedChanges: ProposedChange[] = [];
  for (const item of proposalsRaw.slice(0, MAX_PROPOSALS * 2)) {
    const proposal = sanitizeProposal(item);
    if (!proposal) continue;
    while (seenIds.has(proposal.id)) {
      proposal.id = `${proposal.id}_${proposedChanges.length + 1}`;
      if (proposal.id.length > MAX_FIELD_ID_CHARS + 8) {
        proposal.id = createId('prop_ai');
      }
    }
    seenIds.add(proposal.id);
    proposedChanges.push(proposal);
    if (proposedChanges.length >= MAX_PROPOSALS) break;
  }

  const risksRaw = Array.isArray(record.risks) ? record.risks : [];
  const risks: RiskItem[] = [];
  for (const item of risksRaw.slice(0, MAX_RISKS * 2)) {
    const risk = sanitizeRisk(item);
    if (risk) risks.push(risk);
    if (risks.length >= MAX_RISKS) break;
  }

  return {
    message,
    reasoning_summary: toSafeText(record.reasoning_summary, MAX_MESSAGE_CHARS),
    assumptions: toSafeTextList(record.assumptions),
    clarifying_questions: toSafeTextList(record.clarifying_questions),
    recommendations: toSafeTextList(record.recommendations),
    proposed_changes: proposedChanges,
    affected_sections: toSafeTextList(record.affected_sections, MAX_TITLE_CHARS),
    risks,
    next_steps: toSafeTextList(record.next_steps),
  };
}

/** Clamp used by the offline planner for live counts it echoes from state. */
export function clampGuestCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_GUEST_COUNT, Math.max(0, Math.round(value)));
}

/** Clamp applied to any budget figure entering the state from AI payloads. */
export function clampBudgetAmount(value: number): number {
  return clampMoney(value);
}
