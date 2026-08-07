/**
 * Static, precomputed data for the 5-persona sales demo (/sales-demo-7k2m9x4p).
 *
 * Every field below is REAL organization-engine output — generated once by running the same
 * gauntlet-verified synthetic persona fixtures (Marcus Webb, Daniela Reyes-Okafor, Tomás Ferreira,
 * Gwen Baptiste, Rosa Maldonado-Vieyra — see docs/memory project_extraction_accuracy for the
 * 76/76 multi-persona gauntlet these fixtures passed) through the identical pipeline call chain
 * `persistPlaceholderOrganizationForIntake` uses in production, then serialized to the JSON files
 * in `./data/*.json`. That one-time build script is NOT part of this repo's shipped code — this
 * module is the only thing the demo route imports, and it is pure static data.
 *
 * All five people are entirely FICTIONAL, invented for testing. Never confuse with any real
 * worker's data.
 *
 * The `firm` field is shaped exactly like `FirmLiveIntakeView` (see DemoApp.tsx for the
 * single-persona precedent this follows) so it can be fed straight into the real
 * `IntakeReviewScreen` component with `demoMode`. The `worker` field is a lighter custom shape
 * consumed by this demo's own worker-summary screen.
 */
import type { FirmLiveIntakeView } from '../../services/intakeDataService';
import type { EmploymentMatterTagId } from '../constants/employmentMatter';
import type { StoryFollowUpAnswers } from '../constants/workerStoryIntake';
import type { RecordState } from '../../services/caEmployerRecordRequirements';
import type { IntakeIntelligence } from '../../services/documentFactsService';

import p1 from './data/p1.json';
import p2 from './data/p2.json';
import p3 from './data/p3.json';
import p4 from './data/p4.json';
import p5 from './data/p5.json';

export type PersonaWorkerTimelineItem = {
  date: string;
  event: string;
  category: string;
  summary: string;
  relatedDocs: number;
  sourceFileNames: string[];
  sourceDates: string[];
  sourceStrength: string | null;
};

export type PersonaCoverageItem = {
  key: string;
  label: string;
  citation: string;
  state: RecordState;
  describeMissing: string;
  workerObtainable: boolean;
};

export type PersonaWorkerData = {
  personaId: string;
  workerName: string;
  employer: string;
  employmentDates: string | null;
  scenarioLabel: string;
  storyText: string;
  organizedSummary: string;
  docCount: number;
  timeline: PersonaWorkerTimelineItem[];
  employmentMatterTags: EmploymentMatterTagId[];
  coverage: PersonaCoverageItem[];
  readiness: string[];
  missing: string[];
  fileInventory: Array<{ fileName: string; category: string }>;
};

export type PersonaDemoEntry = {
  personaId: string;
  personaName: string;
  scenarioLabel: string;
  firm: FirmLiveIntakeView;
  worker: PersonaWorkerData;
};

/** Shape written by the one-time build script — decoupled from TS's inferred JSON-module type. */
type RawPersonaJson = {
  personaId: string;
  personaName: string;
  firm: {
    previewOnly: boolean;
    routeId: string;
    routeStatus: string;
    intakeNumber: string;
    isFirmCodeIntake: boolean;
    submissionChannel: string;
    intakeWorkflowStatus: string;
    overview: string;
    timelineSummary: string;
    workerProvidedContext: string;
    workerFollowUp: Record<string, string> | null;
    employmentMatterTags: string[];
    events: Array<{
      id: string;
      event_date: string;
      title: string;
      category: string;
      ai_summary: string;
      worker_context: string;
    }>;
    files: Array<{ file_name: string; category: string }>;
    readiness: string[];
    missing: string[];
    documentRequest: null;
    documentResponse: null;
    intelligence: IntakeIntelligence;
  };
  worker: {
    personaId: string;
    workerName: string;
    employer: string;
    employmentDates: string | null;
    scenarioLabel: string;
    storyText: string;
    organizedSummary: string;
    docCount: number;
    timeline: PersonaWorkerTimelineItem[];
    employmentMatterTags: string[];
    coverage: PersonaCoverageItem[];
    readiness: string[];
    missing: string[];
    fileInventory: Array<{ fileName: string; category: string }>;
  };
};

function toEntry(rawJson: unknown): PersonaDemoEntry {
  const raw = rawJson as RawPersonaJson;
  const firm: FirmLiveIntakeView = {
    previewOnly: raw.firm.previewOnly,
    routeId: raw.firm.routeId,
    routeStatus: raw.firm.routeStatus,
    intakeNumber: raw.firm.intakeNumber,
    isFirmCodeIntake: raw.firm.isFirmCodeIntake,
    submissionChannel: raw.firm.submissionChannel,
    intakeWorkflowStatus: raw.firm.intakeWorkflowStatus,
    overview: raw.firm.overview,
    timelineSummary: raw.firm.timelineSummary,
    workerProvidedContext: raw.firm.workerProvidedContext,
    workerFollowUp: raw.firm.workerFollowUp as StoryFollowUpAnswers | null,
    employmentMatterTags: raw.firm.employmentMatterTags as EmploymentMatterTagId[],
    events: raw.firm.events,
    files: raw.firm.files,
    readiness: raw.firm.readiness,
    missing: raw.firm.missing,
    documentRequest: raw.firm.documentRequest,
    documentResponse: raw.firm.documentResponse,
    intelligence: raw.firm.intelligence,
  };
  return {
    personaId: raw.personaId,
    personaName: raw.personaName,
    scenarioLabel: raw.worker.scenarioLabel,
    firm,
    worker: {
      ...raw.worker,
      employmentMatterTags: raw.worker.employmentMatterTags as EmploymentMatterTagId[],
    },
  };
}

/** All 5 synthetic personas, ready to feed into the demo's picker → worker → firm flow. */
export const PERSONA_DEMOS: PersonaDemoEntry[] = [p1, p2, p3, p4, p5].map(toEntry);

export function getPersonaDemo(personaId: string): PersonaDemoEntry | undefined {
  return PERSONA_DEMOS.find((p) => p.personaId === personaId);
}
