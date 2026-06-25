import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT, buildChatRequest } from '../../../supabase/functions/chat-assistant/systemPrompt';
import { STARTER_QUESTIONS } from '../chatAssistant';

describe('Ask one3seven AI — system prompt integrity', () => {
  it('contains the core line (not truncated)', () => {
    expect(SYSTEM_PROMPT).toContain('one3seven organizes employment records');
  });
  it('contains banned vocabulary "violation"', () => {
    expect(SYSTEM_PROMPT).toContain('violation');
  });
  it('contains the 30-day pilot duration', () => {
    expect(SYSTEM_PROMPT).toContain('30-day');
  });
  it('contains the security posture and the no-overclaim guardrail', () => {
    expect(SYSTEM_PROMPT).toContain('SECURITY AND DATA POSTURE');
    expect(SYSTEM_PROMPT).toContain('independently verified');
    expect(SYSTEM_PROMPT).toContain('DO NOT CLAIM');
    expect(SYSTEM_PROMPT).toContain('SOC 2');
  });
});

describe('buildChatRequest', () => {
  it('attaches the system prompt (cached) and the correct model, passing messages through', () => {
    const msgs = [{ role: 'user', content: 'hi' }];
    const r = buildChatRequest(msgs);
    expect(r.system[0].text).toBe(SYSTEM_PROMPT);
    expect(r.system[0].cache_control.type).toBe('ephemeral');
    expect(r.model).toBe('claude-sonnet-4-6');
    expect(r.messages).toEqual(msgs);
  });
});

describe('starter questions', () => {
  it('has exactly four items', () => {
    expect(STARTER_QUESTIONS).toHaveLength(4);
  });
  it('includes the data-security starter', () => {
    expect(STARTER_QUESTIONS.some((q) => q.toLowerCase().includes('security'))).toBe(true);
  });
});
