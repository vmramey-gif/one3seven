import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasGuidedIntakeContent,
  saveGuidedIntakeToSession,
  loadGuidedIntakeFromSession,
  type GuidedIntakeAnswers,
} from '../guidedIntakePersistence';

// This test file runs under vitest's default 'node' environment (no jsdom dependency
// installed) — the module under test only needs getItem/setItem, so a minimal in-memory
// stub is enough rather than pulling in a browser DOM implementation.
class MemorySessionStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}
(globalThis as unknown as { sessionStorage: MemorySessionStorage }).sessionStorage = new MemorySessionStorage();

const baseAnswers: GuidedIntakeAnswers = {
  topics: [],
  context: '',
  availableRecords: [],
};

describe('guidedIntakePersistence — voiceAnswersDraft (uncommitted guided-voice progress)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('counts an unmerged voice answer as real content even when context is still empty', () => {
    // Regression: a worker answering guided-voice questions before hitting "Next" has
    // real progress that lived only in voiceAnswers state and was invisible to every
    // autosave/exit-confirmation check keyed off hasGuidedIntakeContent.
    const answers: GuidedIntakeAnswers = {
      ...baseAnswers,
      voiceAnswersDraft: [{ question: 'What happened?', label: 'What happened', answer: 'My manager cut my hours.' }],
    };
    expect(hasGuidedIntakeContent(answers)).toBe(true);
  });

  it('does not treat an empty voiceAnswersDraft as content', () => {
    expect(hasGuidedIntakeContent({ ...baseAnswers, voiceAnswersDraft: [] })).toBe(false);
  });

  it('round-trips voiceAnswersDraft through session storage', () => {
    const answers: GuidedIntakeAnswers = {
      ...baseAnswers,
      voiceAnswersDraft: [
        { question: 'Who was involved?', label: 'Who was involved', answer: 'My supervisor, Dana.' },
      ],
    };
    saveGuidedIntakeToSession('intake-1', answers);
    const restored = loadGuidedIntakeFromSession('intake-1');
    expect(restored?.voiceAnswersDraft).toEqual([
      { question: 'Who was involved?', label: 'Who was involved', answer: 'My supervisor, Dana.' },
    ]);
  });

  it('drops malformed or blank-answer entries on restore', () => {
    sessionStorage.setItem(
      'o3s_guided_intake_answers_v1_intake-2',
      JSON.stringify({
        ...baseAnswers,
        voiceAnswersDraft: [
          { question: 'Q', label: 'Real label', answer: '  actual text  ' },
          { question: 'Q2', label: '', answer: 'orphaned, no label' },
          { question: 'Q3', label: 'Empty answer', answer: '   ' },
        ],
      })
    );
    const restored = loadGuidedIntakeFromSession('intake-2');
    expect(restored?.voiceAnswersDraft).toEqual([{ question: 'Q', label: 'Real label', answer: '  actual text  ' }]);
  });
});
