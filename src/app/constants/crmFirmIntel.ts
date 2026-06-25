// Static per-firm call intelligence — keyed by exact crm_firms.name.
// Merged into the CRM firm card at render (call strip + Full brief) and the Demo Prep card.
// No DB migration needed. To update: edit this file. Founder/rep internal only.

export interface FirmIntel {
  fireCaseSignal: boolean;
  headlineWin: string;
  opener: string;
  topWins: string[];
  awardsRecognition: string;
  intakeNotes: string;
}

export const crmFirmIntel: Record<string, FirmIntel> = {

  "Moon Law Group, PC": {
    fireCaseSignal: true,
    headlineWin: "$5M wage class settlement vs healthcare (2025) · $3.25M vs logistics company (2024)",
    opener: "I saw you handled multiple warehouse and logistics wage class actions — that's exactly who we're built for. one3seven organizes worker records into a structured intake packet before it reaches your firm. We're opening this to a small number of CA employment firms — worth 15 minutes?",
    topWins: [
      "$5M wage & hour class settlement vs healthcare company (2025)",
      "$5M wage & hour class settlement vs hospital (2021)",
      "$4.4M wage class settlement vs restaurant chain (2024)",
      "$3.25M wage class settlement vs logistics company (2024)",
      "$3M wage class settlement vs logistics company (2023)",
      "$3.55M judgment after jury trial — disability discrimination vs security company (2018)",
      "$920K PAGA settlement vs construction company (2021)",
    ],
    awardsRecognition: "Super Lawyers · 40+ attorneys · one of the largest plaintiff employment firms in California · Kane Moon: hundreds of millions recovered · since 2007",
    intakeNotes: "High-volume wage & hour class action shop. Multiple logistics and warehouse employer defendants on their win sheet — direct match for Tracy/Medline fire workers. Intake surge is a real bottleneck at this scale.",
  },

  "Azadian Law Group, PC": {
    fireCaseSignal: false,
    headlineWin: "$9.96M arbitration award (Dr. Vamvakas) · $100M+ total collected",
    opener: "Your firm is known for high-stakes individual cases alongside class actions. one3seven organizes worker records before attorney review — the structured intake frees your team to evaluate on merit, not sort documents. Would 15 minutes make sense?",
    topWins: [
      "$9,957,411 Final Arbitration Award — Dr. Vamvakas vs CPLM (landmark win against two top defense firms)",
      "$3.5M settlement — financial services executive with favorable non-monetary terms",
      "$3M wage & hour class action settlement",
      "$2.8M resolution — workers misclassified as independent contractors",
      "$2.435M settlement — entertainment executive",
      "$669K verdict vs Macy's — age retaliation and wrongful termination",
      "$30M+ recovered in last 3 years alone",
    ],
    awardsRecognition: "America's Top 100 Attorneys · Daily Journal Top 20 Boutique Firms in CA (only LA employment firm selected) · AV Preeminent · Avvo 10.0 Superb · Million Dollar & Multi-Million Dollar Advocates Forums · Super Lawyers · UCLA Law (top 1% of class)",
    intakeNotes: "Boutique with a mix of high-value individual cases and class actions. George Azadian previously at O'Melveny & Stroock — uses insider defense knowledge on offense. Values quality intake that matches that standard.",
  },

  "Lavi & Ebrahimian, LLP": {
    fireCaseSignal: false,
    headlineWin: "$6.5M class action vs hospital workers · hundreds of millions since 2003",
    opener: "I noticed other attorneys refer cases to you after seeing you win in court. one3seven is built to make sure intake quality matches that trial-ready standard. Want to see what structured intake looks like?",
    topWins: [
      "$6.5M class action settlement — hospital workers",
      "$6.1M class action settlement — utility tree service workers",
      "$3.5M individual settlement — disability discrimination",
      "Hundreds of millions recovered since founding in 2003",
      "Multiple bench and jury trial wins driving significant attorney referral business",
    ],
    awardsRecognition: "Super Lawyers 2006–2016 (Nick Ebrahimian — top 3% of specialty) · 20+ years exclusively representing employees · known as confident trial lawyers · much of business is referrals from other attorneys",
    intakeNotes: "Trial-first firm that other attorneys send cases to. If intake is messy, it reflects on the referral source. Organized intake is directly on-brand for how they present.",
  },

  "Custis Law, PC": {
    fireCaseSignal: false,
    headlineWin: "Boutique whistleblower & wage practice — results not broadly published",
    opener: "You focus on wage, wrongful termination, and whistleblower cases — all high-document-volume intakes. one3seven builds the worker's organized story before it reaches your desk. Worth 15 minutes?",
    topWins: [
      "Focused boutique — results not publicly advertised",
      "Whistleblower and wage & hour specialist",
    ],
    awardsRecognition: "Focused LA employment boutique with strong whistleblower practice",
    intakeNotes: "Smaller firm where each intake matters more — disorganized worker records cost proportionally more time per attorney. Organized intake has clear ROI here.",
  },

  "Kesluk Silverstein Jacob & Morrison": {
    fireCaseSignal: false,
    headlineWin: "Multiple 7-figure results · long-established LA employment firm",
    opener: "You handle the full range of employment claims. one3seven's intake packet gives you a worker's timeline and documents organized before the first consult. Would that be useful to see?",
    topWins: [
      "Multiple 7-figure results published on site",
      "Full employment case mix — wrongful term., discrimination, harassment, wage",
    ],
    awardsRecognition: "Long-established LA plaintiff employment firm · Super Lawyers recognition",
    intakeNotes: "Full-service plaintiff firm handling volume across case types. Intake organization reduces triage time across the board.",
  },

  "Genie Harrison Law Firm": {
    fireCaseSignal: false,
    headlineWin: "$100M Riot Games equal pay settlement · $245M+ total recovered",
    opener: "Your firm takes on the highest-profile cases in California. one3seven is designed for firms where intake quality is non-negotiable — organized worker records, timeline built, documents structured before your first review. We're inviting a small number of firms. Worth a look?",
    topWins: [
      "$100M Riot Games equal pay class settlement (lead counsel — stepped in when class reps rejected $10M proposal)",
      "$6.8M jury verdict — African-American lesbian firefighter discrimination/harassment (LAFD)",
      "$2.5M jury verdict — LAFD Captain retaliation",
      "$245M+ total in settlements and verdicts",
      "Harvey Weinstein survivors representation",
    ],
    awardsRecognition: "Best Lawyers 2022 Employment Lawyer of Year · Top 10 SoCal Super Lawyers 7 years running · CAALA President 2021 · CAOC Consumer Attorney of Year 2022 · CELA Joe Posner Award 2022 · Civil Lawyer Hall of Fame · Lawdragon Top 500 Employment Lawyers · Super Lawyers since 2009",
    intakeNotes: "Takes limited cases, fights at maximum intensity. Only accepts cases she believes she can win. Intake quality is a gate — organized, structured records help her make that call faster.",
  },

  "Feldman Browne, APC": {
    fireCaseSignal: false,
    headlineWin: "High-volume wage & hour class action boutique",
    opener: "Your whole practice is wage class actions. one3seven is built for the intake surge that comes with those — structured worker packets before attorney review. Want to see how it works?",
    topWins: [
      "Focused wage & hour class action practice",
      "Overtime, meal & rest break specialist",
    ],
    awardsRecognition: "Strong class action boutique in LA",
    intakeNotes: "Pure class action shop — volume is the business model. Intake surge is the constant constraint. Structured worker records before attorney review is the direct value proposition.",
  },

  "Employees First Labor Law (EFLL)": {
    fireCaseSignal: true,
    headlineWin: "Worker-first boutique — fire-displaced worker match",
    opener: "Your firm name signals exactly the clients arriving from the Tracy and Boyle Heights fires right now. one3seven organizes their records before they reach your desk — fire-displaced worker support built in. Worth 15 minutes?",
    topWins: [
      "Worker-first focused boutique",
      "Wage theft, retaliation, discrimination, workers comp specialist",
    ],
    awardsRecognition: "Named practice signals deep worker advocacy commitment",
    intakeNotes: "Fire-displaced worker pitch is the strongest possible opener here. Name, mission, and case focus all align perfectly.",
  },

  "Employment Lawyers Group (Karl Gerber)": {
    fireCaseSignal: false,
    headlineWin: "Karl Gerber — multiple 7-figure results, well-known LA plaintiff attorney",
    opener: "Karl Gerber's firm handles high-document-volume wrongful termination and whistleblower cases. one3seven structures those worker records before attorney review. Would 15 minutes be worth it?",
    topWins: [
      "Multiple 7-figure results — wrongful termination and whistleblower focus",
    ],
    awardsRecognition: "Consumer Attorneys Association of Los Angeles member · long-standing LA plaintiff practice",
    intakeNotes: "Whistleblower cases carry high document volume — whistleblowers typically arrive with records, notes, emails. Organized intake is especially valuable here.",
  },

  "Boren, Osher & Luftman, LLP": {
    fireCaseSignal: false,
    headlineWin: "Established LA plaintiff firm · 7-figure individual results",
    opener: "You handle the full employment case mix in LA. one3seven organizes a worker's story and documents into a structured packet before the first consult. Worth seeing?",
    topWins: [
      "Multiple 7-figure results — wrongful term., discrimination, wage",
    ],
    awardsRecognition: "Super Lawyers recognition · long-standing LA employment practice",
    intakeNotes: "Full-service LA firm. Intake efficiency matters across a mixed case load.",
  },

  "Lawyers for Justice, PC": {
    fireCaseSignal: true,
    headlineWin: "$100M+ recovered · 24/7 high-volume intake operation",
    opener: "You run a high-volume wage and PAGA practice. That means surge intake is the bottleneck — exactly what one3seven is built to solve. Fire-displaced worker support is built in. Would 15 minutes make sense?",
    topWins: [
      "$100M+ recovered for CA employees",
      "Landmark wage and PAGA class action settlements statewide",
      "Nationwide representation across all industries",
      "24/7 free consultations — high intake volume by design",
    ],
    awardsRecognition: "15+ years · nationwide reach · 24/7 free consultations · high-volume class action machine",
    intakeNotes: "Intake is the engine of this business model. They run 24/7 consultations — volume is intentional. one3seven organized packets reduce attorney triage time per case, compounding at their scale.",
  },

  "Rager & Yoon LLP": {
    fireCaseSignal: false,
    headlineWin: "Focused individual plaintiff firm · 7-figure results",
    opener: "Your firm focuses on individual wrongful termination and harassment cases. one3seven organizes the worker's story and documents into a structured intake packet before your review. Want to see it?",
    topWins: [
      "Multiple 7-figure results — wrongful term., discrimination, sexual harassment",
    ],
    awardsRecognition: "Established LA plaintiff employment firm",
    intakeNotes: "Individual case focus means each intake is high-stakes. Organized records help the attorney assess strength faster.",
  },

  "King & Siegel LLP": {
    fireCaseSignal: false,
    headlineWin: "$120M+ recovered since 2018 · founded by Harvard, Columbia, NYU attorneys",
    opener: "Your firm is built on elite litigation skills applied to worker cases. one3seven delivers that same standard at intake — organized worker records before attorney review. We're selective about who we bring on. Worth 15 minutes?",
    topWins: [
      "$2.75M disability discrimination settlement — wrongful termination of long-term employee",
      "$1.5M pregnancy discrimination related wrongful termination settlement",
      "$1.25M class action — maintenance workers (800+ class members)",
      "Seven-figure confidential settlement — pregnancy discrimination",
      "$120M+ recovered since founding in 2018",
    ],
    awardsRecognition: "Founded 2018 · Harvard, Columbia, NYU, Stanford trained attorneys · formerly at Quinn Emanuel, Skadden, elite defense firms · Best Lawyers recognition · free 30-min consultations in English and Spanish",
    intakeNotes: "Deliberately elite — they use the same aggressive tactics big defense firms use, applied to plaintiff work. They will appreciate the 'we're selective about who we bring on' framing. Matching their standard is the pitch.",
  },

  "Dolan Law Firm": {
    fireCaseSignal: false,
    headlineWin: "$61M racial discrimination verdict vs FedEx — largest in US history",
    opener: "Chris Dolan's firm has the largest racial discrimination verdict in US history. The cases you take are the ones that matter most. one3seven makes sure intake quality matches that standard — structured before it hits your desk. Worth 15 minutes?",
    topWins: [
      "$61M racial discrimination verdict — Lebanese-American FedEx drivers (US record; case rejected by 10 firms, NAACP, and ACLU before Dolan took it)",
      "$20M whistleblower verdict — Wyndham timeshare wrongful termination (largest individual CA employment verdict in 2016)",
      "$90M+ recovered specifically in employment cases",
      "$250M+ total across all practice areas since 1995",
      "50+ cases tried; hundreds of favorable settlements",
    ],
    awardsRecognition: "California Lawyer of the Year (California Lawyer magazine) · CAOC President (2010) · SF Trial Lawyers Association President (2016) · Super Lawyers · Best Lawyers · Top 25 Plaintiffs Lawyers in CA (Daily Journal)",
    intakeNotes: "Chris Dolan takes cases others reject and wins at trial. He writes a weekly column and appears on CNN, Fox News, Dateline. Prestige matters to this firm — intake quality is part of their brand.",
  },

  "Lawless Lawless & McGrath": {
    fireCaseSignal: false,
    headlineWin: "Long-running SF civil rights & employment practice",
    opener: "Your firm handles civil rights and employment cases in the Bay Area. one3seven organizes worker records into a structured intake packet before attorney review. Worth 15 minutes?",
    topWins: [
      "Long-running SF civil rights and employment practice",
    ],
    awardsRecognition: "San Francisco civil rights plaintiff bar",
    intakeNotes: "Civil rights cases often involve significant document gathering from workers. Organized intake reduces early-stage burden.",
  },

  "Sanford Heisler Sharp McKnight LLP": {
    fireCaseSignal: false,
    headlineWin: "National firm · landmark wage class and whistleblower cases",
    opener: "Sanford Heisler handles some of the largest wage and whistleblower cases in the country. Intake organization at the front end frees your attorneys to focus on what they're exceptional at. Want to see one3seven in action?",
    topWins: [
      "Major national whistleblower and wage class actions",
      "Significant False Claims Act recoveries",
      "One of the top plaintiff employment firms nationally",
    ],
    awardsRecognition: "Chambers USA recognition · national firm with SF office · major False Claims Act practice · wage class action leader",
    intakeNotes: "National-scale firm. SF office handles complex wage and whistleblower cases. Intake efficiency at scale is the pitch — what works for one case works for 50.",
  },

  "Liberation Law Group, PC": {
    fireCaseSignal: true,
    headlineWin: "Worker & immigrant rights focus — fire-displaced worker match",
    opener: "Your firm's name signals exactly the workers arriving from the Tracy and Boyle Heights fires — many need an organized intake. one3seven is built for that. Worth 15 minutes?",
    topWins: [
      "Worker and immigrant rights focused practice",
      "Multi-million results published on site",
    ],
    awardsRecognition: "Known for worker-first advocacy in the Bay Area employment community",
    intakeNotes: "Liberation Law Group specifically serves immigrant and low-wage workers — the exact population arriving from the Tracy and Boyle Heights fires. Fire-displaced worker intake support built into one3seven is the strongest possible angle.",
  },

  "Blumenthal Nordrehaug Bhowmik De Blouw": {
    fireCaseSignal: true,
    headlineWin: "$1.3B+ recovered · 433 PAGA claims — highest volume in California",
    opener: "Your firm runs the highest volume of PAGA and class actions in California. Fire-displaced warehouse workers are arriving now with scattered records — one3seven structures intake before it hits your team. Would 15 minutes make sense?",
    topWins: [
      "$19.9M settlement vs RTX Corp / aerospace subsidiaries — wage & hour class",
      "433 PAGA claims filed — #7 in CA by volume",
      "$3M+ multiple PAGA and class action settlements",
      "$1.3B+ total recovered for employees",
      "Active filings against Amazon, FedEx, Walmart-scale employers",
    ],
    awardsRecognition: "Offices in SF, Sacramento, SD, LA, Riverside, Chicago · highest PAGA filing volume in California · 30+ years of class action practice · Norman Blumenthal: top plaintiff employment litigation attorney",
    intakeNotes: "Volume machine. This firm is built on class actions and PAGA — intake is processed at industrial scale. Even a 5% reduction in per-intake triage time across their volume is material.",
  },

  "Ferraro Vega Employment Lawyers": {
    fireCaseSignal: false,
    headlineWin: "Active San Diego wage class & wrongful term. practice",
    opener: "Your firm handles class actions and wage cases in San Diego. one3seven is designed for the intake surge those cases bring — organized worker records before attorney review. Worth 15 minutes?",
    topWins: [
      "Active San Diego class action and wage practice",
    ],
    awardsRecognition: "Growing SD plaintiff employment firm",
    intakeNotes: "Growing firm — intake efficiency now compounds as they scale.",
  },

  "Haeggquist & Eck LLP": {
    fireCaseSignal: false,
    headlineWin: "99% success rate · Top 50 CA Employment Verdicts 2017",
    opener: "Your 99% success rate is extraordinary. That starts at intake — making sure the right cases get in front of your attorneys clearly. one3seven structures worker records before the first review. Want to see it?",
    topWins: [
      "Top 50 CA Employment Verdicts 2017 — disability discrimination vs Kaiser Permanente",
      "$25M Trump University class action settlement (California's Top 50 Class Action Settlements 2016)",
      "Confidential settlement — gender discrimination vs The Salk Institute",
      "$1.2M+ — sexual harassment vs Jollibee (after fee motion)",
      "Cases against Trader Joe's, Sharp Healthcare, Wyndham, Grand Del Mar",
    ],
    awardsRecognition: "Women-owned firm · 99% success rate · Best Lawyers 2026 · Super Lawyers · AV Preeminent · Top 50 Employment Verdicts CA · Alreen Haeggquist: graduated 3rd in class California Western Law School",
    intakeNotes: "Takes ~15 cases per attorney at a time vs industry norm of 100. Selective intake is the business model — organized, clear records help them make the call on whether to take a case faster.",
  },

  "Landay Roberts LLP": {
    fireCaseSignal: false,
    headlineWin: "Established San Diego plaintiff employment practice",
    opener: "You handle employment cases across the San Diego market. one3seven organizes a worker's story and documents before it reaches your desk. Worth 15 minutes to see it?",
    topWins: [
      "Established SD plaintiff employment firm — wrongful term., wage, discrimination",
    ],
    awardsRecognition: "San Diego employment plaintiff bar",
    intakeNotes: "Solid SD firm. Intake efficiency pitch applies across their case mix.",
  },

  "The Gillam Law Firm": {
    fireCaseSignal: false,
    headlineWin: "Active San Diego individual plaintiff practice",
    opener: "Your firm focuses on individual discrimination and wrongful termination cases. one3seven organizes the worker's intake documents and timeline before attorney review. Worth 15 minutes?",
    topWins: [
      "Active SD plaintiff firm — wrongful term., discrimination, harassment",
    ],
    awardsRecognition: "San Diego employment plaintiff bar",
    intakeNotes: "Individual case focus — organized intake helps attorney assess case quality faster at intake.",
  },

  "Webber & Egbert Employment Law, PC": {
    fireCaseSignal: false,
    headlineWin: "FEHA specialist · Sacramento employment practice",
    opener: "FEHA cases require strong documentation from day one. one3seven builds that organized record before the attorney review. Worth 15 minutes to see how it works?",
    topWins: [
      "FEHA, wage & hour, wrongful term., whistleblower — Sacramento specialist",
    ],
    awardsRecognition: "Sacramento employment plaintiff bar · FEHA specialist",
    intakeNotes: "FEHA cases are documentation-intensive from first intake. Organized worker records at intake reduce back-and-forth before attorney can assess.",
  },

  "Blumenthal Nordrehaug (Sacramento)": {
    fireCaseSignal: true,
    headlineWin: "Same firm as SF — Central Valley warehouse fire workers in their backyard",
    opener: "Your Sacramento office is well-positioned for the fire-displaced warehouse workers from Tracy and the Central Valley right now. one3seven structures their intake before it reaches your team. Worth 15 minutes?",
    topWins: [
      "Same firm as SF/SD/LA offices — $1.3B+ total recovered",
      "$19.9M RTX Corp settlement · 433 PAGA claims filed statewide",
      "Central Valley and Sacramento wage class action specialist",
    ],
    awardsRecognition: "Same as SF office — see Blumenthal Nordrehaug Bhowmik De Blouw above",
    intakeNotes: "The Sacramento office is the geographic closest to the Tracy/Medline fire (Tracy is in San Joaquin County). This is a priority fire-case call.",
  },

  "Ackermann & Tilajef, PC": {
    fireCaseSignal: true,
    headlineWin: "Sacramento wage class & PAGA practice — Tracy fire backyard",
    opener: "You handle wage class actions and PAGA in Sacramento — the Tracy fire workers are right in your backyard. one3seven organizes their records before they reach your desk. Worth 15 minutes?",
    topWins: [
      "Active Sacramento wage and class action practice",
      "PAGA and wrongful termination specialist",
    ],
    awardsRecognition: "Sacramento plaintiff employment bar",
    intakeNotes: "Sacramento firm closest to the Tracy/Medline warehouse fire. ~1,000 displaced workers. Class action potential is real. This is a priority call.",
  },

  "Donahoo & Associates, PC": {
    fireCaseSignal: false,
    headlineWin: "Established Orange County plaintiff employment practice",
    opener: "You handle the full employment case mix in Orange County. one3seven organizes worker records before attorney review. Worth 15 minutes to see it?",
    topWins: [
      "Established OC plaintiff firm — wrongful term., discrimination, wage",
    ],
    awardsRecognition: "Orange County employment plaintiff bar",
    intakeNotes: "Full-service OC employment firm. Intake efficiency across a mixed case load.",
  },

  "Law Offices of Cathe Caraway-Howard": {
    fireCaseSignal: false,
    headlineWin: "Long-running OC employment discrimination boutique",
    opener: "Your firm focuses on discrimination and harassment cases in Orange County. one3seven builds the worker's story and organized documents before the first consult. Worth a look?",
    topWins: [
      "OC boutique employment discrimination and harassment practice",
    ],
    awardsRecognition: "Long-running Orange County employment practice",
    intakeNotes: "Smaller boutique — each intake matters more. Organized intake reduces time per case.",
  },

  "Advocacy Center for Employment Law": {
    fireCaseSignal: false,
    headlineWin: "Worker advocacy focus — warm lead in your pipeline ★",
    opener: "Your firm focuses on workers who need real advocacy — exactly the workers arriving on one3seven. We organize their story and records before it reaches your team. This is a warm lead in your pipeline — ready to connect?",
    topWins: [
      "Worker advocacy focused practice",
      "Warm-lead candidate noted in your CRM",
    ],
    awardsRecognition: "Worker advocacy model · warm lead",
    intakeNotes: "Warm lead — already in the pipeline. Move to top of call priority. The advocacy model means workers arriving with organized records is mission-aligned.",
  },

  "Costello Law Group": {
    fireCaseSignal: false,
    headlineWin: "Active San Jose employment practice",
    opener: "You handle employment cases across the San Jose market. one3seven organizes worker records before attorney review — structured intake before the first consult. Worth 15 minutes?",
    topWins: [
      "Active San Jose employment plaintiff firm — discrimination, wrongful term., wage",
    ],
    awardsRecognition: "San Jose employment plaintiff bar",
    intakeNotes: "San Jose firm serving the Bay Area tech worker population — discrimination and wrongful term. in tech is high-document-volume.",
  },

  "California Labor & Employment Law": {
    fireCaseSignal: false,
    headlineWin: "Warm lead in your pipeline — LA wage & wrongful term. practice ★",
    opener: "You're already a warm lead in our pipeline — one3seven organizes worker records for exactly the wage and wrongful termination cases you handle. Ready to connect on what that looks like?",
    topWins: [
      "Warm-lead candidate noted in your CRM",
      "LA wage & hour, wrongful term., retaliation, meal break practice",
    ],
    awardsRecognition: "Warm lead — in your pipeline",
    intakeNotes: "Warm lead — already in the pipeline. Move to top of call priority. Meal break and wage cases involve high per-worker document volume — direct one3seven fit.",
  },

};
