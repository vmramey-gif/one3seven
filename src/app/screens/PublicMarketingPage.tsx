import { useState, useEffect, useRef } from 'react';
import { WordMark } from '../components/WordMark';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2, Shield, Clock, FileText, Users, Zap, ChevronRight } from 'lucide-react';

interface PublicMarketingPageProps {
  onWorkerStart: () => void;
  onFirmStart: () => void;
  onSignIn: () => void;
  firmDirectedContext?: { firmId: string; firmName: string; firmCode: string } | null;
}


const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Worker uploads their documents',
    body: 'Pay stubs, emails, HR complaints, text messages, doctor notes — anything relevant. No legal knowledge needed.',
    color: 'bg-white border-[#e5def8]',
    accent: 'text-[#6d4aff]',
    tag: 'Worker',
  },
  {
    step: '02',
    title: 'AI organizes and structures the record',
    body: 'The engine extracts a timeline, identifies key dates, categorizes documents, surfaces timing relationships between reported concerns and later workplace actions, and flags dates that may require timely attorney review.',
    color: 'bg-[#f2efff] border-[#d5c9f3]',
    accent: 'text-[#5b39e6]',
    tag: 'one3seven',
  },
  {
    step: '03',
    title: 'Attorney receives a structured intake',
    body: 'A clean, organized packet arrives in the firm dashboard before the first consultation — no sorting, no follow-up calls.',
    color: 'bg-white border-[#e5def8]',
    accent: 'text-[#4A30CC]',
    tag: 'Firm',
  },
];

const FIRM_FEATURES = [
  { icon: Clock, label: 'Event timing cards', desc: 'Displays elapsed time between worker-reported concerns and later workplace actions.', tip: 'Dates and events are pulled from uploaded records and worker-provided context.' },
  { icon: Shield, label: 'Time-sensitive date flag', desc: 'Surfaces dates that may affect agency or court filing periods for attorney review.' },
  { icon: FileText, label: 'Document checklist', desc: 'Requested vs. received — at a glance, no manual cross-referencing.' },
  { icon: Zap, label: 'Source-linked information extraction', desc: 'Key language, dates, and employer responses linked to the uploaded source records.', tip: 'Records are structured for attorney review. one3Seven does not make legal conclusions.' },
  { icon: CheckCircle2, label: 'Intake link sharing', desc: 'One URL you share — workers go through guided intake and land in your dashboard.' },
];

const TRUST_ITEMS = [
  'No legal conclusions — attorney decides',
  'Worker controls when intake is shared',
  'All source documents preserved for direct review',
  'Firm accounts are reviewed before receiving routed intakes',
];

// ── Concept animation SVG markup ─────────────────────────────────────────────
const O3S_CONCEPT_SVG = `<svg id="sv" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
<defs>
<radialGradient id="bgR" cx="50%" cy="46%" r="68%"><stop offset="0%" stop-color="#2D1F6E"/><stop offset="100%" stop-color="#0E0B26"/></radialGradient>
<radialGradient id="glowR" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#6D4AFF" stop-opacity=".55"/><stop offset="100%" stop-color="#6D4AFF" stop-opacity="0"/></radialGradient>
<linearGradient id="phG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E1060"/><stop offset="100%" stop-color="#111827"/></linearGradient>
<linearGradient id="btnG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7C3AED"/><stop offset="100%" stop-color="#6D4AFF"/></linearGradient>
<filter id="glow4"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="cardSh"><feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000" flood-opacity=".35"/></filter>
<filter id="firmSh"><feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#6D4AFF" flood-opacity=".28"/></filter>
<clipPath id="phClip"><rect x="498" y="88" width="284" height="544" rx="32"/></clipPath>
</defs>
<rect width="1280" height="720" fill="url(#bgR)"/>
<g opacity=".04" stroke="#A78BFA" stroke-width="1">
<line x1="0" y1="120" x2="1280" y2="120"/><line x1="0" y1="240" x2="1280" y2="240"/><line x1="0" y1="360" x2="1280" y2="360"/><line x1="0" y1="480" x2="1280" y2="480"/><line x1="0" y1="600" x2="1280" y2="600"/>
<line x1="160" y1="0" x2="160" y2="720"/><line x1="320" y1="0" x2="320" y2="720"/><line x1="480" y1="0" x2="480" y2="720"/><line x1="640" y1="0" x2="640" y2="720"/><line x1="800" y1="0" x2="800" y2="720"/><line x1="960" y1="0" x2="960" y2="720"/><line x1="1120" y1="0" x2="1120" y2="720"/>
</g>
<ellipse id="ambGlow" cx="640" cy="340" rx="0" ry="0" fill="url(#glowR)" opacity="0"/>
<g id="d0"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#EDE8FF"/><rect x="-65" y="-30" width="130" height="9" fill="#EDE8FF"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#6D4AFF" font-weight="800" font-family="system-ui">INTAKE FORM</text><rect x="-52" y="-10" width="84" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="4" width="68" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="18" width="76" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="32" width="56" height="5" rx="2.5" fill="#E5E7EB"/></g>
<g id="d1"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#DCFCE7"/><rect x="-65" y="-30" width="130" height="9" fill="#DCFCE7"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#166534" font-weight="800" font-family="system-ui">PAY STUB</text><text x="-52" y="-4" font-size="9.5" fill="#6B7280" font-family="system-ui">Gross</text><text x="52" y="-4" text-anchor="end" font-size="9.5" fill="#1E1B4B" font-weight="700" font-family="system-ui">$4,200</text><text x="-52" y="12" font-size="9.5" fill="#6B7280" font-family="system-ui">Net</text><text x="52" y="12" text-anchor="end" font-size="9.5" fill="#166534" font-weight="700" font-family="system-ui">$3,360</text><rect x="-52" y="22" width="104" height="1.5" fill="#E5E7EB"/><rect x="-52" y="30" width="78" height="5" rx="2.5" fill="#E5E7EB"/></g>
<g id="d2"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#FEE2E2"/><rect x="-65" y="-30" width="130" height="9" fill="#FEE2E2"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#991B1B" font-weight="800" font-family="system-ui">POLICE REPORT</text><rect x="-52" y="-10" width="84" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="4" width="64" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="18" width="72" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="32" width="48" height="5" rx="2.5" fill="#E5E7EB"/></g>
<g id="d3"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#FEF3C7"/><rect x="-65" y="-30" width="130" height="9" fill="#FEF3C7"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#92400E" font-weight="800" font-family="system-ui">EVIDENCE</text><rect x="-52" y="-10" width="48" height="40" rx="4" fill="#FDE68A" opacity=".6"/><rect x="4" y="-10" width="48" height="40" rx="4" fill="#FDE68A" opacity=".4"/><rect x="-52" y="36" width="96" height="5" rx="2.5" fill="#E5E7EB"/></g>
<g id="d4"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#E0F2FE"/><rect x="-65" y="-30" width="130" height="9" fill="#E0F2FE"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#0369A1" font-weight="800" font-family="system-ui">TEXT MESSAGES</text><rect x="4" y="-8" width="44" height="15" rx="7.5" fill="#E0F2FE"/><rect x="-52" y="12" width="48" height="15" rx="7.5" fill="#F0F0F0"/><rect x="4" y="32" width="40" height="15" rx="7.5" fill="#E0F2FE"/></g>
<g id="d5"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#F3E8FF"/><rect x="-65" y="-30" width="130" height="9" fill="#F3E8FF"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#7C3AED" font-weight="800" font-family="system-ui">CALENDAR</text><text x="-38" y="-4" font-size="8" fill="#9CA3AF" font-family="system-ui">OCT 14</text><rect x="-52" y="2" width="104" height="16" rx="4" fill="#EDE8FF"/><text x="0" y="14" text-anchor="middle" font-size="9" fill="#6D4AFF" font-weight="700" font-family="system-ui">Incident Date</text><rect x="-52" y="24" width="84" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="34" width="68" height="5" rx="2.5" fill="#E5E7EB"/></g>
<g id="d6"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#FFF1F2"/><rect x="-65" y="-30" width="130" height="9" fill="#FFF1F2"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#9F1239" font-weight="800" font-family="system-ui">MEDICAL REC.</text><rect x="-52" y="-10" width="84" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="4" width="72" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="18" width="60" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="32" width="80" height="5" rx="2.5" fill="#E5E7EB"/></g>
<g id="d7"><rect x="-65" y="-47" width="130" height="95" rx="10" fill="white" filter="url(#cardSh)"/><rect x="-65" y="-47" width="130" height="26" rx="10" fill="#ECFDF5"/><rect x="-65" y="-30" width="130" height="9" fill="#ECFDF5"/><text x="0" y="-28" text-anchor="middle" font-size="11" fill="#065F46" font-weight="800" font-family="system-ui">EMPLOYMENT</text><rect x="-52" y="-10" width="84" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="4" width="68" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="18" width="76" height="5" rx="2.5" fill="#E5E7EB"/><rect x="-52" y="32" width="52" height="5" rx="2.5" fill="#E5E7EB"/></g>
<g id="vParts" opacity="0">
<circle id="vp0" cx="640" cy="340" r="4" fill="#A78BFA"/><circle id="vp1" cx="640" cy="340" r="3.5" fill="#7C3AED"/>
<circle id="vp2" cx="640" cy="340" r="3" fill="#C4B5FD"/><circle id="vp3" cx="640" cy="340" r="4" fill="#6D4AFF"/>
<circle id="vp4" cx="640" cy="340" r="3.5" fill="#A78BFA"/><circle id="vp5" cx="640" cy="340" r="3" fill="#DDD6FE"/>
<circle id="vp6" cx="640" cy="340" r="4" fill="#7C3AED"/><circle id="vp7" cx="640" cy="340" r="3.5" fill="#C4B5FD"/>
<circle id="vp8" cx="640" cy="340" r="3" fill="#6D4AFF"/><circle id="vp9" cx="640" cy="340" r="4" fill="#A78BFA"/>
<circle id="vp10" cx="640" cy="340" r="3.5" fill="#DDD6FE"/><circle id="vp11" cx="640" cy="340" r="3" fill="#7C3AED"/>
<line id="vl0" x1="640" y1="340" x2="640" y2="340" stroke="#C4B5FD" stroke-width="2.5" stroke-linecap="round"/>
<line id="vl1" x1="640" y1="340" x2="640" y2="340" stroke="#A78BFA" stroke-width="2"/>
<line id="vl2" x1="640" y1="340" x2="640" y2="340" stroke="#DDD6FE" stroke-width="2.5"/>
<line id="vl3" x1="640" y1="340" x2="640" y2="340" stroke="#7C3AED" stroke-width="2"/>
<line id="vl4" x1="640" y1="340" x2="640" y2="340" stroke="#C4B5FD" stroke-width="2.5"/>
<line id="vl5" x1="640" y1="340" x2="640" y2="340" stroke="#A78BFA" stroke-width="2"/>
</g>
<g id="sparkleLayer" opacity="0"/>
<g id="doneRings" opacity="0">
<circle cx="240" cy="560" r="0" fill="none" stroke="#F5C842" stroke-width="2.5" id="ring1a" opacity=".7"/>
<circle cx="240" cy="560" r="0" fill="none" stroke="#F5C842" stroke-width="1.5" id="ring1b" opacity=".4"/>
<circle cx="640" cy="580" r="0" fill="none" stroke="#F5C842" stroke-width="2.5" id="ring2a" opacity=".7"/>
<circle cx="640" cy="580" r="0" fill="none" stroke="#F5C842" stroke-width="1.5" id="ring2b" opacity=".4"/>
<circle cx="1040" cy="560" r="0" fill="none" stroke="#F5C842" stroke-width="2.5" id="ring3a" opacity=".7"/>
<circle cx="1040" cy="560" r="0" fill="none" stroke="#F5C842" stroke-width="1.5" id="ring3b" opacity=".4"/>
</g>
<g id="phoneGroup" opacity="0">
<rect x="498" y="88" width="284" height="544" rx="32" fill="#0D0B1E" filter="url(#firmSh)"/>
<rect x="504" y="94" width="272" height="532" rx="28" fill="url(#phG)"/>
<g clip-path="url(#phClip)">
<rect x="498" y="88" width="284" height="80" fill="#6D4AFF"/>
<text x="640" y="136" text-anchor="middle" font-size="22" fill="white" font-weight="700" font-family="system-ui">one3seven</text>
<rect x="602" y="96" width="76" height="18" rx="9" fill="#0D0B1E" opacity=".6"/>
<text x="640" y="202" text-anchor="middle" font-size="18" fill="white" font-weight="700" font-family="system-ui">Your records, organized.</text>
<text x="640" y="224" text-anchor="middle" font-size="12" fill="#A78BFA" font-family="system-ui">8 documents · Ready to send</text>
<rect x="514" y="242" width="252" height="44" rx="10" fill="white" opacity=".07"/>
<rect x="524" y="252" width="20" height="20" rx="4" fill="#EDE8FF" opacity=".8"/>
<text x="554" y="267" font-size="12" fill="white" font-family="system-ui">Intake Form</text>
<circle cx="750" cy="262" r="8" fill="#22C55E"/><text x="750" y="267" text-anchor="middle" font-size="11" fill="white">&#10003;</text>
<rect x="514" y="292" width="252" height="44" rx="10" fill="white" opacity=".07"/>
<rect x="524" y="302" width="20" height="20" rx="4" fill="#DCFCE7" opacity=".8"/>
<text x="554" y="317" font-size="12" fill="white" font-family="system-ui">Pay Stub + Employment</text>
<circle cx="750" cy="312" r="8" fill="#22C55E"/><text x="750" y="317" text-anchor="middle" font-size="11" fill="white">&#10003;</text>
<rect x="514" y="342" width="252" height="44" rx="10" fill="white" opacity=".07"/>
<rect x="524" y="352" width="20" height="20" rx="4" fill="#FEE2E2" opacity=".8"/>
<text x="554" y="367" font-size="12" fill="white" font-family="system-ui">Police Report + Evidence</text>
<circle cx="750" cy="362" r="8" fill="#22C55E"/><text x="750" y="367" text-anchor="middle" font-size="11" fill="white">&#10003;</text>
<rect x="514" y="392" width="252" height="44" rx="10" fill="white" opacity=".07"/>
<rect x="524" y="402" width="20" height="20" rx="4" fill="#E0F2FE" opacity=".8"/>
<text x="554" y="417" font-size="12" fill="white" font-family="system-ui">Messages + Calendar</text>
<circle cx="750" cy="412" r="8" fill="#22C55E"/><text x="750" y="417" text-anchor="middle" font-size="11" fill="white">&#10003;</text>
<rect x="514" y="456" width="252" height="54" rx="27" fill="url(#btnG)"/>
<text x="640" y="489" text-anchor="middle" font-size="17" fill="white" font-weight="700" font-family="system-ui">Send to Firms</text>
<rect x="514" y="522" width="252" height="8" rx="4" fill="white" opacity=".12"/>
<rect id="progBar" x="514" y="522" width="0" height="8" rx="4" fill="#A78BFA"/>
</g>
<rect x="591" y="96" width="98" height="18" rx="9" fill="#0D0B1E"/>
<rect x="498" y="88" width="284" height="544" rx="32" fill="none" stroke="#4338CA" stroke-width="1.5" opacity=".4"/>
</g>
<path id="line1" d="M640,612 C580,640 400,640 240,590" stroke="#6D4AFF" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="600" stroke-dashoffset="600" opacity=".7"/>
<path id="line2" d="M640,612 C640,630 640,630 640,618" stroke="#6D4AFF" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="20" stroke-dashoffset="20" opacity=".7"/>
<path id="line3" d="M640,612 C700,640 900,640 1040,590" stroke="#6D4AFF" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="600" stroke-dashoffset="600" opacity=".7"/>
<g id="plane1" opacity="0"><polygon points="0,-10 20,0 0,10 4,0" fill="white" filter="url(#glow4)"/><polygon points="0,-10 20,0 0,10 4,0" fill="white"/></g>
<g id="plane2" opacity="0"><polygon points="0,-10 20,0 0,10 4,0" fill="white" filter="url(#glow4)"/><polygon points="0,-10 20,0 0,10 4,0" fill="white"/></g>
<g id="plane3" opacity="0"><polygon points="0,-10 20,0 0,10 4,0" fill="white" filter="url(#glow4)"/><polygon points="0,-10 20,0 0,10 4,0" fill="white"/></g>
<g id="firm1" opacity="0" transform="translate(240,560)">
<rect x="-105" y="-52" width="210" height="96" rx="16" fill="#1A1048" stroke="#6D4AFF" stroke-width="1.5" filter="url(#firmSh)"/>
<rect id="firm1glow" x="-105" y="-52" width="210" height="96" rx="16" fill="#F5C842" opacity="0"/>
<text x="0" y="-18" text-anchor="middle" font-size="12" fill="#C4B5FD" font-weight="700" font-family="system-ui">LEE &amp; HOWARD LLC</text>
<text x="0" y="0" text-anchor="middle" font-size="10.5" fill="#A78BFA" font-family="system-ui">Employment Law</text>
<rect x="-70" y="12" width="140" height="20" rx="10" fill="#6D4AFF" opacity=".28"/>
<circle id="ck1" cx="0" cy="22" r="0" fill="#22C55E"/>
<text id="ckT1" x="14" y="27" text-anchor="middle" font-size="11" fill="white" opacity="0">Case Received &#10003;</text>
</g>
<g id="firm2" opacity="0" transform="translate(640,580)">
<rect x="-105" y="-52" width="210" height="96" rx="16" fill="#1A1048" stroke="#6D4AFF" stroke-width="1.5" filter="url(#firmSh)"/>
<rect id="firm2glow" x="-105" y="-52" width="210" height="96" rx="16" fill="#F5C842" opacity="0"/>
<text x="0" y="-18" text-anchor="middle" font-size="12" fill="#C4B5FD" font-weight="700" font-family="system-ui">RIVERA PARTNERS</text>
<text x="0" y="0" text-anchor="middle" font-size="10.5" fill="#A78BFA" font-family="system-ui">Civil Rights · Labor</text>
<rect x="-70" y="12" width="140" height="20" rx="10" fill="#6D4AFF" opacity=".28"/>
<circle id="ck2" cx="0" cy="22" r="0" fill="#22C55E"/>
<text id="ckT2" x="14" y="27" text-anchor="middle" font-size="11" fill="white" opacity="0">Case Received &#10003;</text>
</g>
<g id="firm3" opacity="0" transform="translate(1040,560)">
<rect x="-105" y="-52" width="210" height="96" rx="16" fill="#1A1048" stroke="#6D4AFF" stroke-width="1.5" filter="url(#firmSh)"/>
<rect id="firm3glow" x="-105" y="-52" width="210" height="96" rx="16" fill="#F5C842" opacity="0"/>
<text x="0" y="-18" text-anchor="middle" font-size="12" fill="#C4B5FD" font-weight="700" font-family="system-ui">MURPHY &amp; ASSOC.</text>
<text x="0" y="0" text-anchor="middle" font-size="10.5" fill="#A78BFA" font-family="system-ui">Wrongful Termination</text>
<rect x="-70" y="12" width="140" height="20" rx="10" fill="#6D4AFF" opacity=".28"/>
<circle id="ck3" cx="0" cy="22" r="0" fill="#22C55E"/>
<text id="ckT3" x="14" y="27" text-anchor="middle" font-size="11" fill="white" opacity="0">Case Received &#10003;</text>
</g>
<g id="hl1" opacity="0"><rect x="204" y="22" width="672" height="42" rx="21" fill="#0D0A28" opacity=".82"/><rect x="204" y="22" width="672" height="42" rx="21" fill="none" stroke="#3D2E8A" stroke-width="1"/><text x="640" y="49" text-anchor="middle" font-size="17" fill="#DDD6FE" font-weight="600" font-family="system-ui">Everything you&#39;ve gathered — scattered, overwhelming.</text></g>
<g id="hl2" opacity="0"><rect x="420" y="22" width="440" height="42" rx="21" fill="#0D0A28" opacity=".82"/><rect x="420" y="22" width="440" height="42" rx="21" fill="none" stroke="#3D2E8A" stroke-width="1"/><text x="640" y="49" text-anchor="middle" font-size="17" fill="#DDD6FE" font-weight="600" font-family="system-ui">Bringing it all together.</text></g>
<g id="hl3" opacity="0"><rect x="328" y="22" width="624" height="42" rx="21" fill="#0D0A28" opacity=".82"/><rect x="328" y="22" width="624" height="42" rx="21" fill="none" stroke="#3D2E8A" stroke-width="1"/><text x="640" y="49" text-anchor="middle" font-size="17" fill="#DDD6FE" font-weight="600" font-family="system-ui">Organized. Sent to firms who can help.</text></g>
<g id="hl4" opacity="0"><rect x="322" y="14" width="636" height="66" rx="21" fill="#0D0A28" opacity=".88"/><rect x="322" y="14" width="636" height="66" rx="21" fill="none" stroke="#3D2E8A" stroke-width="1"/><text x="640" y="42" text-anchor="middle" font-size="18" fill="#F5C842" font-weight="700" font-family="system-ui">&#10022; Firms are reviewing your case &#10022;</text><text x="640" y="66" text-anchor="middle" font-size="13" fill="#A78BFA" font-family="system-ui">You&#39;ll hear back when one chooses to help.</text></g>
<g id="logoCard" opacity="0">
<rect x="490" y="288" width="300" height="144" rx="22" fill="#0D0B1E" stroke="#6D4AFF" stroke-width="1.5" filter="url(#firmSh)"/>
<rect id="logoBling" x="490" y="288" width="300" height="144" rx="22" fill="#F5C842" opacity="0"/>
<text x="640" y="352" text-anchor="middle" font-size="36" fill="white" font-weight="800" font-family="system-ui">one3seven</text>
<text x="640" y="378" text-anchor="middle" font-size="12.5" fill="#A78BFA" font-family="system-ui">Organize smarter. Get matched.</text>
<text x="640" y="398" text-anchor="middle" font-size="12.5" fill="#A78BFA" font-family="system-ui">Get justice.</text>
</g>
</svg>`;

// Docs → vortex → phone → firms → sparkle done state (no character)
function IntakeTransformVisual() {
  const rafRef = useRef<number | null>(null);
  const prefersReduced = useReducedMotion() ?? false;

  useEffect(() => {
    if (prefersReduced) return;

    const getEl = (id: string) => document.getElementById(id);
    const setOp = (id: string, v: number) => { const e = getEl(id); if (e) e.setAttribute('opacity', String(Math.max(0, Math.min(1, v)))); };
    const setAttr = (id: string, a: string, v: string | number) => { const e = getEl(id); if (e) e.setAttribute(a, String(v)); };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const cl = (t: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, t));
    const ease = (t: number) => t < .5 ? 2*t*t : -1+(4-2*t)*t;
    const eOut = (t: number) => 1-(1-t)**3;
    const eIn  = (t: number) => t*t*t;
    const pi = Math.PI;

    const bez3 = (t: number, p0: {x:number,y:number}, p1: {x:number,y:number}, p2: {x:number,y:number}) => {
      const mt = 1-t; return { x: mt*mt*p0.x+2*mt*t*p1.x+t*t*p2.x, y: mt*mt*p0.y+2*mt*t*p1.y+t*t*p2.y };
    };
    const bez3ang = (t: number, p0: {x:number,y:number}, p1: {x:number,y:number}, p2: {x:number,y:number}) => {
      const mt = 1-t, dx = 2*(mt*(p1.x-p0.x)+t*(p2.x-p1.x)), dy = 2*(mt*(p1.y-p0.y)+t*(p2.y-p1.y));
      return Math.atan2(dy, dx)*180/pi;
    };
    const starPath = (cx: number, cy: number, ro: number, ri: number, rot = 0) => {
      const pts: string[] = [];
      for (let i = 0; i < 8; i++) { const a=(i*pi/4)+rot*pi/180, r=i%2===0?ro:ri; pts.push(`${cx+Math.cos(a)*r},${cy+Math.sin(a)*r}`); }
      return `M${pts.join('L')}Z`;
    };

    type Doc = { bx:number; by:number; ph:number; startAngle:number; startRadius:number };
    const docs: Doc[] = [
      {bx:178,by:142,ph:0,startAngle:0,startRadius:0},{bx:1026,by:118,ph:1.2,startAngle:0,startRadius:0},
      {bx:112,by:368,ph:2.1,startAngle:0,startRadius:0},{bx:1118,by:394,ph:.7,startAngle:0,startRadius:0},
      {bx:192,by:568,ph:1.8,startAngle:0,startRadius:0},{bx:1052,by:548,ph:2.8,startAngle:0,startRadius:0},
      {bx:448,by:84,ph:3.2,startAngle:0,startRadius:0},{bx:818,by:82,ph:.4,startAngle:0,startRadius:0},
    ];
    const CX = 640, CY = 340;
    docs.forEach(d => { const dx=d.bx-CX,dy=d.by-CY; d.startAngle=Math.atan2(dy,dx); d.startRadius=Math.sqrt(dx*dx+dy*dy); });

    const planes = [
      {p0:{x:640,y:612},p1:{x:400,y:650},p2:{x:240,y:590}},
      {p0:{x:640,y:612},p1:{x:640,y:625},p2:{x:640,y:618}},
      {p0:{x:640,y:612},p1:{x:880,y:650},p2:{x:1040,y:590}},
    ];

    const sparkDefs: [number,number,number,number,number,string,number][] = [
      [198,512,10,4,0,'#F5C842',60],[262,516,7,3,120,'white',80],[290,545,12,5,60,'#A78BFA',50],
      [282,585,8,3.5,180,'#F5C842',90],[245,602,10,4,240,'#34D399',70],[195,582,6,2.5,80,'white',100],
      [168,548,9,4,140,'#F5C842',55],[228,524,7,3,200,'#C4B5FD',85],
      [596,530,11,4.5,100,'#F5C842',65],[666,528,8,3.5,0,'white',75],[700,558,13,5.5,180,'#A78BFA',55],
      [694,600,9,3.5,260,'#F5C842',95],[648,614,11,4.5,80,'#34D399',60],[596,600,7,3,160,'white',85],
      [568,565,10,4,220,'#F5C842',70],[630,546,8,3.5,40,'#C4B5FD',90],
      [994,512,10,4,50,'#F5C842',65],[1066,516,7,3,170,'white',80],[1090,545,12,5,110,'#A78BFA',50],
      [1084,585,8,3.5,230,'#F5C842',95],[1043,602,10,4,290,'#34D399',72],[992,582,6,2.5,130,'white',88],
      [965,548,9,4,190,'#F5C842',58],[1028,524,7,3,250,'#C4B5FD',82],
      [380,200,14,6,0,'#F5C842',45],[160,280,9,4,150,'white',60],[900,200,13,5,80,'#A78BFA',52],
      [1110,260,10,4,200,'#F5C842',68],[640,130,16,7,40,'white',40],[440,440,8,3.5,220,'#C4B5FD',75],
      [840,440,10,4,100,'#F5C842',62],[200,160,7,3,280,'#34D399',80],[1080,160,9,4,160,'white',55],
      [560,680,6,2.5,320,'#F5C842',90],[720,680,7,3,60,'#A78BFA',78],[340,650,8,3.5,140,'white',65],
    ];

    const ns = 'http://www.w3.org/2000/svg';
    const sl = getEl('sparkleLayer');
    const sparkEls: Element[] = [];
    if (sl) {
      sparkDefs.forEach(s => {
        const el = document.createElementNS(ns, 'path');
        el.setAttribute('d', starPath(0, 0, s[2], s[3])); el.setAttribute('fill', s[5]); el.setAttribute('opacity', '0');
        sl.appendChild(el); sparkEls.push(el);
      });
    }
    const shootStars: Element[] = [];
    const shootData = [
      {x1:100,y1:200,dx:120,dy:60},{x1:900,y1:150,dx:-110,dy:55},
      {x1:300,y1:480,dx:100,dy:-40},{x1:980,y1:470,dx:-90,dy:-35},
      {x1:550,y1:80,dx:80,dy:80},{x1:730,y1:80,dx:-80,dy:80},
    ];
    if (sl) {
      for (let i = 0; i < 6; i++) {
        const el = document.createElementNS(ns, 'line');
        el.setAttribute('stroke','white'); el.setAttribute('stroke-width','2'); el.setAttribute('stroke-linecap','round'); el.setAttribute('opacity','0');
        sl.appendChild(el); shootStars.push(el);
      }
    }

    const TOTAL = 24000;
    const PH = {s1:0,s2:4000,s3:7200,s4:10000,s5:14000,s6:17200,end:24000};
    let t0: number | null = null;

    function tick(ts: number) {
      if (!t0) t0 = ts;
      const T = (ts - t0) % TOTAL;
      const Ts = T / 1000;
      const inDone = T >= PH.s6 + 1200;

      // DOCS
      docs.forEach((d, i) => {
        const el = getEl(`d${i}`); if (!el) return;
        let x = CX, y = CY, rot = 0, op = 1, sc = 1;
        if (T < PH.s2) {
          x = d.bx+Math.sin(Ts*.7+d.ph)*20; y = d.by+Math.cos(Ts*.55+d.ph*1.3)*15;
          rot = Math.sin(Ts*.4+d.ph*.8)*8; op = T < 600 ? eOut(T/600) : 1;
        } else if (T < PH.s3) {
          const st = cl((T-PH.s2)/(PH.s3-PH.s2));
          const delay = i*0.08; const localT = cl((st-delay)/(1-delay));
          if (localT <= 0) { x=d.bx+Math.sin(Ts*.7+d.ph)*20; y=d.by+Math.cos(Ts*.55+d.ph*1.3)*15; rot=Math.sin(Ts*.4+d.ph*.8)*8; }
          else { const lt=eIn(localT), angle=d.startAngle+lt*pi*3.5, radius=d.startRadius*(1-lt)**1.4; x=CX+Math.cos(angle)*radius; y=CY+Math.sin(angle)*radius; rot=lt*720; sc=lerp(1,.08,lt**1.8); op=localT>.88?1-eOut(cl((localT-.88)/.12)):1; }
        } else { op = 0; sc = 0; }
        el.setAttribute('transform', `translate(${x},${y}) rotate(${rot}) scale(${sc})`);
        el.setAttribute('opacity', String(op));
      });

      // GLOW
      const gEl = getEl('ambGlow');
      if (gEl) {
        if (T>=PH.s2&&T<PH.s4) { const gt=cl((T-PH.s2)/(PH.s3-PH.s2)),gr=lerp(0,280,ease(gt)); gEl.setAttribute('rx',String(gr)); gEl.setAttribute('ry',String(gr*.6)); gEl.setAttribute('opacity',String(gt*.7)); }
        else if (T>=PH.s4) { const gt=1-eOut(cl((T-PH.s4)/1200)); gEl.setAttribute('rx',String(280*gt)); gEl.setAttribute('ry',String(168*gt)); gEl.setAttribute('opacity',String(gt*.7)); }
        else { gEl.setAttribute('rx','0'); gEl.setAttribute('ry','0'); gEl.setAttribute('opacity','0'); }
      }

      // BURST
      const bStart = PH.s3-200;
      const vParts = getEl('vParts');
      if (T>=bStart&&T<bStart+1400) {
        const bt=cl((T-bStart)/1400);
        if (vParts) vParts.setAttribute('opacity','1');
        for (let i=0;i<12;i++) { const ang=i*2*pi/12,dist=eOut(bt)*lerp(80,160,Math.sin(ang+1.2)*.5+.5); const vp=getEl(`vp${i}`); if (!vp) continue; vp.setAttribute('cx',String(CX+Math.cos(ang)*dist)); vp.setAttribute('cy',String(CY+Math.sin(ang)*dist)); vp.setAttribute('opacity',String((1-bt)*.9)); vp.setAttribute('r',String(lerp(4,.5,bt))); }
        for (let i=0;i<6;i++) { const ang=i*pi/6+pi/12,dist=eOut(bt)*lerp(60,120,i/6); const vl=getEl(`vl${i}`); if (!vl) continue; vl.setAttribute('x1',String(CX+Math.cos(ang)*dist*.1)); vl.setAttribute('y1',String(CY+Math.sin(ang)*dist*.1)); vl.setAttribute('x2',String(CX+Math.cos(ang)*dist)); vl.setAttribute('y2',String(CY+Math.sin(ang)*dist)); vl.setAttribute('opacity',String((1-bt)*.8)); }
      } else { if (vParts) vParts.setAttribute('opacity','0'); }

      // PHONE
      const phGroup = getEl('phoneGroup');
      if (phGroup) {
        const phIn=T>=PH.s3?eOut(cl((T-PH.s3)/900)):0, phOut=T>=PH.s6+1400?eOut(cl((T-PH.s6-1400)/800)):0;
        const phSc=lerp(.4,1,eOut(cl((T-PH.s3)/900))), phTr=eOut(cl((T-PH.s3)/900));
        phGroup.setAttribute('opacity',String(phIn*(1-phOut)));
        phGroup.setAttribute('transform',`translate(${lerp(640,0,phTr)},${lerp(340,0,phTr)}) scale(${phSc}) translate(${lerp(-640,0,phTr)},${lerp(-340,0,phTr)})`);
      }
      const progBar = getEl('progBar');
      if (progBar) { if (T>=PH.s5&&T<PH.s6) { progBar.setAttribute('width',String(eOut(cl((T-PH.s5)/(PH.s6-PH.s5-400)))*252)); } else { progBar.setAttribute('width','0'); } }

      // LINES
      ['line1','line2','line3'].forEach((id,i) => { const ls=PH.s5+200+i*300,lt=cl((T-ls)/1200),e=getEl(id); if (!e) return; e.setAttribute('stroke-dashoffset',String(lerp(600,0,eOut(lt)))); e.setAttribute('opacity',lt>0?'0.7':'0'); });

      // PLANES
      ([[0,'plane1'],[1,'plane2'],[2,'plane3']] as [number,string][]).forEach(([pi2,pid]) => {
        const ps=PH.s5+800+pi2*380,pt=cl((T-ps)/1600),pe=getEl(pid); if (!pe) return;
        if (pt<=0||pt>=1) { pe.setAttribute('opacity','0'); return; }
        pe.setAttribute('opacity','1');
        const p=planes[pi2],pos=bez3(eOut(pt),p.p0,p.p1,p.p2),ang=bez3ang(Math.min(pt+.01,.99),p.p0,p.p1,p.p2);
        pe.setAttribute('transform',`translate(${pos.x-10},${pos.y}) rotate(${ang})`);
      });

      // FIRM CARDS
      const firmStart = PH.s5+1400;
      (['firm1','firm2','firm3'] as string[]).forEach((id,i) => {
        const fs=firmStart+i*420,ft=cl((T-fs)/800),fEl=getEl(id); if (!fEl) return;
        fEl.setAttribute('opacity',String(eOut(ft)));
        const bases=['translate(240,560)','translate(640,580)','translate(1040,560)'];
        fEl.setAttribute('transform',`${bases[i]} translate(0,${lerp(30,0,eOut(ft))})`);
        const cs=fs+900,ct=cl((T-cs)/600);
        const ckEl=getEl(`ck${i+1}`),ckTEl=getEl(`ckT${i+1}`);
        if (ckEl) { ckEl.setAttribute('r',String(ct*9)); ckEl.setAttribute('opacity',String(eOut(ct))); }
        if (ckTEl) { ckTEl.setAttribute('opacity',String(eOut(ct))); }
        const glEl=getEl(`firm${i+1}glow`);
        if (glEl) { const gft=cl((T-cs)/300),gftOff=cl((T-cs-300)/400); glEl.setAttribute('opacity',String(eOut(gft)*.22*(1-eOut(gftOff)))); }
      });

      // SPARKLES
      const sparkStart=PH.s6+1200, sparkFade=TOTAL-1200;
      const slEl=getEl('sparkleLayer'); if (slEl) slEl.setAttribute('opacity',inDone?'1':'0');
      if (inDone) {
        const elapsed=T-sparkStart;
        sparkDefs.forEach((s,i) => {
          const delay=s[4],lt=cl((elapsed-delay)/700),pulse=Math.sin((elapsed-delay)*0.004*s[6]+i)*0.5+0.5;
          const sc2=eOut(lt)*(0.5+pulse*0.7),rotV=elapsed*s[6]/1000*180/pi,fadeV=cl((T-sparkFade)/900);
          if (sparkEls[i]) { sparkEls[i].setAttribute('d',starPath(s[0],s[1],s[2]*sc2,s[3]*sc2,rotV)); sparkEls[i].setAttribute('opacity',String(eOut(lt)*(.4+pulse*.6)*(1-eOut(fadeV)))); }
        });
        shootStars.forEach((el,i) => {
          const ssd=i*320,sst=cl((elapsed-ssd)/1800); if (sst<=0) { el.setAttribute('opacity','0'); return; }
          const loop=sst%1,sd=shootData[i],tStart=Math.max(0,loop-0.18),fadeV=cl((T-sparkFade)/900);
          el.setAttribute('x1',String(sd.x1+sd.dx*tStart)); el.setAttribute('y1',String(sd.y1+sd.dy*tStart));
          el.setAttribute('x2',String(sd.x1+sd.dx*loop)); el.setAttribute('y2',String(sd.y1+sd.dy*loop));
          el.setAttribute('opacity',String(Math.sin(loop*pi)*.8*(1-eOut(fadeV))));
        });
        const doneRings=getEl('doneRings'); if (doneRings) doneRings.setAttribute('opacity','1');
        ([[1,'ring1a','ring1b'],[2,'ring2a','ring2b'],[3,'ring3a','ring3b']] as [number,string,string][]).forEach(([fi,ra,rb]) => {
          const p1=Math.sin(elapsed*.0025+fi*1.2)*.5+.5,p2=Math.sin(elapsed*.0025+fi*1.2+1.5)*.5+.5;
          const fC=[[240,560],[640,580],[1040,560]][fi-1],fadeV=cl((T-sparkFade)/900);
          setAttr(ra,'cx',fC[0]); setAttr(ra,'cy',fC[1]); setAttr(ra,'r',lerp(90,120,p1)); setAttr(ra,'opacity',(.15+p1*.3)*(1-eOut(fadeV)));
          setAttr(rb,'cx',fC[0]); setAttr(rb,'cy',fC[1]); setAttr(rb,'r',lerp(110,148,p2)); setAttr(rb,'opacity',(.08+p2*.2)*(1-eOut(fadeV)));
        });
        const lb=getEl('logoBling'); if (lb) lb.setAttribute('opacity',String((Math.sin(elapsed*.003)*.5+.5)*.06));
      } else { const dr=getEl('doneRings'); if (dr) dr.setAttribute('opacity','0'); shootStars.forEach(el=>el.setAttribute('opacity','0')); }

      // LOGO
      const logT=cl((T-(PH.s6+500))/900),logOut=cl((T-TOTAL+1000)/800);
      setOp('logoCard',eOut(logT)*(1-eOut(logOut)));

      // CAPTIONS
      const hl = (id:string,start:number,dur:number,fo=500) => { const v=T>=start?ease(cl((T-start)/400)):0,f=T>=start+dur?eOut(cl((T-start-dur)/fo)):0; setOp(id,v*(1-f)); };
      hl('hl1',600,3000); hl('hl2',PH.s2+200,2600); hl('hl3',PH.s4+400,5200); hl('hl4',PH.s6+600,5800,800);

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [prefersReduced]);

  return (
    <div
      className="w-full overflow-hidden rounded-[20px] shadow-[0_32px_80px_rgba(0,0,0,.55)]"
      dangerouslySetInnerHTML={{ __html: O3S_CONCEPT_SVG }}
    />
  );
}



// ── HeroVisual: scattered records → swirl → intake card ──────────────────────
function HeroVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number | null>(null);
  const prefersReduced = useReducedMotion() ?? false;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cv = container.querySelector('canvas') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;

    let W = 0, H = 0, CX = 0, CY = 0;
    function resize() {
      const r = devicePixelRatio || 1;
      W = container.clientWidth; H = container.clientHeight;
      CX = W / 2; CY = H / 2;
      cv.width = W * r; cv.height = H * r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const TOTAL = 6000;
    const PH = { appear: 0, float: 700, swirl: 2000, form: 3400, rest: 4100, end: 5300 };

    type DocItem = { lb: string; hc: string; bc: string; bx: number; by: number; rot: number; ph: number; sa: number; sr: number };
    const DOCS: DocItem[] = [
      { lb: 'SCREENSHOT',   hc: '#6D4AFF', bc: '#EEE9FF', bx: -130, by:  -68, rot: -17, ph: 0.0, sa: 0, sr: 0 },
      { lb: 'TEXT MSG',     hc: '#5B39E6', bc: '#F2EFFF', bx:  -52, by: -108, rot:   9, ph: 0.5, sa: 0, sr: 0 },
      { lb: 'PAY STUB',     hc: '#111b3d', bc: '#F8F6FF', bx: -122, by:   48, rot:  -6, ph: 1.0, sa: 0, sr: 0 },
      { lb: 'HR COMPLAINT', hc: '#4A30CC', bc: '#EEE9FF', bx:   18, by:  -88, rot:  13, ph: 1.5, sa: 0, sr: 0 },
      { lb: 'EMAIL',        hc: '#8B6BFF', bc: '#F2EFFF', bx:   88, by:  -18, rot:  -8, ph: 2.0, sa: 0, sr: 0 },
      { lb: 'SCHEDULE',     hc: '#39415f', bc: '#F8F6FF', bx:  -42, by:   95, rot:  11, ph: 2.5, sa: 0, sr: 0 },
      { lb: 'NOTICE',       hc: '#6D4AFF', bc: '#EEE9FF', bx:  108, by:   52, rot: -13, ph: 3.0, sa: 0, sr: 0 },
    ];
    DOCS.forEach(d => { d.sa = Math.atan2(d.by, d.bx); d.sr = Math.sqrt(d.bx * d.bx + d.by * d.by); });

    const QMS = [
      { bx: -95, by: -148, ph: 0.0, sz: 28 },
      { bx:  52, by: -142, ph: 1.4, sz: 23 },
      { bx: 145, by:  -90, ph: 2.3, sz: 19 },
    ];

    const sc = () => Math.min(W, 580) / 580;
    const cl = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const eOut = (t: number) => 1 - (1 - t) ** 3;
    const eIn  = (t: number) => t * t * t;
    const eIO  = (t: number) => t < .5 ? 4*t*t*t : 1 - (-2*t+2)**3/2;

    function rr(x: number, y: number, w: number, h: number, r: number, fill?: string | null, stroke?: string | null, sw = 1) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
      if (fill)   { ctx.fillStyle = fill;     ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
    }
    function tx(str: string, x: number, y: number, sz: number, color: string, align: CanvasTextAlign = 'center', weight = '400') {
      ctx.font = `${weight} ${sz}px -apple-system,BlinkMacSystemFont,sans-serif`;
      ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x, y);
    }

    function drawDoc(d: DocItem, x: number, y: number, rotDeg: number, scale: number, alpha: number) {
      const s = sc(), dw = 100*s, dh = 70*s;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rotDeg * Math.PI / 180); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(24,31,67,0.10)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
      rr(-dw/2, -dh/2, dw, dh, 8*s, d.bc);
      ctx.shadowBlur = 0;
      ctx.save(); ctx.beginPath(); ctx.roundRect(-dw/2, -dh/2, dw, dh, 8*s); ctx.clip();
      ctx.fillStyle = d.hc; ctx.fillRect(-dw/2, -dh/2, dw, 22*s); ctx.restore();
      tx(d.lb, 0, -dh/2+15*s, 6.5*s, 'white', 'center', '700');
      const lc = 'rgba(109,74,255,0.10)', lx = -dw/2+12*s;
      rr(lx, -dh/2+28*s, (dw-24*s)*0.88, 4.5*s, 2.5, lc);
      rr(lx, -dh/2+37*s, (dw-24*s)*0.68, 4.5*s, 2.5, lc);
      rr(lx, -dh/2+46*s, (dw-24*s)*0.78, 4.5*s, 2.5, lc);
      rr(-dw/2, -dh/2, dw, dh, 8*s, null, '#e5def8', 1);
      ctx.restore();
    }

    function drawCard(x: number, y: number, scale: number, alpha: number) {
      const s = sc(), cw = 242*s, ch = 326*s;
      ctx.save();
      ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 190*s);
      g.addColorStop(0, 'rgba(109,74,255,0.08)'); g.addColorStop(1, 'rgba(109,74,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 190*s, 0, Math.PI*2); ctx.fill();
      ctx.shadowColor = 'rgba(24,31,67,0.12)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16*s;
      rr(-cw/2, -ch/2, cw, ch, 16*s, 'white');
      ctx.shadowBlur = 0;
      ctx.save(); ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw, ch, 16*s); ctx.clip();
      ctx.fillStyle = '#6D4AFF'; ctx.fillRect(-cw/2, -ch/2, cw, 60*s); ctx.restore();
      tx('INTAKE READY', 0, -ch/2+32*s, 12*s, 'white', 'center', '800');
      tx('Employment  •  Wrongful Termination', 0, -ch/2+49*s, 7.5*s, 'rgba(255,255,255,0.75)', 'center', '500');
      const bx = -cw/2+18*s, bw = cw-36*s;
      let y2 = -ch/2+72*s;
      ctx.strokeStyle = '#e5def8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, y2); ctx.lineTo(bx+bw, y2); ctx.stroke();
      y2 += 15*s;
      tx('TIMELINE', bx, y2, 7*s, '#66708f', 'left', '700');
      y2 += 17*s;
      const tl = [
        { t: 'HR complaint filed',     c: '#6D4AFF' },
        { t: 'Written warning issued', c: '#8B6BFF' },
        { t: 'Termination',            c: '#111b3d' },
      ];
      tl.forEach((item, i) => {
        const iy = y2 + i*25*s;
        ctx.beginPath(); ctx.arc(bx+8*s, iy-4*s, 3.5*s, 0, Math.PI*2);
        ctx.fillStyle = item.c; ctx.fill();
        if (i < tl.length-1) {
          ctx.strokeStyle = '#e5def8'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx+8*s, iy); ctx.lineTo(bx+8*s, iy+21*s); ctx.stroke();
        }
        tx(item.t, bx+21*s, iy, 8*s, '#39415f', 'left', '400');
      });
      y2 += tl.length*25*s + 12*s;
      ctx.strokeStyle = '#e5def8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, y2); ctx.lineTo(bx+bw, y2); ctx.stroke();
      y2 += 15*s;
      tx('DOCUMENTS', bx, y2, 7*s, '#66708f', 'left', '700');
      y2 += 17*s;
      const docs2 = [
        { t: 'Termination letter', done: true  },
        { t: 'Pay records',        done: true  },
        { t: 'Performance review', done: false },
      ];
      docs2.forEach((d2, i) => {
        const dy = y2 + i*25*s;
        ctx.beginPath(); ctx.arc(bx+8*s, dy-4*s, 6*s, 0, Math.PI*2);
        if (d2.done) { ctx.fillStyle = '#6D4AFF'; ctx.fill(); tx('✓', bx+8*s, dy, 8.5*s, 'white', 'center', '700'); }
        else { ctx.fillStyle = 'transparent'; ctx.strokeStyle = '#d5c9f3'; ctx.lineWidth = 1.5; ctx.stroke(); }
        tx(d2.done ? d2.t : d2.t + ' pending', bx+21*s, dy, 8*s, d2.done ? '#111b3d' : '#66708f', 'left', '400');
      });
      const badgeY = ch/2 - 36*s;
      rr(-bw/2, badgeY, bw, 24*s, 12*s, '#6D4AFF');
      tx('● Organized', 0, badgeY+16*s, 9.5*s, 'white', 'center', '700');
      rr(-cw/2, -ch/2, cw, ch, 16*s, null, '#e5def8', 1.5);
      ctx.restore();
    }

    let t0: number | null = null;

    function frame(ts: number) {
      if (!t0) t0 = ts;
      const T = (ts - t0) % TOTAL;
      const s = sc();

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#f8f6ff'; ctx.fillRect(0, 0, W, H);

      const inDocs  = T < PH.swirl;
      const inSwirl = T >= PH.swirl && T < PH.form;
      const inForm  = T >= PH.form  && T < PH.rest;
      const inRest  = T >= PH.rest  && T < PH.end;
      const inEnd   = T >= PH.end;

      if (inSwirl) {
        const gt = cl((T - PH.swirl) / (PH.form - PH.swirl));
        const g2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, 100*s);
        g2.addColorStop(0, `rgba(109,74,255,${eIO(gt)*0.18})`); g2.addColorStop(1, 'rgba(109,74,255,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(CX, CY, 100*s, 0, Math.PI*2); ctx.fill();
      }

      if (!inForm && !inRest && !inEnd) {
        const ft = T / 1000;
        DOCS.forEach((d, i) => {
          let x: number, y: number, rot: number, scale: number, alpha: number;
          if (inDocs) {
            const at = cl((T - i*90) / 480);
            alpha = eOut(at);
            x = CX + d.bx*s + Math.sin(ft*0.7 + d.ph)*6*s;
            y = CY + d.by*s + Math.cos(ft*0.55 + d.ph*1.3)*5*s;
            rot = d.rot + Math.sin(ft*0.38 + d.ph)*3;
            scale = 1;
          } else {
            const st = cl((T - PH.swirl) / (PH.form - PH.swirl));
            const ang = d.sa - eIn(st) * Math.PI * 2.2;
            const rad = d.sr * s * Math.pow(1 - eIn(st), 1.35);
            x = CX + Math.cos(ang) * rad;
            y = CY + Math.sin(ang) * rad * 0.65;
            rot = d.rot + st * 480;
            scale = Math.max(0, 1 - eIn(Math.pow(st, 1.2)) * 0.92);
            alpha = st < 0.55 ? 1 : cl(1 - (st - 0.55) / 0.45);
          }
          if (alpha > 0.02 && scale > 0.02) drawDoc(d, x, y, rot, scale, alpha);
        });
      }

      if (inDocs) {
        const ft = T / 1000;
        QMS.forEach((q, i) => {
          const at = cl((T - 320 - i*150) / 500);
          const qa = eOut(at) * 0.55;
          if (qa < 0.01) return;
          const qx = CX + q.bx*s + Math.sin(ft*0.5 + q.ph)*5*s;
          const qy = CY + q.by*s + Math.cos(ft*0.44 + q.ph*1.2)*7*s;
          ctx.save(); ctx.translate(qx, qy); ctx.globalAlpha = qa;
          ctx.font = `700 ${q.sz*s}px -apple-system,sans-serif`;
          ctx.fillStyle = '#C7B9FF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('?', 0, 0); ctx.restore();
        });
      }

      if (inForm || inRest || inEnd) {
        const ft = T / 1000;
        let cs: number, ca: number, fy = 0;
        if (inForm) {
          const ft2 = cl((T - PH.form) / (PH.rest - PH.form));
          cs = lerp(0.72, 1, eOut(ft2)); ca = eOut(ft2);
        } else if (inRest) {
          cs = 1; ca = 1; fy = Math.sin(ft * 1.1) * 3*s;
        } else {
          const et = cl((T - PH.end) / (TOTAL - PH.end));
          cs = 1; ca = 1 - eOut(et); fy = Math.sin(ft * 1.1) * 3*s;
        }
        drawCard(CX, CY + fy, cs, ca);
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    if (prefersReduced) {
      ctx.fillStyle = '#f8f6ff'; ctx.fillRect(0, 0, W, H);
      drawCard(CX, CY, 1, 1);
      ro.disconnect();
      return;
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [prefersReduced]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-[16px] border border-[#e5def8]"
      style={{ aspectRatio: '4/3', background: '#f8f6ff' }}
    >
      <canvas className="absolute inset-0 w-full h-full" />
    </div>
  );
}

// ── WorkerWorkflowScroll ─────────────────────────────────────────────────────
function WorkerWorkflowScroll() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28 bg-[#f8f6ff]">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#6d4aff]">How it works</p>
          <h2 className="text-[28px] font-bold leading-snug text-[#111b3d] sm:text-[34px]">
            From scattered records<br className="hidden sm:block" /> to review-ready intake
          </h2>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[27px] top-10 bottom-10 w-px bg-[#e5def8] sm:left-[35px]" aria-hidden />

          <div className="space-y-6">
            {HOW_IT_WORKS.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.1, ease: 'easeOut' }}
                className={`relative flex gap-5 rounded-2xl border p-5 sm:p-6 ${s.color}`}
              >
                {/* Step circle */}
                <div className="relative z-10 flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center rounded-full bg-[#6d4aff] shadow-[0_4px_14px_rgba(109,74,255,0.30)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">step</span>
                  <span className="text-[15px] font-bold leading-none text-white">{s.step}</span>
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${s.accent}`}>{s.tag}</span>
                  </div>
                  <h3 className="mb-2 text-[17px] font-bold leading-snug text-[#111b3d] sm:text-[18px]">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-[#39415f]">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Result pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-3 rounded-2xl border border-[#e5def8] bg-white px-6 py-4"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#6d4aff]" />
          <p className="text-sm font-medium text-[#111b3d]">
            Attorneys open an organized packet — before the first call.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ── WorkerWorkflowScroll_UNUSED_CANVAS ──────────────────────────────────────
function _WorkerWorkflowScrollCanvas_unused() {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const panelRef       = useRef<HTMLDivElement>(null);
  const rafRef         = useRef<number | null>(null);
  const prefersReduced = useReducedMotion() ?? false;

  useEffect(() => {
    const placeholder = placeholderRef.current;
    const panel       = panelRef.current;
    if (!placeholder || !panel || prefersReduced) return;

    const cv    = panel.querySelector('canvas') as HTMLCanvasElement;
    const ctx   = cv.getContext('2d')!;
    const cards = panel.querySelectorAll('.ww-card') as NodeListOf<HTMLElement>;
    const nums  = panel.querySelectorAll('.ww-num') as NodeListOf<HTMLElement>;
    const tits  = panel.querySelectorAll('.ww-title') as NodeListOf<HTMLElement>;
    const bods  = panel.querySelectorAll('.ww-body') as NodeListOf<HTMLElement>;
    const pips  = panel.querySelectorAll('.ww-pip') as NodeListOf<HTMLElement>;

    function resize() {
      const r = devicePixelRatio || 1;
      cv.width = window.innerWidth * r; cv.height = window.innerHeight * r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    function toAnimP(raw: number) {
      // even thirds: step 1 → step 2 → step 3, brief crossfade in between
      if (raw < 0.30) return lerp(0, 0.38, raw / 0.30);
      if (raw < 0.40) return lerp(0.38, 0.50, (raw - 0.30) / 0.10);
      if (raw < 0.65) return lerp(0.50, 0.78, (raw - 0.40) / 0.25);
      if (raw < 0.75) return lerp(0.78, 0.88, (raw - 0.65) / 0.10);
      return lerp(0.88, 1.0, (raw - 0.75) / 0.25);
    }

    const INFOS = [
      { lo: 0,   hi: .35, num: 'Step 1 of 3', title: 'Worker uploads their documents', body: 'Pay stubs, HR complaints, texts, medical records — uploaded directly from their phone in minutes. No preparation required.', step: 0 },
      { lo: .35, hi: .45, num: '', title: '', body: '', step: -1 },
      { lo: .45, hi: .70, num: 'Step 2 of 3', title: 'AI organizes your record', body: 'one3Seven clusters your documents, flags missing items, extracts key dates, and surfaces time-sensitive events automatically.', step: 1 },
      { lo: .70, hi: .80, num: '', title: '', body: '', step: -1 },
      { lo: .80, hi: 1.0, num: 'Step 3 of 3', title: 'Firms receive a structured intake', body: 'Attorneys open a clean, organized packet before the first consultation — no sorting, no follow-up calls needed.', step: 2 },
    ];

    let rawP = 0, renderP = 0, lastInfo = -1;

    function setRaw(v: number) {
      rawP = Math.max(0, Math.min(1, v));
      const fillEl = panel.querySelector('.ww-fill') as HTMLElement | null;
      if (fillEl) fillEl.style.width = (rawP * 100) + '%';
      const info = INFOS.find(x => rawP <= x.hi) || INFOS[INFOS.length - 1];
      if (info.step !== lastInfo) {
        lastInfo = info.step;
        if (info.step >= 0) {
          nums.forEach(el => el.textContent = info.num);
          tits.forEach(el => el.textContent = info.title);
          bods.forEach(el => el.textContent = info.body);
          cards.forEach(el => el.classList.add('show'));
          pips.forEach((p, i) => {
            p.classList.remove('active', 'done');
            if (i === info.step) p.classList.add('active');
            else if (i < info.step) p.classList.add('done');
          });
        } else {
          cards.forEach(el => el.classList.remove('show'));
        }
      }
    }

    const eOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const eIn  = (t: number) => t * t * t;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const cl   = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const band = (p: number, lo: number, hi: number) => cl((p - lo) / (hi - lo), 0, 1);

    const DOCS = [
      { label: 'Intake Form',  icon: '📋', a: 0   }, { label: 'Pay Stub',     icon: '💵', a: 45  },
      { label: 'Police Rpt',   icon: '🗂',  a: 90  }, { label: 'HR Complaint', icon: '📄', a: 135 },
      { label: 'Texts',        icon: '💬', a: 180 }, { label: 'Medical',      icon: '🏥', a: 225 },
      { label: 'Calendar',     icon: '📅', a: 270 }, { label: 'Employment',   icon: '💼', a: 315 },
    ];
    const FIRMS = [
      { name: 'Lee & Howard LLC', tag: 'Employment Law' },
      { name: 'Rivera Partners',  tag: 'Civil Rights · Labor' },
      { name: 'Murphy & Assoc.',  tag: 'Wrongful Termination' },
    ];
    const CHECKS = ['Intake Form', 'Pay Stub + Employment', 'Police Report + Evidence', 'Messages + Calendar'];

    function rr(x: number, y: number, w: number, h: number, r: number, fl?: string | null, st?: string | null, sw = 1) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
      if (fl) { ctx.fillStyle = fl; ctx.fill(); }
      if (st) { ctx.strokeStyle = st; ctx.lineWidth = sw; ctx.stroke(); }
    }
    function tx(s: string, x: number, y: number, sz: number, col: string, al: CanvasTextAlign = 'center', wt = '400') {
      ctx.font = `${wt} ${sz}px -apple-system,sans-serif`;
      ctx.fillStyle = col; ctx.textAlign = al; ctx.fillText(s, x, y);
    }

    // scale factor so all canvas drawing is proportional on any screen size
    const sc = () => Math.min(W(), 640) / 640;

    function drawDoc(x: number, y: number, label: string, icon: string, alpha: number, scale = 1, rot = 0) {
      const s = sc(), cw = 86*s, ch = 56*s;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
      rr(-cw/2, -ch/2, cw, ch, 10*s, 'rgba(45,31,110,.95)', 'rgba(109,74,255,.45)');
      ctx.font = `${16*s}px serif`; ctx.textAlign = 'center'; ctx.fillText(icon, 0, -7*s);
      tx(label, 0, 12*s, 7.5*s, 'rgba(255,255,255,.72)');
      ctx.restore();
    }

    function drawPhone(x: number, y: number, alpha: number, checkP: number) {
      const s = sc(), pw = 150*s, ph = 248*s, pr = 16*s;
      ctx.save(); ctx.globalAlpha = alpha;
      rr(x-pw/2, y-ph/2, pw, ph, pr, '#1A1340', 'rgba(109,74,255,.55)', 1.5);
      rr(x-18*s, y-ph/2+5*s, 36*s, 8*s, 4, '#0E0B26');
      ctx.fillStyle = 'rgba(109,74,255,.8)'; ctx.fillRect(x-pw/2+2, y-ph/2+17*s, pw-4, 28*s);
      tx('one3seven', x, y-ph/2+34*s, 10*s, '#fff', 'center', '500');
      tx('Your records, organized.', x, y-ph/2+53*s, 8*s, 'rgba(255,255,255,.55)');
      tx('8 documents · Ready to send', x, y-ph/2+65*s, 7.5*s, 'rgba(255,255,255,.35)');
      const sy = y - ph/2 + 80*s;
      CHECKS.forEach((c, i) => {
        const iy = sy + i * 32*s, p2 = cl((checkP * 4) - i, 0, 1);
        rr(x-pw/2+7*s, iy, pw-14*s, 26*s, 7, 'rgba(255,255,255,.055)');
        rr(x-pw/2+13*s, iy+6*s, 13*s, 13*s, 4, p2 > .5 ? '#34D399' : 'rgba(255,255,255,.07)', p2 > .5 ? '#34D399' : 'rgba(255,255,255,.18)');
        if (p2 > .5) tx('✓', x-pw/2+19.5*s, iy+16*s, 9*s, '#fff', 'center', '500');
        tx(c, x-pw/2+33*s, iy+15.5*s, 8*s, 'rgba(255,255,255,.72)', 'left');
        if (p2 > .5) { ctx.beginPath(); ctx.arc(x+pw/2-15*s, iy+12*s, 4, 0, Math.PI*2); ctx.fillStyle = '#34D399'; ctx.fill(); }
      });
      const bvy = y + ph/2 - 38*s, ba = cl((checkP - .7) / .3, 0, 1);
      if (ba > 0) { ctx.globalAlpha = alpha * ba; rr(x-pw/2+8*s, bvy, pw-16*s, 24*s, 12, '#6D4AFF'); tx('Send to Firms', x, bvy+15*s, 9.5*s, '#fff', 'center', '500'); ctx.globalAlpha = alpha; }
      ctx.restore();
    }

    function drawFirm(x: number, y: number, name: string, tag: string, alpha: number, recv: number) {
      const s = sc(), fw = 124*s, fh = 68*s;
      ctx.save(); ctx.globalAlpha = alpha;
      rr(x-fw/2, y-fh/2, fw, fh, 12, 'rgba(26,19,64,.95)', recv > 0 ? 'rgba(52,211,153,.5)' : 'rgba(109,74,255,.3)', recv > 0 ? 1.5 : 1);
      tx(name, x, y-9*s, 8*s, 'rgba(255,255,255,.9)', 'center', '500');
      tx(tag, x, y+3.5*s, 7*s, 'rgba(255,255,255,.4)');
      if (recv > 0) { ctx.globalAlpha = alpha * recv; rr(x-34*s, y+12*s, 68*s, 15*s, 7, 'rgba(52,211,153,.18)'); tx('Case Received ✓', x, y+22*s, 7.5*s, '#34D399', 'center', '500'); }
      ctx.restore();
    }

    interface Sparkle { x: number; y: number; vx: number; vy: number; life: number; sz: number; col: string; }
    let sparkles: Sparkle[] = [], firmReceived = [0, 0, 0], lastTs = 0;

    function addSp(x: number, y: number, n = 4) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 25 + Math.random() * 50;
        sparkles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 1, sz: 2 + Math.random()*2.5, col: Math.random() < .5 ? '#A78BFA' : '#34D399' });
      }
    }

    function frame(ts: number) {
      const dt = Math.min((ts - lastTs) / 1000, .05); lastTs = ts;
      renderP = lerp(renderP, toAnimP(rawP), .18);
      const p = renderP, cw = W(), ch = H(), cx = cw/2, cy = ch/2;
      ctx.clearRect(0, 0, cw, ch);
      const g = ctx.createRadialGradient(cx, cy*.7, 0, cx, cy, Math.max(cw,ch)*.7);
      g.addColorStop(0, '#2D1F6E'); g.addColorStop(1, '#0E0B26');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

      const mob = cw < 640;
      // on mobile, animation sits in upper 55% so bottom info card doesn't overlap
      const animCy = mob ? ch * .42 : cy;

      if (p < .42) {
        DOCS.forEach((d, i) => {
          const delay = i / DOCS.length * .4, tIn = cl((band(p, 0, .18) - delay) / (1 - delay), 0, 1);
          const ang = (d.a + i*4) * Math.PI/180, baseR = mob ? cw * .32 : cw * .265;
          if (p < .18) {
            const fl = Math.sin(ts/700 + i) * 3;
            drawDoc(cx + Math.cos(ang)*eOut(tIn)*baseR, animCy + Math.sin(ang)*eOut(tIn)*baseR*.6 + fl, d.label, d.icon, eOut(Math.min(tIn*3, 1)), 1, (d.a/180 - .5)*.28);
          } else {
            const vd = i/DOCS.length*.35, t2v = cl((band(p, .18, .4) - vd) / (1 - vd), 0, 1);
            const spin = eIn(t2v)*Math.PI*1.8, rNow = baseR*(1 - eOut(t2v));
            drawDoc(cx + Math.cos(ang+spin)*rNow, animCy + Math.sin(ang+spin)*rNow*.6, d.label, d.icon, Math.max(1 - eOut(Math.max(t2v-.55,0)/.45), 0), 1 - eOut(t2v)*.65);
          }
        });
        if (p >= .18) {
          const vt = band(p, .18, .4), va = vt * .65, vr = mob ? 48 : 72;
          const vg = ctx.createRadialGradient(cx, animCy, 0, cx, animCy, vr*vt);
          vg.addColorStop(0, `rgba(109,74,255,${va})`); vg.addColorStop(1, 'rgba(109,74,255,0)');
          ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(cx, animCy, vr*vt, 0, Math.PI*2); ctx.fill();
          for (let r = 0; r < 3; r++) {
            const rp = (vt*1.2 + r/3) % 1;
            ctx.beginPath(); ctx.arc(cx, animCy, rp*(mob ? 60 : 88), 0, Math.PI*2);
            ctx.strokeStyle = `rgba(167,139,250,${(1-rp)*.4})`; ctx.lineWidth = 1.5; ctx.stroke();
          }
        }
      }

      if (p >= .32 && p < .65) {
        drawPhone(cx, animCy, eOut(band(p, .36, .5)), band(p, .45, .62));
        if (band(p, .45, .62) > .95 && Math.random() < .05) addSp(cx + lerp(-50,50,Math.random()), animCy + lerp(-60,60,Math.random()), 2);
      }

      if (p >= .58) {
        const phoneA = cl(1 - band(p, .65, .8)*2.5, 0, 1);
        if (p < .82) drawPhone(cx, animCy, Math.max(phoneA, 0), 1);
        // on mobile: stack firms vertically; on desktop: spread horizontally
        const fxs = mob
          ? [cx, cx, cx]
          : [cx - cw*.24, cx, cx + cw*.24];
        const fys = mob
          ? [animCy - ch*.18, animCy, animCy + ch*.18]
          : [cy + ch*.13, cy + ch*.13, cy + ch*.13];
        fxs.forEach((fx, i) => {
          const fy = fys[i];
          const delay = i * .07, t2v = band(p, .62 + delay, .8);
          if (p < .82) drawFirm(fx, fy, FIRMS[i].name, FIRMS[i].tag, eOut(t2v), 0);
          if (t2v > 0 && t2v < 1) {
            const px = lerp(cx, fx, eOut(t2v)), py = lerp(animCy-22, fy-33, eOut(t2v)) - Math.sin(t2v*Math.PI)*ch*.08;
            ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2((fy-33)-(animCy-22), (fx-cx))*.7);
            ctx.fillStyle = '#A78BFA'; ctx.beginPath(); ctx.moveTo(11,0); ctx.lineTo(-5,-4); ctx.lineTo(-2,0); ctx.lineTo(-5,4); ctx.closePath(); ctx.fill(); ctx.restore();
            if (t2v > .88) addSp(fx, fy-28, 1);
          }
          if (p >= .8) { firmReceived[i] = Math.min(firmReceived[i] + dt*3, band(p, .8, .97)); drawFirm(fx, fy, FIRMS[i].name, FIRMS[i].tag, 1, firmReceived[i]); }
          if (p > .84 && p < .92 && Math.random() < .03) addSp(fx, fy, 1);
        });
      }

      sparkles = sparkles.filter(s => s.life > 0);
      sparkles.forEach(s => {
        s.x += s.vx*dt; s.y += s.vy*dt; s.life -= dt*2;
        ctx.save(); ctx.globalAlpha = Math.max(s.life, 0); ctx.translate(s.x, s.y); ctx.fillStyle = s.col;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r2 = i%2===0 ? s.sz : s.sz*.35, a = i*Math.PI/4; i===0 ? ctx.moveTo(Math.cos(a)*r2, Math.sin(a)*r2) : ctx.lineTo(Math.cos(a)*r2, Math.sin(a)*r2); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      });

      if (rawP < .02) firmReceived = [0, 0, 0];
      rafRef.current = requestAnimationFrame(frame);
    }

    // page scroll drives the animation via fixed panel
    const onScroll = () => {
      const rect = placeholder.getBoundingClientRect();
      const scrollable = placeholder.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      // show panel as soon as placeholder starts entering viewport (not just when top hits 0)
      const entering = rect.top < window.innerHeight * 0.5 && rect.bottom > 0;
      panel.style.opacity = entering ? '1' : '0';
      if (entering) setRaw(Math.max(0, -rect.top / scrollable));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    setRaw(0);
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [prefersReduced]);

  return (
    <>
      {/* Tall placeholder that holds scroll space — dark bg prevents white flash on entry/exit */}
      <div ref={placeholderRef} style={{ height: '220vh', background: '#0E0B26' }} aria-hidden="true" />

      {/* Fixed fullscreen panel */}
      <div
        ref={panelRef}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, background: '#0E0B26', opacity: 0, transition: 'opacity 0.15s' }}
      >
        <canvas style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* Top label */}
        <div className="absolute top-5 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A78BFA]">How it works</div>
          <div className="text-[10px] text-white/30 tracking-widest uppercase">scroll to explore</div>
        </div>

        {/* Step pips — right side on desktop, hidden on mobile (progress bar is enough) */}
        <div className="absolute top-1/2 -translate-y-1/2 right-4 hidden sm:flex flex-col gap-3 items-center">
          {[0,1,2].map(i => (
            <div key={i} className="ww-pip w-1.5 h-1.5 rounded-full bg-white/20 transition-all duration-500 [&.active]:bg-[#6D4AFF] [&.active]:h-8 [&.active]:rounded-full [&.done]:bg-[#6D4AFF]/40" />
          ))}
        </div>

        {/* Info card — bottom on mobile, left column on desktop */}
        {/* Mobile: bottom overlay */}
        <div className="absolute bottom-5 left-4 right-4 sm:hidden pointer-events-none">
          <div className="ww-card opacity-0 translate-y-2 transition-all duration-500 [&.show]:opacity-100 [&.show]:translate-y-0 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm px-5 py-4">
            <div className="ww-num mb-1.5 text-[10px] font-bold text-[#A78BFA] uppercase tracking-[0.15em]" />
            <div className="ww-title mb-1.5 text-[17px] font-bold text-white leading-snug" />
            <div className="ww-body text-[12px] text-white/50 leading-relaxed" />
          </div>
        </div>
        {/* Desktop: left column */}
        <div className="absolute top-0 left-0 bottom-0 hidden sm:flex w-[300px] flex-col justify-center px-8 pointer-events-none">
          <div className="ww-card opacity-0 translate-y-3 transition-all duration-500 [&.show]:opacity-100 [&.show]:translate-y-0">
            <div className="ww-num mb-3 text-[11px] font-bold text-[#A78BFA] uppercase tracking-[0.15em]" />
            <div className="ww-title mb-3 text-[22px] font-bold text-white leading-snug" />
            <div className="ww-body text-[14px] text-white/50 leading-relaxed" />
          </div>
        </div>

        {/* Scroll progress bar — bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/8">
          <div className="ww-fill h-full bg-[#6D4AFF] w-0" style={{ transition: 'width 0.05s linear' }} />
        </div>
      </div>
    </>
  );
}
void _WorkerWorkflowScrollCanvas_unused;

// ── InfoTooltip ──────────────────────────────────────────────────────────────
function InfoTooltip({ tip }: { tip: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[#DCD3FF] bg-white text-[9px] font-bold text-[#6D4AFF] hover:bg-[#F7F3FF] transition"
        aria-label="More information"
      >
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-xl border border-[#E7E1FF] bg-white p-3 shadow-lg">
          <p className="text-[11px] leading-relaxed text-[#1E1B4B]/70">{tip}</p>
        </div>
      )}
    </div>
  );
}

// ── RecordsPathSection: scroll-triggered 4-stage narrative ──────────────────
function RecordsPathSection({ reduced }: { reduced: boolean }) {
  const stages = [
    {
      number: '1',
      label: 'Worker story',
      body: 'A worker uploads their documents — pay stubs, emails, HR complaints. Scattered files, no clear order.',
      color: 'bg-[#F7F3FF] border-[#DCD3FF]',
      accent: 'text-[#6D4AFF]',
      dot: 'bg-[#6D4AFF]',
    },
    {
      number: '3',
      label: 'Records organized',
      body: "Documents are organized into three clusters: what was received, what's missing, and what may be time-sensitive.",
      color: 'bg-[#F0FDF4] border-[#BBF7D0]',
      accent: 'text-emerald-600',
      dot: 'bg-emerald-500',
    },
    {
      number: '7',
      label: 'Timeline extracted',
      body: 'Up to seven key events are surfaced from the record — dates, gaps, and employer responses organized in sequence.',
      color: 'bg-[#FFF7ED] border-[#FED7AA]',
      accent: 'text-orange-600',
      dot: 'bg-orange-500',
    },
    {
      number: '→',
      label: 'Attorney review ready',
      body: 'A structured intake record arrives in the firm dashboard before the first consultation. No legal conclusions — attorney decides.',
      color: 'bg-[#1E1B4B] border-[#2D2A6A]',
      accent: 'text-[#A78BFA]',
      dot: 'bg-[#A78BFA]',
      dark: true,
    },
  ];

  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20 overflow-hidden">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#6D4AFF]">The 137 path</div>
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-[#1E1B4B] sm:text-[34px]">
            Records finding order
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((s, i) => (
            <motion.div
              key={s.label}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: reduced ? 0 : i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-[22px] border p-6 ${s.color}`}
            >
              <div className={`mb-4 text-[32px] font-black leading-none ${s.accent}`}>{s.number}</div>
              <div className={`mb-2 text-[13px] font-bold ${s.dark ? 'text-white' : 'text-[#1E1B4B]'}`}>{s.label}</div>
              <p className={`text-[12px] leading-relaxed ${s.dark ? 'text-white/60' : 'text-[#1E1B4B]/55'}`}>{s.body}</p>
              {i < stages.length - 1 && (
                <div className={`absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white lg:block ${s.dot}`} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PublicMarketingPage({ onWorkerStart, onFirmStart, onSignIn, firmDirectedContext = null }: PublicMarketingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBetaModal, setShowBetaModal] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;

  const openBetaModal = () => setShowBetaModal(true);

  return (
    <div className="min-h-screen bg-white text-[#1E1B4B] antialiased">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-[#F0EBFF] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-[5px] bg-gradient-to-br from-[#6D4AFF] to-[#A78BFA] shadow-sm" />
            <div className="text-[17px] font-bold tracking-tight text-[#1E1B4B]"><WordMark /></div>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <button
              type="button"
              onClick={onSignIn}
              className="text-sm font-medium text-[#1E1B4B]/60 transition hover:text-[#1E1B4B]"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={openBetaModal}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#6D4AFF] to-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(109,74,255,0.30)] transition hover:shadow-[0_12px_32px_rgba(109,74,255,0.40)] hover:-translate-y-px active:scale-[0.97]"
            >
              For attorneys
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Mobile nav toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col gap-1.5 p-2.5 sm:hidden touch-manipulation"
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-5 bg-[#1E1B4B] transition-all ${mobileMenuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 bg-[#1E1B4B] transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-[#1E1B4B] transition-all ${mobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-[#F0EBFF] bg-white px-5 py-4 sm:hidden">
            <div className="flex flex-col">
              <button type="button" onClick={onSignIn} className="flex items-center min-h-[48px] text-base font-medium text-[#1E1B4B]/60 text-left py-3">Sign in</button>
              <button type="button" onClick={openBetaModal} className="flex items-center gap-1.5 min-h-[48px] text-base font-semibold text-[#6D4AFF] text-left py-3">For attorneys <ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={openBetaModal} className="flex items-center gap-1.5 min-h-[48px] text-base font-semibold text-[#1E1B4B]/70 text-left py-3">Organize my intake <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#FAFAFF] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
        {/* Background blobs — slow drift */}
        <motion.div
          className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#6D4AFF]/5 blur-3xl"
          animate={{ x: [0, 24, -12, 0], y: [0, -18, 14, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="pointer-events-none absolute -right-32 top-1/2 h-[400px] w-[400px] rounded-full bg-[#6D4AFF]/4 blur-3xl"
          animate={{ x: [0, -20, 10, 0], y: [0, 16, -10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {firmDirectedContext ? (
                /* ── Journey 2: firm-directed worker entry ── */
                <>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DCD3FF] bg-white px-4 py-1.5 text-xs font-semibold text-[#6D4AFF] shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6D4AFF] animate-pulse" />
                    Sent by {firmDirectedContext.firmName}
                  </div>

                  <h1 className="mb-5 text-[32px] font-bold leading-[1.1] tracking-tight text-[#1E1B4B] sm:text-[44px] lg:text-[54px]">
                    {firmDirectedContext.firmName}
                    <br />
                    <span className="text-[#6D4AFF]">asked you to</span>
                    <br />
                    submit here.
                  </h1>

                  <p className="mb-8 max-w-[480px] text-[16px] leading-relaxed text-[#1E1B4B]/62 sm:text-[17px]">
                    This takes about 10–15 minutes. Your records will be organized and sent directly to {firmDirectedContext.firmName} — no emails or follow-up calls needed.
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={onWorkerStart}
                      className="flex items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_48px_rgba(109,74,255,0.28)] transition hover:bg-[#5B35D5] hover:-translate-y-0.5"
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-4 text-sm text-[#1E1B4B]/50">
                    Free to submit · Your records stay private until you approve sharing
                  </p>
                </>
              ) : (
                /* ── Journey 1: self-discovered worker ── */
                <>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DCD3FF] bg-white px-4 py-1.5 text-xs font-semibold text-[#6D4AFF] shadow-[0_2px_12px_rgba(109,74,255,0.12)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#6D4AFF] to-[#A78BFA] animate-pulse" />
                    Employment intake · California beta
                  </div>

                  <h1 className="mb-5 text-[32px] font-bold leading-[1.1] tracking-tight text-[#1E1B4B] sm:text-[44px] lg:text-[54px]">
                    Workers deserve
                    <br />
                    organized
                    <br />
                    <span className="bg-gradient-to-r from-[#6D4AFF] to-[#A78BFA] bg-clip-text text-transparent">representation.</span>
                  </h1>

                  <p className="mb-5 max-w-[480px] text-[16px] leading-relaxed text-[#1E1B4B]/62 sm:text-[17px]">
                    one3seven turns scattered employment records, notes, and documents into a structured intake packet — organized before the attorney ever reviews it.
                  </p>

                  <p className="mb-7 flex items-center gap-2 text-sm font-medium text-[#1E1B4B]/70">
                    <Shield className="h-4 w-4 flex-shrink-0 text-[#6D4AFF]" />
                    Your records stay private until you decide to share them.
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={openBetaModal}
                      className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6D4AFF] to-[#7C3AED] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_48px_rgba(109,74,255,0.32)] transition hover:shadow-[0_20px_60px_rgba(109,74,255,0.45)] hover:-translate-y-0.5 active:scale-[0.97]"
                    >
                      Organize my intake
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={openBetaModal}
                      className="flex items-center justify-center gap-2 rounded-full border border-[#E7E1FF] bg-white px-7 py-3.5 text-[15px] font-semibold text-[#1E1B4B] transition hover:bg-[#F7F3FF]"
                    >
                      Organize my intake
                    </button>
                  </div>

                  <p className="mt-4 text-sm text-[#1E1B4B]/50">
                    Free to submit · Built for California employment matters · You control what's shared
                  </p>
                </>
              )}
            </motion.div>

            {/* Right: animated hero visual — chaos → organize → clarity */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex justify-center"
            >
              <div className="w-full max-w-[520px]">
                <HeroVisual />
                {/* Caption beneath visual */}
                <div className="mt-3 hidden items-center justify-center gap-6 text-xs text-[#1E1B4B]/40 sm:flex">
                  <span>Scattered records</span>
                  <span className="text-[#6D4AFF]/60">→ one3seven →</span>
                  <span>Organized for attorney review</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* ── THE PROBLEM ── */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-[640px] text-center">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#6D4AFF]">The problem</div>
            <h2 className="mb-5 text-[30px] font-bold leading-tight tracking-tight text-[#1E1B4B] sm:text-[38px]">
              Employment matters rarely arrive organized
            </h2>
            <p className="text-[15px] leading-relaxed text-[#1E1B4B]/60 sm:text-[16px]">
              Workers show up with documents scattered across phones, emails, and folders — no order, no timeline, no clear story. Attorneys spend the first consultation assembling the record instead of evaluating the matter. When intake is disorganized, important information gets missed, decisions get delayed, and time-sensitive issues can slip through.
            </p>
          </div>

          {/* Problem cards */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: '⏱',
                title: 'Attorney time wasted',
                body: 'First-consult time is often spent organizing documents rather than evaluating the matter. one3Seven performs an initial organization pass before the attorney sees the intake.',
              },
              {
                icon: '📁',
                title: 'Documents go missing',
                body: 'Critical pay stubs, HR complaints, and text messages may never make it to counsel. Missing records can make the matter harder to evaluate and may require additional follow-up.',
              },
              {
                icon: '⏳',
                title: 'Filing periods vary',
                body: 'Employment matters may involve different filing periods depending on the events, allegations, and jurisdiction. Critical dates can be difficult to identify when the record is incomplete.',
              },
            ].map((c) => (
              <div key={c.title} className="rounded-[20px] border border-[#F0EBFF] bg-[#FAFAFF] p-6">
                <div className="mb-3 text-[28px]">{c.icon}</div>
                <h3 className="mb-2 text-[15px] font-bold text-[#1E1B4B]">{c.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#1E1B4B]/55">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <WorkerWorkflowScroll />

      {/* ── FOR ATTORNEYS ── */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#6D4AFF]">For attorneys</div>
              <h2 className="mb-5 text-[30px] font-bold leading-tight tracking-tight text-[#1E1B4B] sm:text-[36px]">
                Everything you need
                <br />
                before the consultation starts
              </h2>
              <p className="mb-8 text-[15px] leading-relaxed text-[#1E1B4B]/60">
                Every intake arrives organized, timestamped, and structured for attorney review. Spend less time assembling the record and more time evaluating the matter.
              </p>
              <button
                type="button"
                onClick={openBetaModal}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6D4AFF] to-[#7C3AED] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_48px_rgba(109,74,255,0.28)] transition hover:shadow-[0_20px_60px_rgba(109,74,255,0.42)] hover:-translate-y-0.5 active:scale-[0.97]"
              >
                Start free pilot
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIRM_FEATURES.map((f) => (
                <motion.div
                  key={f.label}
                  className="rounded-[18px] border border-[#F0EBFF] bg-white p-5 shadow-sm cursor-default"
                  whileHover={{ y: -5, boxShadow: '0 12px 32px rgba(109,74,255,0.10)' }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <f.icon className="mb-3 h-5 w-5 text-[#6D4AFF]" />
                  <div className="mb-1 flex items-center text-[13px] font-bold text-[#1E1B4B]">
                    {f.label}
                    {f.tip && <InfoTooltip tip={f.tip} />}
                  </div>
                  <div className="text-[12px] leading-relaxed text-[#1E1B4B]/55">{f.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR WORKERS ── */}
      <section className="relative overflow-hidden bg-[#1E1B4B] px-5 py-16 sm:px-8 sm:py-24">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#6D4AFF]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-[#A78BFA]/8 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#A78BFA]">For workers</div>
              <h2 className="mb-5 text-[30px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">
                Your story, organized.
                <br />
                <span className="bg-gradient-to-r from-[#A78BFA] to-[#C4B5FD] bg-clip-text text-transparent">You control what's shared.</span>
              </h2>
              <p className="mb-8 text-[15px] leading-relaxed text-white/60">
                Upload your documents. The AI does the rest. You see your own timeline, your status, and you decide when — and with whom — to share your intake.
              </p>
              <button
                type="button"
                onClick={openBetaModal}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-[15px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Organize my intake
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3">
              {[
                { emoji: '🔒', title: 'You control sharing', body: 'Your intake is not shared with a firm until you approve sharing or submit through that firm\'s intake link, subject to the platform\'s Privacy Policy and Terms.' },
                { emoji: '📱', title: 'Plain language, always', body: 'No legal jargon. Your status updates are written in plain English. View available status updates at any time.' },
                { emoji: '📅', title: 'Your timeline, organized', body: 'Dates, events, and documents are organized into a clear timeline — so your story is easier to follow before you walk into a consultation.' },
                { emoji: '🤝', title: 'Choose how to share', body: 'Submit directly to a participating firm using its intake link, or authorize your intake to be made available through the participating-firm network.' },
              ].map((w) => (
                <motion.div
                  key={w.title}
                  className="flex gap-4 rounded-[18px] border border-white/8 bg-white/5 p-5 cursor-default"
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.09)', y: -3 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <div className="text-[22px] shrink-0">{w.emoji}</div>
                  <div>
                    <div className="mb-1 text-[14px] font-bold text-white">{w.title}</div>
                    <div className="text-[12px] leading-relaxed text-white/55">{w.body}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST / COMPLIANCE ── */}
      <section className="border-y border-[#F0EBFF] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-16">
            <div className="shrink-0 sm:w-[280px]">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#6D4AFF]">Built for legal</div>
              <h3 className="text-[22px] font-bold leading-snug text-[#1E1B4B]">
                Built for attorney review.
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#1E1B4B]/55">
                Organized intake information with source records preserved for independent review.
              </p>
            </div>
            <div className="flex-1">
              <ul className="grid gap-3 sm:grid-cols-2">
                {TRUST_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6D4AFF]" />
                    <span className="text-[13px] text-[#1E1B4B]/70">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[12px] leading-relaxed text-[#1E1B4B]/40">
                one3Seven organizes records and surfaces information from documents. It does not provide legal advice, case predictions, or legal conclusions. All source documents remain available for direct attorney review. Attorneys are responsible for independently verifying AI-organized content before relying on it.
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-[#1E1B4B]/40">
                <span className="font-semibold text-[#1E1B4B]/55">Time-sensitive filing periods may apply.</span>{' '}
                Depending on the allegations and jurisdiction, a matter may involve deadlines associated with agencies such as the EEOC, California Civil Rights Department, or Labor Commissioner. one3Seven surfaces relevant dates for attorney review — it does not determine the applicable agency or filing deadline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PILOT CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#5B35D5] via-[#6D4AFF] to-[#7C3AED] px-5 py-16 sm:px-8 sm:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.18)_0%,transparent_60%)]" />
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-5 text-[32px] font-bold leading-tight tracking-tight text-white sm:text-[42px]">
              Ready to stop losing time
              <br />
              on disorganized intakes?
            </h2>
            <p className="mb-8 text-[15px] leading-relaxed text-white/70">
              Join the pilot. Your first intake arrives organized — timeline extracted, documents categorized, dates surfaced for attorney review.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={openBetaModal}
                className="flex items-center gap-2 rounded-full bg-white px-8 py-4 text-[15px] font-bold text-[#6D4AFF] shadow-[0_16px_48px_rgba(0,0,0,0.20)] transition hover:bg-white/93 hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(0,0,0,0.28)] active:scale-[0.97]"
              >
                Start free pilot
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openBetaModal}
                className="rounded-full border border-white/30 px-8 py-4 text-[15px] font-semibold text-white transition hover:bg-white/10"
              >
                Organize my intake
              </button>
            </div>
            <p className="mt-4 text-[12px] text-white/40">
              Employment attorneys only · California employment matters · Cancel anytime
            </p>
            <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <a
                href="/worker-demo"
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/20"
              >
                Worker demo
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="/?demo"
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/20"
              >
                Firm demo
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#18163E] px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="h-4 w-4 rounded-[4px] bg-gradient-to-br from-[#6D4AFF] to-[#A78BFA]" />
                <div className="text-[16px] font-bold text-white"><WordMark className="text-white [&>span]:text-[#c7b9ff]" /></div>
              </div>
              <div className="text-[12px] text-white/40">AI-powered employment intake engine</div>
            </div>
            <div className="flex flex-wrap gap-5">
              {[
                { label: 'For workers', action: openBetaModal },
                { label: 'For attorneys', action: openBetaModal },
                { label: 'Sign in', action: onSignIn },
              ].map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={l.action}
                  className="text-[13px] text-white/50 transition hover:text-white"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 border-t border-white/8 pt-8 text-[11px] text-white/28">
            © {new Date().getFullYear()} one3Seven. one3Seven is not a law firm and does not provide legal advice. Use of this platform does not create an attorney-client relationship. All AI-organized intake content requires independent verification by a licensed attorney before use. Submission of an intake does not require any firm to review, accept, or represent the worker. An attorney-client relationship is created only through a separate written agreement between the worker and a law firm.
          </div>
        </div>
      </footer>

      {/* ── CONTROLLED BETA MODAL ── */}
      {showBetaModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#1E1B4B]/70 px-5 backdrop-blur-sm"
          onClick={() => setShowBetaModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-[24px] bg-white shadow-[0_40px_96px_rgba(30,27,75,0.30)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#6D4AFF] to-[#A78BFA]" />
            <div className="p-8">
              <div className="mb-1 flex items-center gap-1.5">
                <div className="h-3.5 w-3.5 rounded-[3px] bg-gradient-to-br from-[#6D4AFF] to-[#A78BFA]" />
                <div className="text-xs font-bold uppercase tracking-wider text-[#6D4AFF]"><WordMark /></div>
              </div>
              <h2 className="mb-3 text-[20px] font-bold leading-snug text-[#1E1B4B]">Controlled beta</h2>
              <p className="mb-6 text-[14px] leading-relaxed text-[#1E1B4B]/60">
                one3Seven is currently in controlled beta while Terms, Privacy, and consent language are under legal review. You can view the demos now. Real intake access is by invitation only.
              </p>
              <div className="flex flex-col gap-2.5">
                <a
                  href="/worker-demo"
                  className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6D4AFF] to-[#7C3AED] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(109,74,255,0.28)] transition hover:shadow-[0_12px_32px_rgba(109,74,255,0.40)] hover:-translate-y-px active:scale-[0.97]"
                >
                  View worker demo
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/?demo"
                  className="flex items-center justify-center gap-2 rounded-full border border-[#E7E1FF] bg-[#F7F5FF] px-6 py-3 text-[14px] font-semibold text-[#6D4AFF] transition hover:bg-[#EDE8FF] active:scale-[0.97]"
                >
                  View firm demo
                  <ArrowRight className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setShowBetaModal(false)}
                  className="rounded-full px-6 py-3 text-[13px] font-medium text-[#1E1B4B]/45 transition hover:text-[#1E1B4B]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
