/**
 * Deterministic people-role inference for intake intelligence.
 * Presentation only: no external lookup, no legal conclusions, no schema changes.
 */

export type InferredRoleLabel =
  | 'Worker'
  | 'Supervisor'
  | 'Manager'
  | 'Human Resources Representative'
  | 'Payroll Representative'
  | 'Executive / Leadership'
  | 'Witness'
  | 'Coworker'
  | 'Recruiter'
  | 'Accommodation Coordinator'
  | 'Leave Administrator'
  | 'Decision Maker'
  | 'Unknown Contact';

export type InferredRoleConfidence = 'high' | 'medium' | 'low';

export type InferredPersonRole = {
  name: string;
  role: InferredRoleLabel;
  confidence: InferredRoleConfidence;
};

const ROLE_RULES: Array<{ role: InferredRoleLabel; high: RegExp; medium?: RegExp }> = [
  {
    role: 'Human Resources Representative',
    high: /\b(human resources|hr generalist|hr manager|hr director|people operations|employee relations)\b/i,
    medium: /\b(hr|personnel)\b/i,
  },
  {
    role: 'Payroll Representative',
    high: /\b(payroll manager|payroll specialist|payroll coordinator|payroll department)\b/i,
    medium: /\bpayroll\b/i,
  },
  {
    role: 'Supervisor',
    high: /\b(supervisor|shift supervisor|warehouse supervisor|direct supervisor)\b/i,
  },
  {
    role: 'Manager',
    high: /\b(operations manager|department manager|general manager|store manager|manager)\b/i,
    medium: /\bmanagement\b/i,
  },
  {
    role: 'Executive / Leadership',
    high: /\b(chief executive|ceo|president|owner|founder|vice president|vp|director|leadership)\b/i,
  },
  {
    role: 'Accommodation Coordinator',
    high: /\b(accommodation coordinator|ada coordinator|interactive process coordinator)\b/i,
    medium: /\baccommodation\b/i,
  },
  {
    role: 'Leave Administrator',
    high: /\b(leave administrator|leave coordinator|fmla administrator|benefits administrator)\b/i,
    medium: /\b(fmla|medical leave|leave request)\b/i,
  },
  {
    role: 'Recruiter',
    high: /\b(recruiter|talent acquisition|hiring coordinator)\b/i,
  },
  {
    role: 'Decision Maker',
    high: /\b(decision maker|approved termination|issued termination|authorized termination|final decision)\b/i,
  },
  {
    role: 'Witness',
    high: /\b(witness statement|witnessed by|witness)\b/i,
  },
  {
    role: 'Coworker',
    high: /\b(coworker|co-worker|colleague|team member)\b/i,
  },
  {
    role: 'Worker',
    high: /\b(employee|worker|claimant|complainant)\b/i,
  },
];

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function nameTokens(name: string): string[] {
  return normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((part) => part.length >= 2);
}

function contextMentionsName(context: string, name: string): boolean {
  const lower = context.toLowerCase();
  const cleanName = normalizeName(name).toLowerCase();
  if (cleanName && lower.includes(cleanName)) return true;
  const tokens = nameTokens(name);
  if (!tokens.length) return false;
  return tokens.some((token) => lower.includes(token));
}

function contextsNearName(name: string, contexts: string[]): string {
  const hits: string[] = [];
  for (const context of contexts) {
    for (const line of context.split(/\n+/)) {
      if (contextMentionsName(line, name)) hits.push(line);
    }
  }
  return hits.join('\n').slice(0, 6000);
}

function explicitRoleFromContext(name: string, contexts: string[]): InferredPersonRole | null {
  const cleanName = normalizeName(name);
  const selfContext = cleanName;
  const hay = `${selfContext}\n${contextsNearName(cleanName, contexts)}`;
  for (const rule of ROLE_RULES) {
    if (rule.high.test(hay)) {
      return { name: normalizeName(name), role: rule.role, confidence: 'high' };
    }
    if (rule.medium?.test(hay)) {
      return { name: normalizeName(name), role: rule.role, confidence: 'medium' };
    }
  }
  return null;
}

export function inferPersonRole(opts: {
  name: string;
  contexts: string[];
  occurrenceCount?: number;
}): InferredPersonRole {
  const explicit = explicitRoleFromContext(opts.name, opts.contexts);
  if (explicit) return explicit;
  const count = opts.occurrenceCount ?? 0;
  if (count >= 3) {
    return { name: normalizeName(opts.name), role: 'Coworker', confidence: 'medium' };
  }
  if (count >= 2) {
    return { name: normalizeName(opts.name), role: 'Coworker', confidence: 'low' };
  }
  return { name: normalizeName(opts.name), role: 'Unknown Contact', confidence: 'low' };
}

export function formatPersonWithRole(
  name: string,
  role: InferredPersonRole | null | undefined,
  minConfidence: InferredRoleConfidence = 'medium'
): string {
  const cleanName = normalizeName(name);
  if (!role || role.role === 'Unknown Contact') return cleanName;
  const rank: Record<InferredRoleConfidence, number> = { low: 1, medium: 2, high: 3 };
  if (rank[role.confidence] < rank[minConfidence]) return cleanName;
  return `${cleanName} (${role.role})`;
}

export function inferRolesForPeople(opts: {
  names: string[];
  contexts: string[];
}): InferredPersonRole[] {
  const counts = new Map<string, number>();
  const display = new Map<string, string>();
  for (const raw of opts.names) {
    const name = normalizeName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    display.set(key, display.get(key) ?? name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, count]) =>
    inferPersonRole({
      name: display.get(key) ?? key,
      contexts: opts.contexts,
      occurrenceCount: count,
    })
  );
}
