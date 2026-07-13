/**
 * Terms of Service and Privacy Policy content, verbatim from the founder-supplied
 * source document (one3seven_terms_and_privacy). Rendered by LegalDocPage and the
 * /terms and /privacy routes. The internal "attorney review notice" from the source
 * is intentionally omitted from the public page (it is a note to counsel, not a term).
 */

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'subhead'; text: string }
  | { type: 'bullets'; items: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  org: string;
  effective: string;
  intro: string;
  sections: LegalSection[];
}

export const TERMS_OF_SERVICE: LegalDoc = {
  title: 'Terms of Service',
  org: 'one3seven · One3Seven Ventures LLC',
  effective: 'Effective July 8, 2026',
  intro: 'Please read these Terms carefully before using the one3seven platform.',
  sections: [
    {
      heading: '1. What one3seven is',
      blocks: [
        { type: 'p', text: 'one3seven is currently in beta. Features may be added, changed, or removed as we continue to develop the platform, and portions may be temporarily unavailable while we make improvements. Your use of one3seven is also governed by our Privacy Policy, which explains how we collect, use, and protect information.' },
        { type: 'p', text: 'one3seven is a document organization platform operated by One3Seven Ventures LLC, a California limited liability company. one3seven helps workers organize their employment-related documents — including pay stubs, termination letters, HR communications, schedules, and related records — into a structured intake packet.' },
        { type: 'p', text: 'one3seven is not a law firm. one3seven does not provide legal advice. Use of one3seven does not create an attorney-client relationship between you and one3seven or between you and any law firm. one3seven organizes records — attorneys independently evaluate them.' },
      ],
    },
    {
      heading: '2. Who may use one3seven',
      blocks: [
        { type: 'p', text: 'You must be at least 18 years old to create an account and use one3seven. By creating an account, you represent that you are at least 18 years old and that you have the legal authority to share the documents you upload.' },
        { type: 'p', text: 'You may only upload documents that you have the right to share. You agree not to upload documents that belong to someone else without their authorization, or documents that you are legally prohibited from sharing.' },
      ],
    },
    {
      heading: '3. What you agree to when you upload documents',
      blocks: [
        { type: 'p', text: 'By uploading documents to one3seven, you confirm that:' },
        { type: 'bullets', items: [
          'You are choosing to share these records with one3seven for the purpose of document organization and intake preparation.',
          'You have reviewed what you are uploading and are comfortable sharing it for this purpose.',
          'You understand that sensitive information such as Social Security numbers, banking account numbers, medical record numbers, and information about minors may be present in your documents, and you have the option to redact such information before uploading.',
        ] },
        { type: 'p', text: 'You retain ownership of your documents. Uploading documents to one3seven does not transfer ownership or grant one3seven any rights to use your documents for any purpose other than organizing them for you.' },
        { type: 'p', text: 'one3seven does not sell your documents. one3seven does not share your documents with law firms without your explicit action to do so.' },
      ],
    },
    {
      heading: '4. How one3seven organizes your documents',
      blocks: [
        { type: 'p', text: 'one3seven uses automated processing, including artificial intelligence, to read your uploaded documents, extract information such as dates and events, and organize that information into a chronological intake summary.' },
        { type: 'p', text: 'The organized summary is an aid to preparation, not a legal evaluation. one3seven does not determine whether you have a legal claim, does not assess the strength or validity of any claim, and does not recommend any course of action. All legal judgments about your situation are made by licensed attorneys who independently evaluate the organized records.' },
        { type: 'p', text: 'one3seven’s processing is based on what your documents contain. If your documents are incomplete, the organized summary will reflect that incompleteness. one3seven does not fabricate information or fill in gaps.' },
        { type: 'p', text: 'Automated processing may occasionally miss, misread, or incorrectly organize information. You — and any attorney reviewing your intake — should review the original documents and not rely solely on the organized summary.' },
      ],
    },
    {
      heading: '5. Participating law firms',
      blocks: [
        { type: 'p', text: 'You choose which law firm to send your organized intake to. When you send your intake to a firm — using that firm’s intake link or firm code — that firm receives access to your organized intake summary and supporting documents. one3seven is a software tool: it does not refer, match, recommend, rank, endorse, evaluate, compare, or route you to any law firm.' },
        { type: 'p', text: 'Sending your intake to a firm does not guarantee that the firm will contact you, accept your matter, or represent you. An attorney-client relationship is created only through a separate written agreement between you and the law firm.' },
        { type: 'p', text: 'Law firms are independent businesses. one3seven is not responsible for the conduct, advice, or decisions of any law firm.' },
      ],
    },
    {
      heading: '6. Your account and data',
      blocks: [
        { type: 'p', text: 'You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account.' },
        { type: 'p', text: 'Your intake records are private to your account. No other worker account can access your records. Law firms can access your records only after you have submitted your intake to them or connected with them through the platform.' },
        { type: 'p', text: 'You may delete individual intakes and their associated records from your account at any time. Deletion removes the intake records from one3seven’s active systems. Note that one3seven’s database infrastructure maintains automated backups for a standard retention window as part of normal operations; deleted records may persist in backup systems for a limited period before those backups cycle. We may also retain limited information where retention is required by law or reasonably necessary to resolve disputes, prevent fraud, or enforce these Terms.' },
        { type: 'p', text: 'Account-level deletion (removing your account entirely) is not available through self-service during the current beta period. To request account deletion, contact one3seven at legal@one3seven.com. We will process your request promptly.' },
        { type: 'p', text: 'We may suspend or terminate access to one3seven if we reasonably believe these Terms have been violated, or if necessary to protect the platform, our users, or the rights and safety of others.' },
      ],
    },
    {
      heading: '7. Prohibited uses',
      blocks: [
        { type: 'p', text: 'You agree not to:' },
        { type: 'bullets', items: [
          'Use one3seven for any unlawful purpose or in violation of any applicable law.',
          'Upload documents that you do not have the right to share.',
          'Attempt to access another user’s account or records.',
          'Attempt to reverse-engineer, scrape, or interfere with one3seven’s systems.',
          'Use one3seven to harass, threaten, or harm any person.',
          'Misrepresent your identity or the nature of your employment situation.',
        ] },
      ],
    },
    {
      heading: '8. Intellectual property',
      blocks: [
        { type: 'p', text: 'The one3seven platform, including its design, code, and organizational methodology, is owned by One3Seven Ventures LLC. Your documents remain yours.' },
        { type: 'p', text: 'The organized summaries, timelines, and intake packets that one3seven produces from your documents are made available to you for your personal use in connection with your legal matter. You may share your organized packet with attorneys of your choosing.' },
      ],
    },
    {
      heading: '9. Disclaimers',
      blocks: [
        { type: 'p', text: 'one3seven is provided “as is” and “as available.” One3Seven Ventures LLC makes no warranty, express or implied, that the platform will be error-free, uninterrupted, or that the organized summaries will be complete or accurate in every case. We do not guarantee that the platform will always be available or that uploads will never fail.' },
        { type: 'p', text: 'While we use commercially reasonable administrative, technical, and organizational safeguards to protect information, no method of electronic storage or transmission is completely secure, and we cannot guarantee absolute security.' },
        { type: 'p', text: 'one3seven is a document organization tool. It is not a substitute for legal advice. You should consult a licensed attorney before making any decisions about your legal situation.' },
      ],
    },
    {
      heading: '10. Limitation of liability',
      blocks: [
        { type: 'p', text: 'To the maximum extent permitted by applicable law, One3Seven Ventures LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of one3seven, even if advised of the possibility of such damages.' },
        { type: 'p', text: 'One3Seven Ventures LLC’s total liability to you for any claims arising from your use of one3seven shall not exceed the greater of (a) the total amount you paid to one3seven in the twelve months preceding the claim, or (b) one hundred dollars ($100.00).' },
      ],
    },
    {
      heading: '11. Dispute resolution',
      blocks: [
        { type: 'p', text: 'These Terms are governed by the laws of the State of California, without regard to its conflict of law provisions.' },
        { type: 'p', text: 'Any dispute arising from these Terms or your use of one3seven that cannot be resolved informally shall be resolved by binding arbitration in Stockton, California, under the rules of the American Arbitration Association. You waive your right to participate in a class action lawsuit or class-wide arbitration.' },
        { type: 'p', text: 'Nothing in this section prevents you from filing a complaint with a government agency, including the California Labor Commissioner or the EEOC.' },
      ],
    },
    {
      heading: '12. Changes to these Terms',
      blocks: [
        { type: 'p', text: 'We may update these Terms from time to time. When we do, we will update the effective date at the top of this document. Continued use of one3seven after updated Terms are posted constitutes your acceptance of the updated Terms.' },
      ],
    },
    {
      heading: '13. Contact',
      blocks: [
        { type: 'p', text: 'One3Seven Ventures LLC · Stockton, California · legal@one3seven.com' },
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  org: 'one3seven · One3Seven Ventures LLC',
  effective: 'Effective July 8, 2026',
  intro: 'This Privacy Policy describes how One3Seven Ventures LLC collects, uses, and protects information when you use one3seven.',
  sections: [
    {
      heading: '1. What information we collect',
      blocks: [
        { type: 'subhead', text: 'Information you provide directly' },
        { type: 'bullets', items: [
          'Account information: your name, email address, and password when you create an account.',
          'Documents you upload: pay stubs, termination letters, HR communications, schedules, text message exports, and any other employment-related records you choose to upload.',
          'Story and intake details: the written account of your situation you provide, and the optional fields you fill in (employer name, employment dates, key people, work state, whether you filed complaints, etc.).',
        ] },
        { type: 'subhead', text: 'Information collected automatically' },
        { type: 'bullets', items: [
          'Basic usage data: pages visited, features used, and general interaction patterns — used to understand how the product is working and to improve it.',
          'Technical data: browser type, device type, and IP address — standard data collected by web applications for security and operational purposes.',
        ] },
        { type: 'p', text: 'We do not collect payment information directly — payment processing is handled by Stripe, which has its own privacy practices.' },
        { type: 'subhead', text: 'Cookies and similar technologies' },
        { type: 'p', text: 'We may use cookies and similar technologies to keep you signed in, remember preferences, maintain security, and understand how the platform is used. If we later add analytics or marketing technologies, we will update this section.' },
      ],
    },
    {
      heading: '2. How we use your information',
      blocks: [
        { type: 'p', text: 'We use your information only for the following purposes:' },
        { type: 'bullets', items: [
          'To organize your uploaded documents into a structured intake summary — the core function of the platform.',
          'To maintain your account and allow you to access your organized intake.',
          'To deliver your organized intake to a law firm you choose to send it to.',
          'To communicate with you about your account or the platform.',
          'To improve the platform based on how it is being used.',
        ] },
        { type: 'p', text: 'We do not sell your personal information, and we do not share it for cross-context behavioral advertising, as those terms are defined under the California Consumer Privacy Act (CCPA/CPRA). We do not use your documents for advertising. We do not share your documents with third parties except as described in this policy. Because we do not sell or share your information in this way, there is nothing to opt out of, but you may still exercise the privacy choices described in Section 6.' },
      ],
    },
    {
      heading: '3. How we use artificial intelligence',
      blocks: [
        { type: 'p', text: 'one3seven uses the Anthropic Claude API to process your uploaded documents and extract information for organizational purposes. This processing happens under Anthropic’s commercial API terms, which do not permit Anthropic to use your documents to train its AI models by default.' },
        { type: 'p', text: 'Your documents are processed to produce an organized summary. They are not used to train any AI models. They are not shared with other users or with Anthropic beyond what is necessary to process your request.' },
        { type: 'p', text: 'AI-generated organization may occasionally be incomplete or inaccurate. You should review organized summaries alongside the original documents and not rely on the summary alone.' },
      ],
    },
    {
      heading: '4. Who can see your documents',
      blocks: [
        { type: 'p', text: 'Your documents and intake records are private to your account by default. Access is controlled as follows:' },
        { type: 'bullets', items: [
          'Only you can see your full documents and intake records until you choose to share them.',
          'A law firm can see your organized intake only after you choose to send it to that firm. No firm receives your intake, documents, or notes unless you send it to them.',
          'Law firms receive access to your intake only after you send it to that specific firm.',
          'one3seven staff may access records when necessary to provide support, investigate technical issues, or comply with legal obligations. This access is limited and logged.',
        ] },
        { type: 'p', text: 'No other worker’s account can see your records. The platform uses row-level security controls at the database level to enforce this isolation.' },
      ],
    },
    {
      heading: '5. Data storage and security',
      blocks: [
        { type: 'p', text: 'Your data is stored using Supabase, a cloud database platform with encryption in transit and at rest. one3seven implements row-level security policies to enforce account isolation — meaning database queries are structured so that your records cannot be accessed by queries made under another user’s account.' },
        { type: 'p', text: 'No security system is perfect. While we use commercially reasonable administrative, technical, and organizational safeguards to protect your data, no method of electronic storage or transmission is completely secure, and we cannot guarantee that unauthorized access, disclosure, or loss will never occur.' },
        { type: 'p', text: 'Given the sensitive nature of employment documents, we recommend that you redact personal information such as Social Security numbers, banking details, and medical record numbers before uploading if that information is not relevant to your employment matter.' },
      ],
    },
    {
      heading: '6. Your rights and choices',
      blocks: [
        { type: 'subhead', text: 'Delete individual intakes' },
        { type: 'p', text: 'You can delete any individual intake and its associated records from your account at any time through the platform. Deletion removes the records from one3seven’s active systems. Automated database backups may retain deleted data for up to 90 days as part of standard infrastructure operations, after which those backups are cycled and the data is purged.' },
        { type: 'subhead', text: 'Delete your account' },
        { type: 'p', text: 'Self-service account deletion is not available during the current beta period. To request that your account and all associated data be deleted, contact us at legal@one3seven.com. We will delete your account and all associated data within 45 days of a verified request, as required by California law.' },
        { type: 'subhead', text: 'Access and correction' },
        { type: 'p', text: 'You can view and update your account information through your account settings. If you believe information in your organized intake is inaccurate, you can add notes, upload additional documents, or delete and re-upload corrected records.' },
        { type: 'subhead', text: 'California privacy rights' },
        { type: 'p', text: 'If you are a California resident, you have rights under the California Consumer Privacy Act, as amended by the California Privacy Rights Act (CCPA/CPRA). These include the right to know the categories and specific pieces of personal information we collect, the sources of that information, the purposes for collecting it, and the categories of any recipients; the right to delete your personal information; the right to correct inaccurate information; the right to opt out of the sale or sharing of your personal information; the right to limit the use of sensitive personal information; and the right not to be discriminated against for exercising these rights. As described in Section 2, we do not sell or share your personal information, and we use your documents only to organize your intake — not for advertising or any secondary purpose that would require an opt-out. To exercise any of these rights, contact us at legal@one3seven.com. We will respond within 45 days of a verified request. You may also designate an authorized agent to make a request on your behalf.' },
      ],
    },
    {
      heading: '7. Data retention',
      blocks: [
        { type: 'p', text: 'We retain your account information and intake records for as long as your account is active. If you delete individual intakes, those records are removed from active systems promptly. When you request account deletion, we will delete your account and associated records within 45 days of a verified request, as required by California law.' },
        { type: 'p', text: 'We may retain certain information for longer periods where required by law, for legitimate business purposes such as fraud prevention, or to resolve disputes.' },
      ],
    },
    {
      heading: '8. Third-party services',
      blocks: [
        { type: 'p', text: 'one3seven uses the following third-party services in operating the platform:' },
        { type: 'bullets', items: [
          'Supabase: database, authentication, and file storage.',
          'Anthropic (Claude API): document processing and extraction.',
          'Stripe: payment processing for firm subscriptions.',
          'Vercel: website hosting and deployment.',
        ] },
        { type: 'p', text: 'Each of these services has its own privacy practices. We engage these providers to perform functions on our behalf, and expect them to process information only as necessary to provide those services under applicable contractual terms.' },
      ],
    },
    {
      heading: '9. Children’s privacy',
      blocks: [
        { type: 'p', text: 'one3seven is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children. If you believe a child has created an account, please contact us at legal@one3seven.com and we will delete the account.' },
      ],
    },
    {
      heading: '10. Changes to this policy',
      blocks: [
        { type: 'p', text: 'We may update this Privacy Policy from time to time. When we do, we will update the effective date at the top of this document. If we make material changes to how we handle your personal information, we will notify you by email if we have your email address.' },
      ],
    },
    {
      heading: '11. Contact',
      blocks: [
        { type: 'p', text: 'For questions about this Privacy Policy or to exercise your privacy rights:' },
        { type: 'p', text: 'One3Seven Ventures LLC · Stockton, California · legal@one3seven.com' },
      ],
    },
  ],
};
