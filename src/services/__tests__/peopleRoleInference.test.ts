import { describe, expect, test } from 'vitest';
import {
  formatPersonWithRole,
  inferPersonRole,
  inferRolesForPeople,
} from '../peopleRoleInference';

describe('people role inference', () => {
  test('infers explicit workplace roles from same-line titles', () => {
    expect(
      inferPersonRole({
        name: 'Ashley Kim',
        contexts: ['Ashley Kim - HR Generalist'],
      })
    ).toMatchObject({
      role: 'Human Resources Representative',
      confidence: 'high',
    });

    expect(
      inferPersonRole({
        name: 'Michael Reed',
        contexts: ['Michael Reed, Operations Manager'],
      })
    ).toMatchObject({ role: 'Manager', confidence: 'high' });

    expect(
      inferPersonRole({
        name: 'Sarah Thompson',
        contexts: ['Sarah Thompson Warehouse Supervisor'],
      })
    ).toMatchObject({ role: 'Supervisor', confidence: 'high' });
  });

  test('does not treat a worker emailing HR as an HR representative', () => {
    const role = inferPersonRole({
      name: 'Jane Smith',
      contexts: ['From: Jane Smith\nTo: HR Department\nSubject: Formal complaint'],
    });

    expect(role.role).not.toBe('Human Resources Representative');
  });

  test('uses recurring references as low-risk coworker or witness context', () => {
    const role = inferPersonRole({
      name: 'David Lopez',
      contexts: ['David Lopez was present', 'David Lopez was copied', 'David Lopez saw the exchange'],
      occurrenceCount: 3,
    });

    expect(role).toMatchObject({ role: 'Coworker', confidence: 'medium' });
  });

  test('formats roles only at or above the requested confidence threshold', () => {
    const roles = inferRolesForPeople({
      names: ['Ashley Kim'],
      contexts: ['Ashley Kim - Human Resources'],
    });

    expect(formatPersonWithRole('Ashley Kim', roles[0], 'medium')).toBe(
      'Ashley Kim (Human Resources Representative)'
    );
  });
});

