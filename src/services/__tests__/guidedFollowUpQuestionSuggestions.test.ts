import { describe, expect, test } from 'vitest';
import { suggestGuidedFollowUpQuestions } from '../guidedFollowUpQuestionSuggestions';

describe('guided follow-up question suggestions', () => {
  test('suggests neutral complaint, recipient, schedule, and record follow-ups', () => {
    const questions = suggestGuidedFollowUpQuestions('I complained to HR and then my hours were cut.');
    const text = questions.map((q) => q.question).join('\n');

    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(questions.length).toBeLessThanOrEqual(5);
    expect(text).toContain('About when did you report the concern or ask for help?');
    expect(text).toContain('Who did you report this to?');
    expect(text).toContain('About when did your hours, pay, schedule, role, or treatment change?');
    expect(text).toContain('Do you have schedules, paystubs, messages, or records showing what happened before and after?');
  });

  test('uses medical leave wording without legal conclusions', () => {
    const questions = suggestGuidedFollowUpQuestions('I gave my manager a doctor note and asked for medical leave.');
    const text = questions.map((q) => q.question).join(' ');

    expect(text).toContain('doctor notes, leave forms, accommodation messages, or HR communications');
    expect(text).not.toMatch(/\b(retaliation|discrimination|wrongful termination|case|claim|illegal|liability)\b/i);
  });

  test('does not repeat already answered suggestion labels', () => {
    const questions = suggestGuidedFollowUpQuestions('I reported this to HR.', [
      'Who received it',
      'When the concern was raised',
    ]);
    const labels = questions.map((q) => q.label);

    expect(labels).not.toContain('Who received it');
    expect(labels).not.toContain('When the concern was raised');
  });
});
