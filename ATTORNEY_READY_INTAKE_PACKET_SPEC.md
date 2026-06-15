# one3Seven Attorney-Ready Intake Packet Spec

## Product Position

one3Seven helps workers organize employment-related records into an intake-ready packet for attorney review.

The product does not decide whether a worker has a case, does not provide legal advice, and does not make legal conclusions. It organizes facts, worker-provided context, and document signals so a worker can present materials clearly and a plaintiff-side employment attorney can review faster.

Core principle:

> AI organizes facts. Worker provides context. Attorney determines legal theory.

## Target Users

### Worker

The worker may feel overwhelmed, unsure whether their records matter, or unsure how to explain what happened. The worker should not need to know how to organize evidence like a lawyer.

The app should help the worker:

- Upload employment-related documents.
- Add their own context in plain language.
- See what records were recognized.
- See what information may be missing.
- Export or route an organized intake packet.

### Attorney / Law Firm

The attorney or firm is the paying customer. The packet must reduce intake friction and help attorneys decide whether to review, request more records, schedule a consultation, or decline quickly.

The packet should help attorneys answer:

- Who is the worker?
- Who is the employer?
- What happened according to the worker?
- What documents were provided?
- What dates appear in the records?
- What employment issue signals appear in the documents?
- What records are missing or incomplete?
- What should be reviewed first?

## Legal-Safe Guardrails

The app may say:

- "Worker reports..."
- "Uploaded records include..."
- "Document text appears to reference..."
- "This may be relevant for attorney review."
- "Confirm against original records."
- "No document of this type was found in the uploaded materials."
- "Review hint, not a final label."

The app must not say:

- "You have a case."
- "This is illegal."
- "The employer violated the law."
- "You should sue."
- "This proves retaliation/discrimination/wage theft."
- "You will win."
- "This claim is worth..."

Preferred neutral framing:

- "Issue signal"
- "Record pattern"
- "Possible review area"
- "Attorney review priority"
- "Worker-provided context"
- "Document-grounded observation"
- "Not a legal conclusion"

## Ideal Packet Structure

### 1. Intake Snapshot

Purpose: Give the attorney the fastest possible orientation.

Should include when available:

- Worker name and contact information.
- Employer / company name.
- Job title or role.
- Work location and remote-work location.
- Employment start and end dates.
- Current employment status.
- Termination or resignation date if present.
- Document count.
- Document date range.
- Intake status.

Safe wording:

> This snapshot is compiled from worker-provided information and uploaded document text. Confirm all important details against original records.

### 2. Worker's Stated Concern

Purpose: Preserve the worker's story without treating it as verified fact.

Should include:

- Short plain-English summary of the worker's own concern.
- Important dates the worker mentions.
- Names, employer details, and events the worker provides.
- Clear attribution.

Safe wording:

> Worker states:

Do not rewrite worker notes as verified facts. Do not merge worker narrative into document-grounded findings without attribution.

### 3. Document-Grounded Overview

Purpose: Summarize what the uploaded records appear to contain.

Should include:

- Number of documents scanned.
- Number with readable text.
- Major document types detected.
- Date-like references found.
- Repeated neutral terms or entities.
- Key limitation notes.

Safe wording:

> The uploaded records appear to include...

Avoid:

- Legal labels as conclusions.
- Overstating vague text signals.
- Treating worker notes as document proof.

### 4. Timeline for Review

Purpose: Give attorneys a fast chronological map.

Should include:

- Dates found in documents.
- Dates stated by the worker.
- Event descriptions only when supported by text or worker attribution.
- Source document names.
- Unknown or uncertain dates labeled clearly.

Suggested timeline event language:

- "Document text references..."
- "Worker reports..."
- "Uploaded file title suggests..."
- "Date found, event not yet classified."

### 5. Records Reviewed

Purpose: Make the evidence set reviewable.

For each uploaded file, show:

- File title.
- Stored category.
- Text-assisted suggested category.
- Extraction status.
- Date signals.
- Key neutral terms.
- Whether the text was readable.
- Whether attorney review is recommended for that file.

This table is high value for attorneys because it makes the record set scannable.

### 6. Issue Signal Map

Purpose: Organize records around plaintiff-side California employment screening categories without making legal conclusions.

Supported signal areas:

- Wage / hour / payroll.
- Overtime.
- Meal and rest break.
- Final pay / unpaid wages.
- Commission / bonus / contract pay.
- Reimbursement.
- Discrimination.
- Harassment.
- Retaliation / whistleblower.
- Leave / disability / accommodation.
- Pregnancy / maternity.
- Wrongful termination / separation.
- Misclassification / exempt status / contractor status.
- Public employee / administrative process.
- Contract / non-compete / restrictive covenant.
- Data breach / privacy, if employment-related.

Safe wording:

> Records contain terms often associated with wage/hour review.

Not:

> This is a wage theft case.

### 7. Record Patterns, Gaps, and Mismatches

Purpose: Show where the intake may need more documents or attorney attention.

Examples:

- Pay records found, but no time records uploaded.
- Time records found, but no pay stubs uploaded.
- Termination-related language found, but no termination letter uploaded.
- Worker mentions HR complaint, but no HR email/document uploaded.
- Worker mentions May 2, 2012, but no document date has been matched yet.
- Text extraction failed for one or more files.
- Generic file title, but document text suggests a more specific category.

Safe wording:

> This is a record gap to verify, not a determination that any record is required.

### 8. Key People and Entities

Purpose: Help attorneys identify who appears in the record set.

Should include:

- Employer names.
- HR names.
- Manager names.
- Payroll contacts.
- Witnesses named by worker.
- Agencies or departments.

Each entry should be labeled as:

- Found in document text.
- Worker-provided.
- Both document text and worker-provided.

Do not infer identity, role, or legal responsibility unless explicitly present.

### 9. Attorney Review Priorities

Purpose: Turn the packet into a useful workflow tool.

Examples:

- Review payroll and time records first.
- Confirm employment date range.
- Ask worker for offer letter or wage agreement.
- Ask worker for termination letter.
- Review HR communications around stated complaint date.
- Confirm whether missing records exist.
- Review extraction-failed files manually.

Safe wording:

> Suggested review priority for intake workflow only.

### 10. Worker-Provided Context

Purpose: Preserve the worker's voice separately.

This section should include:

- Intake notes.
- Upload context.
- Worker timeline edits.
- Worker-provided names/dates/events.

Required label:

> Worker-provided context. Not independently verified by one3Seven.

### 11. Platform Disclaimer

Required:

> one3Seven is not a law firm and does not provide legal advice. This packet organizes uploaded records and worker-provided context for intake preparation only. Attorneys determine legal theories, claims, defenses, deadlines, and next steps.

## Data Sources

### Current Sources

- `uploaded_files`
- `file_text_extractions`
- `intake_summaries`
- `timeline_events`
- worker notes / upload context
- file names and stored categories

### Current Limits

- Text-layer PDFs only.
- `.txt`, `.html`, `.json`, and text-layer PDFs are supported by Phase 2A extraction.
- No OCR yet.
- No DOCX parser yet.
- No actual LLM synthesis yet.
- Current AI-like summary is deterministic scan logic, not a legal review.

## Implementation Phases

### Phase 1: Packet Structure

Goal: Make the summary packet look like an attorney intake package even with deterministic logic.

Tasks:

- Rename sections around attorney review value.
- Add Intake Snapshot.
- Add Worker Stated Concern.
- Add Records Reviewed table.
- Add Issue Signal Map.
- Add Attorney Review Priorities.
- Keep worker context attributed.
- Keep legal guardrails.

No schema changes required if generated from existing rows.

### Phase 2: Better Deterministic Scan

Goal: Improve signals without adding OpenAI.

Tasks:

- Improve text-assisted document categories.
- Extract date signals more consistently.
- Extract employer/HR/payroll/person-like lines with caution.
- Add record gap detection.
- Add extraction-status explanations.
- Add issue-signal scoring with conservative thresholds.

No legal conclusions.

### Phase 3: LLM Synthesis Boundary

Goal: Add real AI summary only inside a controlled, legal-safe boundary.

Recommended boundary:

`synthesizeAttorneyReadyIntakePacket(input) -> structured JSON`

Input:

- uploaded file metadata
- completed extracted text
- worker-provided context, labeled separately
- extraction limitations

Output:

- intake snapshot
- worker concern
- document-grounded overview
- timeline draft
- issue signal map
- gaps and mismatches
- attorney review priorities
- disclaimers

Hard rules:

- No legal advice.
- No claim conclusions.
- Cite source file names for factual statements where possible.
- Use "insufficient information" when evidence is incomplete.

### Phase 4: Better File Coverage

Goal: Support the files workers actually have.

Tasks:

- DOCX extraction.
- OCR for scanned PDFs/images.
- Email export parsing if applicable.
- Better table extraction for paystubs/timecards.

### Phase 5: Attorney/Firm Workflow

Goal: Make the subscription value obvious.

Firm-side packet should support:

- Fast review queue.
- Issue signal filters.
- Missing records request.
- Firm code routing.
- Preview vs full access.
- Attorney notes.
- Status updates.
- Decline/request-more/accept workflow.

## MVP Success Criteria

An attorney should be able to open the packet and understand within 60-90 seconds:

- What the worker says happened.
- What records were uploaded.
- Which issue areas may deserve review.
- What dates and people appear.
- What records are missing.
- What to look at first.

A worker should feel:

- Less overwhelmed.
- More organized.
- Clear about what they uploaded.
- Clear that one3Seven is not deciding their case.

## Cursor Implementation Rule

Do not do a broad rewrite. Implement in small, testable passes:

1. Packet section structure and wording.
2. Existing data mapped into better sections.
3. Deterministic signal improvements.
4. Export alignment.
5. Optional AI/LLM only after the deterministic packet is valuable.
