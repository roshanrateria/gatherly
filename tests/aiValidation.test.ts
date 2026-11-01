import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  clampBudgetAmount,
  clampGuestCount,
  sanitizeAIResponse,
  stripControlChars,
  toSafeProposalPayload,
} from '../src/lib/aiValidation.ts';

describe('AI Response Sanitization', () => {
  it('returns null for any non-object or message-less payload', () => {
    assert.strictEqual(sanitizeAIResponse(null), null);
    assert.strictEqual(sanitizeAIResponse('plain text'), null);
    assert.strictEqual(sanitizeAIResponse([1, 2, 3]), null);
    assert.strictEqual(sanitizeAIResponse({}), null, 'No message at all');
    assert.strictEqual(sanitizeAIResponse({ message: '   ' }), null, 'Whitespace-only message');
  });

  it('strips control characters from every string it keeps', () => {
    const result = sanitizeAIResponse({
      message: 'Plan\u0000 set\u0007 with\u001B control chars',
      proposed_changes: [
        {
          id: 'p1',
          section: 'timeline',
          title: 'Escalate\u0008 the vendor check',
          description: 'Call venue before\u000C the deadline\u001F',
        },
      ],
      risks: [{ severity: 'high', issue: 'Venue\u000B may cancel\u0002' }],
    });

    assert.ok(result, 'Well-formed payload survives');
    assert.match(result.message, /Plan\s+set\s+with\s+control\s+chars/);
    assert.match(result.proposed_changes[0].title, /Escalate\s+the\s+vendor\s+check/);
    assert.match(result.risks[0].issue, /Venue\s+may\s+cancel/);
    for (const risky of [result.message, result.proposed_changes[0].description]) {
      // eslint-disable-next-line no-control-regex
      assert.doesNotMatch(risky, /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
    }
  });

  it('caps proposal volume and re-keys duplicate ids', () => {
    const proposed = Array.from({ length: 40 }, (_, i) => ({
      id: i < 20 ? 'dup_id' : `p${i}`,
      section: 'timeline',
      title: `Proposal ${i}`,
      description: `Structured change ${i}`,
    }));

    const result = sanitizeAIResponse({ message: 'msg', proposed_changes: proposed });
    assert.ok(result);
    assert.ok(result.proposed_changes.length <= 12, `Proposals capped, got ${result.proposed_changes.length}`);

    const ids = new Set(result.proposed_changes.map(p => p.id));
    assert.strictEqual(ids.size, result.proposed_changes.length, 'No duplicate proposal ids');
  });

  it('keeps only whitelisted budget keys and clamps monetary amounts', () => {
    const payload = toSafeProposalPayload({
      decorAllocated: 9e12,
      cateringAllocated: -500,
      photoAllocated: 12345.6,
      __proto__: { admin: true },
      intruderKey: 'x',
    });

    assert.ok(payload && typeof payload === 'object');
    assert.strictEqual((payload as Record<string, unknown>).decorAllocated, clampBudgetAmount(9e12));
    assert.strictEqual((payload as Record<string, unknown>).cateringAllocated, 0, 'Negative clamped to 0');
    assert.strictEqual((payload as Record<string, unknown>).photoAllocated, 12346, 'Rounded');
    assert.ok(!('intruderKey' in (payload as object)), 'Non-whitelisted keys dropped');
    assert.strictEqual(({} as Partial<Record<string, unknown>>).admin, undefined, 'No prototype pollution');
  });

  it('drops boolean and NaN payloads with no fallback invention', () => {
    assert.strictEqual(toSafeProposalPayload(Number.NaN), undefined);
    assert.strictEqual(toSafeProposalPayload('控制\u0007'.replace('\u0007', '')), '控制');
    assert.strictEqual(toSafeProposalPayload(''), undefined);
  });

  it('overall response retains structured narrative fields', () => {
    const result = sanitizeAIResponse({
      message: 'Budget adjusted.',
      reasoning_summary: 'Because your budget shrank.',
      assumptions: ['Assume 250 guests', 300, null],
      clarifying_questions: ['Keep the venue?'],
      recommendations: ['Trim decor'],
      risks: [
        { severity: 'extreme', issue: 'Overflow' },
        { issue: 'No severity given' },
        { severity: 'low', mitigation: 'No issue field' },
      ],
      next_steps: ['Review settings'],
      affected_sections: ['budget', 'unknown_section'],
    });

    assert.ok(result);
    assert.strictEqual(result.assumptions.length, 2, 'Non-string/number assumption dropped');
    assert.strictEqual(result.risks.length, 2, 'Risk with no issue dropped');
    assert.strictEqual(result.risks[0].severity, 'medium', 'Unknown severity defaults to medium');
    assert.strictEqual(result.risks[1].severity, 'medium');
  });
});

describe('Numeric clamps shared by AI + proposal paths', () => {
  it('clamps guest counts into a sane range', () => {
    assert.strictEqual(clampGuestCount(-5), 0);
    assert.strictEqual(clampGuestCount(0), 0);
    assert.strictEqual(clampGuestCount(250), 250);
    const max = clampGuestCount(Number.MAX_SAFE_INTEGER);
    assert.ok(max >= 100000 && max <= 1000000, `Max clamp applied, got ${max}`);
    assert.strictEqual(clampGuestCount(Number.NaN), 0);
  });

  it('clamps budget amounts into a non-negative range', () => {
    assert.strictEqual(clampBudgetAmount(-1), 0);
    assert.strictEqual(clampBudgetAmount(4500000), 4500000);
    assert.strictEqual(clampBudgetAmount(Number.NaN), 0);
    assert.strictEqual(clampBudgetAmount(Number.MAX_SAFE_INTEGER), clampBudgetAmount(999999999999 + 1));
  });
});

describe('stripControlChars', () => {
  it('removes C0/C1 controls but keeps tabs and newlines', () => {
    assert.strictEqual(stripControlChars('a\u0000b\u001Bc\u007Fd'), 'a b c d');
    assert.strictEqual(stripControlChars('line1\tline2\nline3\r\n'), 'line1\tline2\nline3\r\n');
    assert.strictEqual(stripControlChars('emoji 👍 ok'), 'emoji 👍 ok', 'Unicode text untouched');
  });
});
