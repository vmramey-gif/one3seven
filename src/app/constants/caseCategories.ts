export const CALIFORNIA_BETA_CASE_CATEGORIES = [
  {
    name: 'Employment',
    description: 'Organize work, pay, and HR records for intake preparation.',
    helpfulRecords: ['Pay stubs', 'Time records', 'HR messages'],
  },
  {
    name: 'Personal Injury',
    description: 'Organize incident, medical, and insurance records for intake preparation.',
    helpfulRecords: ['Police reports', 'Medical bills', 'Insurance letters'],
  },
  {
    name: 'Family Law',
    description: 'Organize court, custody, and financial records for intake preparation.',
    helpfulRecords: ['Court filings', 'Custody schedules', 'Financial records'],
  },
  {
    name: 'Landlord-Tenant / Housing',
    description: 'Organize lease, notices, and habitability records for intake preparation.',
    helpfulRecords: ['Lease', 'Notices', 'Repair photos'],
  },
  {
    name: 'Criminal Defense',
    description: 'Organize citation, court, and incident records for intake preparation.',
    helpfulRecords: ['Citation', 'Court paperwork', 'Police reports'],
  },
  {
    name: 'Immigration',
    description: 'Organize immigration notices and identity records for intake preparation.',
    helpfulRecords: ['USCIS notices', 'Receipts', 'IDs and passports'],
  },
  {
    name: 'Estate Planning / Probate',
    description: 'Organize estate and court records for intake preparation.',
    helpfulRecords: ['Will or trust', 'Death certificate', 'Court notices'],
  },
  {
    name: 'Business / Contract Disputes',
    description: 'Organize contracts, communications, and payment records for intake preparation.',
    helpfulRecords: ['Contracts', 'Invoices', 'Demand letters'],
  },
  {
    name: 'Consumer Protection',
    description: 'Organize purchase, billing, and complaint records for intake preparation.',
    helpfulRecords: ['Receipts', 'Account statements', 'Complaint records'],
  },
  {
    name: 'Disability / Benefits',
    description: 'Organize benefits, medical, and agency records for intake preparation.',
    helpfulRecords: ['Denial letters', 'Agency notices', 'Hearing notices'],
  },
] as const;

export type IntakeCaseCategory = (typeof CALIFORNIA_BETA_CASE_CATEGORIES)[number]['name'];

export { UPLOAD_REDACTION_NOTICE } from './one3sevenProduct';

export const CATEGORY_SCAFFOLD_QUESTIONS: Record<string, string[]> = {
  'Personal Injury': [
    'What happened, in your own words?',
    'Date and location of incident',
    'Type of incident: car accident, slip/fall, dog bite, workplace injury, assault, other',
    'Do you have photos or videos of injuries, scene, property damage, or conditions?',
    'Do you have police reports, incident reports, insurance letters, medical bills, or treatment records?',
    'Were there witnesses?',
    'Have you missed work or lost income?',
    'Have you communicated with insurance companies?',
  ],
  'Family Law': [
    'What type of family matter is this? divorce, custody, support, restraining order, visitation, other',
    'Are there children involved?',
    'Are there existing court orders?',
    'Do you have court filings, custody schedules, financial records, messages, police reports, or prior agreements?',
    'Are there urgent safety or custody concerns?',
    'What outcome are you trying to organize information for?',
  ],
  'Landlord-Tenant / Housing': [
    'What is the housing issue? eviction, repairs, mold, deposit, rent increase, harassment, lockout, habitability, other',
    'Property city/county in California',
    'Do you have lease/rental agreement, notices, repair requests, photos/videos, inspection reports, texts/emails, rent receipts, deposit itemization?',
    'Date issue started',
    'Has landlord/property manager been notified?',
    'Any deadlines or court dates?',
  ],
  'Criminal Defense': [
    'What happened, in your own words?',
    'Date and county of incident/arrest/citation',
    'Charges or citation listed, if known',
    'Do you have police reports, citations, court paperwork, bail paperwork, bodycam/video links, witness info, photos, texts, or messages?',
    'Any upcoming court date?',
    'Are there protective orders or probation/parole concerns?',
    'Reminder: do not upload anything you are not comfortable sharing.',
  ],
  Immigration: [
    'What type of immigration help are you organizing records for? family petition, work authorization, DACA, asylum, removal/deportation, visa, green card, naturalization, other',
    'Current location in California',
    'Any deadlines, interviews, hearings, RFEs, NOIDs, or court dates?',
    'Do you have immigration notices, receipts, prior applications, IDs/passports, birth/marriage certificates, employment records, school records, police/court records?',
    'Preferred language',
    'Reminder: redact sensitive ID numbers if desired.',
  ],
  'Estate Planning / Probate': [
    'What type of matter? will/trust, probate, estate dispute, power of attorney, conservatorship, other',
    'Has someone passed away?',
    'County in California',
    'Do you have will, trust, death certificate, property records, bank/account records, beneficiary documents, family contact list, court notices?',
    'Are there urgent deadlines, property issues, or disputes among family members?',
  ],
  'Business / Contract Disputes': [
    'What type of dispute? unpaid invoice, broken contract, partnership issue, vendor/customer dispute, lease/commercial issue, fraud/misrepresentation, other',
    'Business or contract location in California',
    'Do you have contracts, invoices, emails/texts, payment records, proposals, receipts, demand letters, screenshots, account statements?',
    'Date dispute started',
    'What resolution are you organizing toward?',
  ],
  'Consumer Protection': [
    'What type of consumer issue? auto purchase/repair, debt collection, credit reporting, warranty, scam/fraud, defective product, unfair billing, other',
    'Company/business involved',
    'Do you have receipts, contracts, account statements, collection letters, credit reports, repair records, warranty documents, screenshots, emails/texts?',
    'Date issue started',
    'Have you complained to the business or agency?',
  ],
  'Disability / Benefits': [
    'What benefit issue are you organizing for? Social Security disability, unemployment, workers’ compensation, EDD, public benefits, private disability, other',
    'California county',
    'Do you have denial letters, application receipts, medical/work restrictions, wage records, employer letters, agency notices, appeal deadlines, hearing notices?',
    'Any upcoming deadline or hearing?',
    'Preferred contact/language needs',
  ],
};
