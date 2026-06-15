export type GuidedFollowUpQuestion = {
  id: string;
  label: string;
  question: string;
};

const SUGGESTIONS: GuidedFollowUpQuestion[] = [
  {
    id: 'complaint-date',
    label: 'When the concern was raised',
    question: 'About when did you report the concern or ask for help?',
  },
  {
    id: 'complaint-recipient',
    label: 'Who received it',
    question: 'Who did you report this to?',
  },
  {
    id: 'hours-change-date',
    label: 'When hours changed',
    question: 'About when did your hours, pay, schedule, role, or treatment change?',
  },
  {
    id: 'records-after-change',
    label: 'Records before and after',
    question: 'Do you have schedules, paystubs, messages, or records showing what happened before and after?',
  },
  {
    id: 'termination-date',
    label: 'When employment ended',
    question: 'About when were you written up, suspended, demoted, terminated, or told your work was ending?',
  },
  {
    id: 'termination-records',
    label: 'Separation records',
    question: 'Do you have a write-up, termination notice, HR message, final schedule, or final pay record connected to that?',
  },
  {
    id: 'people-involved',
    label: 'People involved',
    question: 'Who was involved or present for the events you described?',
  },
  {
    id: 'witnesses',
    label: 'Witnesses',
    question: 'Were there any witnesses or coworkers who saw, heard, or received messages about what happened?',
  },
  {
    id: 'medical-request',
    label: 'Leave or accommodation records',
    question: 'Do you have doctor notes, leave forms, accommodation messages, or HR communications connected to this?',
  },
  {
    id: 'timeline-next',
    label: 'What happened next',
    question: 'What happened next?',
  },
  {
    id: 'story-missing',
    label: 'Anything missing',
    question: 'Is there anything important missing from your story?',
  },
  {
    id: 'firm-understanding',
    label: 'Most important context',
    question: 'What do you most want a firm to understand?',
  },
];

const FALLBACK_IDS = ['timeline-next', 'people-involved', 'records-after-change', 'story-missing'];

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function addUnique(ids: string[], id: string): void {
  if (!ids.includes(id)) ids.push(id);
}

export function suggestGuidedFollowUpQuestions(
  context: string,
  answeredLabels: string[] = []
): GuidedFollowUpQuestion[] {
  const text = context.toLowerCase();
  const ids: string[] = [];
  const answered = new Set(answeredLabels.map((label) => label.toLowerCase().trim()));

  if (hasAny(text, ['hr', 'human resources', 'complained', 'complaint', 'reported', 'report', 'asked for help'])) {
    addUnique(ids, 'complaint-date');
    addUnique(ids, 'complaint-recipient');
    addUnique(ids, 'records-after-change');
  }

  if (hasAny(text, ['hours', 'schedule', 'pay', 'paystub', 'paystubs', 'wage', 'overtime', 'shift'])) {
    addUnique(ids, 'hours-change-date');
    addUnique(ids, 'records-after-change');
  }

  if (hasAny(text, ['fired', 'terminated', 'termination', 'let go', 'laid off', 'written up', 'write-up', 'suspended', 'demoted'])) {
    addUnique(ids, 'termination-date');
    addUnique(ids, 'termination-records');
    addUnique(ids, 'timeline-next');
  }

  if (hasAny(text, ['manager', 'supervisor', 'coworker', 'co-worker', 'witness', 'hr', 'human resources'])) {
    addUnique(ids, 'people-involved');
    addUnique(ids, 'witnesses');
  }

  if (hasAny(text, ['medical', 'doctor', 'leave', 'accommodation', 'ms', 'disabled', 'disability', 'fmla'])) {
    addUnique(ids, 'medical-request');
    addUnique(ids, 'timeline-next');
  }

  if (hasAny(text, ['text', 'texts', 'email', 'emails', 'message', 'messages', 'photo', 'photos', 'screenshot', 'screenshots'])) {
    addUnique(ids, 'records-after-change');
  }

  for (const id of FALLBACK_IDS) addUnique(ids, id);

  return ids
    .map((id) => SUGGESTIONS.find((suggestion) => suggestion.id === id))
    .filter((suggestion): suggestion is GuidedFollowUpQuestion => Boolean(suggestion))
    .filter((suggestion) => !answered.has(suggestion.label.toLowerCase()))
    .slice(0, 5);
}
