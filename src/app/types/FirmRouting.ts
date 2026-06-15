// Firm routing and preference matching for One3Seven intake distribution

import { IntakeWorkspace } from './IntakeWorkspace';

export interface FirmPreferences {
  firmId: string;
  firmName: string;

  // Geography preferences
  acceptedStates: string[]; // e.g., ['CA', 'NY', 'TX']
  acceptedCities?: string[]; // Optional city-level filtering

  // Category preferences
  acceptedCategories: string[]; // e.g., ['Overtime', 'Meal & Rest Periods']

  // Readiness threshold
  readinessThreshold: 'all' | 'ready-only' | 'complete-only';

  // Notification preferences
  notificationFrequency: 'instant' | 'daily' | 'weekly';

  // Active status
  isActive: boolean;
  acceptingNewIntakes: boolean; // maps to firm_profiles.accepting_cases
}

/**
 * Determines which firms should receive a given intake based on their preferences
 * This implements the controlled routing logic for "Share With Participating Firms"
 */
export function routeIntakeToEligibleFirms(
  intake: IntakeWorkspace,
  allFirmPreferences: FirmPreferences[]
): string[] {
  const eligibleFirmIds: string[] = [];

  for (const firm of allFirmPreferences) {
    // Skip inactive firms or those not accepting intakes
    if (!firm.isActive || !firm.acceptingNewIntakes) {
      continue;
    }

    // Check geography match
    const geographyMatch = checkGeographyMatch(intake, firm);
    if (!geographyMatch) {
      continue;
    }

    // Check category match
    const categoryMatch = checkCategoryMatch(intake, firm);
    if (!categoryMatch) {
      continue;
    }

    // Check readiness threshold
    const readinessMatch = checkReadinessThreshold(intake, firm);
    if (!readinessMatch) {
      continue;
    }

    // All criteria met - this firm should receive the intake
    eligibleFirmIds.push(firm.firmId);
  }

  return eligibleFirmIds;
}

/**
 * Check if intake geography matches firm preferences
 */
function checkGeographyMatch(
  intake: IntakeWorkspace,
  firm: FirmPreferences
): boolean {
  // Check employer state
  if (intake.employerState && firm.acceptedStates.includes(intake.employerState)) {
    return true;
  }

  // Check worker location state (if employer state not available)
  if (intake.workerLocation) {
    const locationState = extractStateFromLocation(intake.workerLocation);
    if (locationState && firm.acceptedStates.includes(locationState)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if intake categories match firm preferences
 */
function checkCategoryMatch(
  intake: IntakeWorkspace,
  firm: FirmPreferences
): boolean {
  // Check if any reported concern matches firm's accepted categories
  return intake.reportedConcerns.some((concern) =>
    firm.acceptedCategories.includes(concern)
  );
}

/**
 * Check if intake meets firm's readiness threshold
 */
function checkReadinessThreshold(
  intake: IntakeWorkspace,
  firm: FirmPreferences
): boolean {
  switch (firm.readinessThreshold) {
    case 'all':
      // Firm accepts all intakes regardless of completion
      return true;

    case 'ready-only':
      // Firm wants timeline organized with reasonable document count
      return intake.timelineComplete && intake.documents.length >= 3;

    case 'complete-only':
      // Firm wants complete timeline with substantial documentation
      return intake.timelineComplete && intake.documents.length >= 5;

    default:
      return true;
  }
}

/**
 * Extract state abbreviation from location string
 * E.g., "Los Angeles, CA" -> "CA"
 */
function extractStateFromLocation(location: string): string | null {
  const parts = location.split(',').map((part) => part.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 1].toUpperCase();
  }
  return null;
}

/**
 * Mock firm preferences for demonstration
 * In production, these would be stored in a database and managed through firm settings
 */
export const mockFirmPreferences: FirmPreferences[] = [
  {
    firmId: 'firm-001',
    firmName: 'California Labor Law Partners',
    acceptedStates: ['CA'],
    acceptedCategories: ['Overtime', 'Meal & Rest Periods', 'Final Pay', 'Classification Review'],
    readinessThreshold: 'ready-only',
    notificationFrequency: 'instant',
    isActive: true,
    acceptingNewIntakes: true,
  },
  {
    firmId: 'firm-002',
    firmName: 'West Coast Employment Advocates',
    acceptedStates: ['CA', 'OR', 'WA'],
    acceptedCategories: ['Overtime', 'Meal & Rest Periods', 'Reimbursement', 'Wage Theft'],
    readinessThreshold: 'all',
    notificationFrequency: 'daily',
    isActive: true,
    acceptingNewIntakes: true,
  },
  {
    firmId: 'firm-003',
    firmName: 'National Employment Rights Group',
    acceptedStates: ['CA', 'NY', 'TX', 'FL', 'IL'],
    acceptedCategories: ['Overtime', 'Classification Review', 'Wrongful Termination', 'Discrimination'],
    readinessThreshold: 'complete-only',
    notificationFrequency: 'weekly',
    isActive: true,
    acceptingNewIntakes: true,
  },
];

