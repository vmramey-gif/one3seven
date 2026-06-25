/**
 * Post-demo debrief capture (company demo guide). Writes to public.demo_debriefs (RLS:
 * members insert; rep reads own, founder reads all). The row mapping and the search-signal
 * summary are pure so they can be unit-tested without the network.
 */
import { supabase } from '../lib/supabaseClient';

export type LeanInMoment = 'mess' | 'timeline' | 'citation' | 'other';
export type DemoOutcome = 'yes' | 'maybe' | 'no';

export interface DemoDebriefInput {
  firmName: string;
  prospectName: string;
  painPhrase: string;
  leanInMoment: LeanInMoment | null;
  fellFlat: string;
  objections: string;
  featureRequest: string;
  askedForSearch: boolean;
  outcome: DemoOutcome | null;
  nextStep: string;
  nextStepDate: string; // yyyy-mm-dd or ''
  improvement: string;
}

export interface DemoDebriefRow {
  firm_name: string;
  prospect_name: string | null;
  pain_phrase: string | null;
  lean_in_moment: LeanInMoment | null;
  fell_flat: string | null;
  objections: string | null;
  feature_request: string | null;
  asked_for_search: boolean;
  outcome: DemoOutcome | null;
  next_step: string | null;
  next_step_date: string | null;
  improvement: string | null;
}

const clean = (s: string): string | null => {
  const t = s.trim();
  return t.length ? t : null;
};

/** Pure: map the controlled-form input to the DB row shape (empty strings -> null). */
export function toDebriefRow(input: DemoDebriefInput): DemoDebriefRow {
  return {
    firm_name: input.firmName.trim(),
    prospect_name: clean(input.prospectName),
    pain_phrase: clean(input.painPhrase),
    lean_in_moment: input.leanInMoment,
    fell_flat: clean(input.fellFlat),
    objections: clean(input.objections),
    feature_request: clean(input.featureRequest),
    asked_for_search: input.askedForSearch,
    outcome: input.outcome,
    next_step: clean(input.nextStep),
    next_step_date: clean(input.nextStepDate),
    improvement: clean(input.improvement),
  };
}

/** Pure: the AI-search demand signal — how many demos asked to interrogate the record. */
export function summarizeSearchSignal(rows: Array<{ asked_for_search: boolean }>): { asked: number; total: number } {
  return { asked: rows.filter((r) => r.asked_for_search).length, total: rows.length };
}

export async function submitDemoDebrief(input: DemoDebriefInput): Promise<{ error: string | null }> {
  if (!input.firmName.trim()) return { error: 'Firm name is required.' };
  const { error } = await supabase.from('demo_debriefs').insert(toDebriefRow(input));
  return { error: error?.message ?? null };
}

/** Founder/own-rows (RLS-enforced) search-signal count for a simple "N of M asked to search". */
export async function getSearchSignal(): Promise<{ asked: number; total: number }> {
  const { data, error } = await supabase.from('demo_debriefs').select('asked_for_search');
  if (error || !data) return { asked: 0, total: 0 };
  return summarizeSearchSignal(data);
}
