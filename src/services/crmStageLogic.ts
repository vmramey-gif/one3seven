/**
 * Pure, side-effect-free CRM stage + follow-up logic. Kept separate from crmService (which
 * talks to Supabase) so it is fully unit-testable. When a sales activity is logged, the firm's
 * stage and next follow-up date may advance based on these rules.
 */

export type CrmStage =
  | 'target'
  | 'contacted'
  | 'convo'
  | 'demo_booked'
  | 'demo_done'
  | 'pilot'
  | 'paid'
  | 'no'
  | 'nurture';

export const CRM_STAGES: CrmStage[] = [
  'target', 'contacted', 'convo', 'demo_booked', 'demo_done', 'pilot', 'paid', 'no', 'nurture',
];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  target: 'Target',
  contacted: 'Contacted',
  convo: 'Conversation',
  demo_booked: 'Demo booked',
  demo_done: 'Demo done',
  pilot: 'Pilot',
  paid: 'Paid',
  no: 'No',
  nurture: 'Nurture',
};

export interface CrmActivityStageInput {
  /** Free-text outcome of the activity (e.g. fast-log outcomes). */
  outcome?: string | null;
  /** Explicit stage override chosen on the form. When set, it wins. */
  newStage?: CrmStage | null;
  /** Follow-up date the rep set on this activity (ISO yyyy-mm-dd). */
  nextFollowup?: string | null;
}

const isStage = (v: unknown): v is CrmStage =>
  typeof v === 'string' && (CRM_STAGES as string[]).includes(v);

/**
 * Determine the firm's stage after an activity is logged.
 * Precedence: explicit newStage > outcome keyword mapping > unchanged current stage.
 */
export function deriveStageFromActivity(
  activity: CrmActivityStageInput,
  currentStage: CrmStage
): CrmStage {
  if (isStage(activity.newStage)) return activity.newStage;

  const outcome = (activity.outcome ?? '').trim().toLowerCase();
  if (!outcome) return currentStage;

  if (outcome.includes('demo booked') || outcome.includes('booked a demo')) return 'demo_booked';
  if (outcome.includes('demo done') || outcome.includes('demo completed')) return 'demo_done';
  if (outcome.includes('pilot started') || outcome.includes('pilot') ) return 'pilot';
  if (outcome.includes('paid')) return 'paid';
  if (outcome.includes('not interested')) return 'no';

  return currentStage;
}

/**
 * Determine the firm's next follow-up date after an activity. A follow-up date set on the
 * activity propagates to the firm; otherwise the firm's existing date is unchanged.
 */
export function deriveNextFollowup(
  activity: CrmActivityStageInput,
  currentFollowup: string | null
): string | null {
  const next = (activity.nextFollowup ?? '').trim();
  return next ? next : currentFollowup;
}
