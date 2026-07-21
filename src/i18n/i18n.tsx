import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Lightweight worker-facing i18n. One toggle flips every worker surface; the choice persists.
// The internal CRM stays English on purpose. Legal/disclaimer strings are marked LEGAL-REVIEW
// in the dictionary — a bilingual read is recommended before real workers rely on them.

export type Lang = 'en' | 'es';

type Dict = Record<string, { en: string; es: string }>;

// ── String catalog (worker-facing). Add keys here; screens read them via t(). ──
export const STRINGS: Dict = {
  // Worker home (AuthWelcomeScreen)
  'aw.badge':        { en: 'For workers · California',            es: 'Para trabajadores · California' },
  'aw.signin':       { en: 'Sign in',                             es: 'Iniciar sesión' },
  'aw.h1_line1':     { en: 'Your records are everywhere.',        es: 'Tus documentos están por todas partes.' },
  'aw.h1_line2':     { en: "Your story doesn't have to be.",      es: 'Tu historia no tiene por qué estarlo.' },
  'aw.sub':          { en: 'Organize documents, conversations, timelines, and records in one place before speaking with an attorney.',
                       es: 'Organiza documentos, conversaciones, cronologías y registros en un solo lugar antes de hablar con un abogado.' },
  'aw.start':        { en: 'Start Organizing',                    es: 'Comenzar a organizar' },
  'aw.organizing':   { en: 'Organizing...',                       es: 'Organizando...' },
  'aw.firm':         { en: 'Participating firm?',                 es: '¿Firma participante?' },
  // Founder origin
  'aw.why':          { en: 'Why one3seven exists',                es: 'Por qué existe one3seven' },
  'aw.why_body':     { en: 'one3seven was built by someone who went through her own legal situation — and had to write out her whole story from scratch every time she talked to a new attorney. Scattered records, retold from memory, over and over. There had to be a better way.',
                       es: 'one3seven fue creado por alguien que vivió su propia situación legal — y tenía que escribir toda su historia desde cero cada vez que hablaba con un nuevo abogado. Documentos dispersos, contados de memoria, una y otra vez. Tenía que haber una mejor manera.' },
  'aw.quote':        { en: '“You should only have to tell your story once.”',
                       es: '“Solo deberías tener que contar tu historia una vez.”' },
  'aw.founder':      { en: '— Victoria, founder',            es: '— Victoria, fundadora' },

  // Homepage nav (PublicMarketingPage)
  'nav.signin':      { en: 'Sign in',                             es: 'Iniciar sesión' },
  'nav.signup':      { en: 'Sign up for free',                    es: 'Regístrate gratis' },
  'nav.firms':       { en: 'For law firms',                      es: 'Para bufetes' },
  'nav.workers':     { en: 'For workers',                        es: 'Para trabajadores' },
  // Homepage hero (default / firm-geared front door)
  'home.badge':      { en: 'For California employment firms · Free pilot',
                       es: 'Para bufetes de derecho laboral de California · Prueba gratis' },
  'home.h1_1':       { en: 'Open the file.',                     es: 'Abre el expediente.' },
  'home.h1_2':       { en: 'Decide in minutes.',                 es: 'Decide en minutos.' },
  'home.sub':        { en: 'Share one intake link with your clients. They self-serve through a guided intake, and a review-ready, source-linked record lands in your dashboard — so you decide fast instead of burning the first consult on triage.',
                       es: 'Comparte un enlace de admisión con tus clientes. Ellos completan una admisión guiada por su cuenta, y un expediente listo para revisar, con enlaces a la fuente, llega a tu panel — para que decidas rápido en vez de gastar la primera consulta organizando.' },
  // LEGAL-REVIEW: compliance line — have a bilingual read before real reliance.
  'home.trust':      { en: 'Organizes & reflects — never concludes. The attorney evaluates everything.',
                       es: 'Organiza y refleja — nunca concluye. El abogado evalúa todo.' },
  'home.partner':    { en: 'Your intake organization partner, shaped around your firm — no chatbot required, just the organized file.',
                       es: 'Tu socio de organización de admisiones, adaptado a tu firma — sin chatbot, solo el expediente organizado.' },
  'home.cta_pilot':  { en: 'Start free pilot',                   es: 'Comienza la prueba gratis' },
  'home.cta_worker': { en: "I'm a worker →",                     es: 'Soy trabajador →' },
  'home.hero_foot':  { en: 'Free 7-day pilot · No credit card · Built for California employment matters',
                       es: 'Prueba gratis de 7 días · Sin tarjeta de crédito · Hecho para asuntos laborales de California' },

  // Account approval hold screen
  'pending.badge':   { en: 'Application received',              es: 'Solicitud recibida' },
  'pending.title':   { en: "You're on the list.",              es: 'Estás en la lista.' },
  'pending.body':    { en: 'Thank you for signing up. Your account will be confirmed within 1–2 business days, and we’ll email you the moment it’s ready.',
                       es: 'Gracias por registrarte. Tu cuenta será confirmada en 1 a 2 días hábiles, y te enviaremos un correo en cuanto esté lista.' },
  'pending.sub':     { en: 'We’re welcoming new members in small groups during our California beta.',
                       es: 'Estamos dando la bienvenida a nuevos miembros en grupos pequeños durante nuestra beta de California.' },
  'pending.signout': { en: 'Sign out',                          es: 'Cerrar sesión' },

  // ── Sage homepage (SageMarketingPage) ──
  'home.eyebrow':    { en: 'For California employment firms',    es: 'Para bufetes de derecho laboral de California' },
  'home.belief':     { en: 'Every legal decision starts with the record.',
                       es: 'Toda decisión legal empieza con el expediente.' },
  'home.explain':    { en: 'The sorting that used to take hours — you now review in minutes. A worker uploads scattered employment records; one3seven organizes them into a review-ready, source-linked intake, so you begin with the record, not the paperwork.',
                       es: 'La organización que antes tomaba horas — ahora la revisas en minutos. Un trabajador sube documentos laborales dispersos; one3seven los organiza en una admisión lista para revisar, con enlaces a la fuente, para que empieces con el expediente, no con el papeleo.' },
  'home.ai_line':    { en: 'Let a different kind of AI handle the first half — no prompt, no magic words needed.',
                       es: 'Deja que un tipo distinto de IA haga la primera mitad — sin prompts, sin palabras mágicas.' },
  'home.sample':     { en: 'See a sample intake',                es: 'Ver una admisión de ejemplo' },
  'home.request':    { en: 'Request a pilot',                    es: 'Solicita una prueba' },
  'tl.header':       { en: 'Source-linked intake',               es: 'Admisión con enlaces a la fuente' },
  'tl.ai':           { en: 'AI · 0 conclusions',                 es: 'IA · 0 conclusiones' },
  'tl.e1':           { en: 'Concern raised with HR',             es: 'Queja presentada a RR. HH.' },
  'tl.e2':           { en: 'Written warning issued',             es: 'Advertencia escrita emitida' },
  'tl.e3':           { en: 'Employment terminated',              es: 'Empleo terminado' },
  // LEGAL-REVIEW: keep the verb discipline in both languages.
  'home.problem':    { en: 'Workers arrive with records scattered across phones, emails, and folders — no order, no timeline. Too often, attorneys spend the first consultation organizing records instead of evaluating them.',
                       es: 'Los trabajadores llegan con documentos dispersos entre teléfonos, correos y carpetas — sin orden, sin cronología. Con demasiada frecuencia, los abogados gastan la primera consulta organizando documentos en vez de evaluarlos.' },
  'home.problem_hl': { en: 'organizing records instead of evaluating them.',
                       es: 'organizando documentos en vez de evaluarlos.' },
  'step1.t':         { en: 'The worker uploads',                 es: 'El trabajador sube' },
  'step1.b':         { en: 'Pay stubs, HR emails, write-ups, texts — one upload, no forms to decode.',
                       es: 'Recibos de pago, correos de RR. HH., amonestaciones, mensajes — una sola carga, sin formularios que descifrar.' },
  'step2.t':         { en: 'one3seven organizes',                es: 'one3seven organiza' },
  'step2.b':         { en: 'A dated, source-linked timeline and grouped documents — it organizes and reflects, never concludes.',
                       es: 'Una cronología fechada y con enlaces a la fuente, y documentos agrupados — organiza y refleja, nunca concluye.' },
  'step3.t':         { en: 'You open and decide',                es: 'Tú abres y decides' },
  'step3.b':         { en: 'The intake is waiting in your dashboard. Evaluate the matter instead of assembling it.',
                       es: 'La admisión te espera en tu panel. Evalúa el asunto en vez de armarlo.' },
  'trust.eyebrow':   { en: 'What it does — and doesn’t',         es: 'Lo que hace — y lo que no' },
  'trust.h1':        { en: 'Organizes and reflects.',            es: 'Organiza y refleja.' },
  'trust.h2':        { en: 'Never concludes.',                   es: 'Nunca concluye.' },
  'trust.body':      { en: 'Every fact links to the source document it came from. one3seven doesn’t evaluate claims, score cases, or recommend anything. You verify, you decide — the legal judgment stays with your team.',
                       es: 'Cada dato enlaza al documento fuente del que proviene. one3seven no evalúa reclamos, no califica casos ni recomienda nada. Tú verificas, tú decides — el juicio legal queda con tu equipo.' },
  'trust.claude':    { en: 'Built on Anthropic’s Claude for record organization.',
                       es: 'Desarrollado con Claude de Anthropic para la organización de documentos.' },
  'trust.b1':        { en: 'Source-linked — every entry opens the exact document',
                       es: 'Con enlaces a la fuente — cada entrada abre el documento exacto' },
  'trust.b2':        { en: 'A dated timeline built from the records',
                       es: 'Una cronología fechada construida a partir de los documentos' },
  'trust.b3':        { en: 'Documents grouped: wage, HR, discipline, separation',
                       es: 'Documentos agrupados: salario, RR. HH., disciplina, separación' },
  'trust.b4':        { en: 'Time-sensitive dates surfaced for attorney review',
                       es: 'Fechas sensibles al tiempo destacadas para revisión del abogado' },
  'trust.b5':        { en: '0 legal conclusions — organization only',
                       es: '0 conclusiones legales — solo organización' },
  'pilot.h1':        { en: 'Open your next intake',              es: 'Abre tu próxima admisión' },
  'pilot.h2':        { en: 'already organized.',                 es: 'ya organizada.' },
  'pilot.body':      { en: 'We’re opening a small founding cohort of California employment firms — onboarded a few at a time, hands-on. Your pilot begins with your first real intake.',
                       es: 'Estamos abriendo un pequeño grupo fundador de bufetes laborales de California — incorporados de a pocos, con acompañamiento directo. Tu prueba comienza con tu primera admisión real.' },
  // ── Problem section (before → after visual) ──
  'prob.eyebrow':    { en: 'The problem',                         es: 'El problema' },
  'prob.head':       { en: 'The whole case is there — just buried in the pile.',
                       es: 'El caso completo está ahí — solo que enterrado en el montón.' },
  'prob.before':     { en: 'What lands on the desk',              es: 'Lo que llega al escritorio' },
  'prob.before_cap': { en: 'No order. No dates. No timeline.',    es: 'Sin orden. Sin fechas. Sin cronología.' },
  'prob.after':      { en: 'What you open in one3seven',          es: 'Lo que abres en one3seven' },
  'prob.after_cap':  { en: 'Organized, source-linked, ready to evaluate.',
                       es: 'Organizado, con enlaces a la fuente, listo para evaluar.' },
  'prob.arrow':      { en: 'one3seven organizes',                 es: 'one3seven organiza' },
  'prob.body':       { en: 'A worker’s story lives across pay stubs, texts, HR emails, and screenshots — with no order and no dates. Today, assembling it eats the first consultation: unbilled hours spent sorting before anyone can judge the matter, while filing deadlines quietly run. one3seven does the sorting — so you open a finished file instead of a shoebox.',
                       es: 'La historia de un trabajador vive entre recibos de pago, mensajes, correos de RR. HH. y capturas de pantalla — sin orden y sin fechas. Hoy, armarla se come la primera consulta: horas no facturables ordenando antes de poder evaluar el caso, mientras los plazos corren en silencio. one3seven hace ese trabajo — para que abras un expediente terminado en vez de una caja de zapatos.' },
  'prob.c1':         { en: 'Pay stub',                            es: 'Recibo de pago' },
  'prob.c2':         { en: 'Text from supervisor',               es: 'Mensaje del supervisor' },
  'prob.c3':         { en: 'HR complaint',                        es: 'Queja a RR. HH.' },
  'prob.c4':         { en: 'Screenshot',                          es: 'Captura de pantalla' },
  'prob.c5':         { en: 'Termination letter',                 es: 'Carta de despido' },
  'prob.c6':         { en: 'Doctor’s note',                  es: 'Nota médica' },

  // ── Economics band (money / time saved) ──
  'econ.eyebrow':    { en: 'The economics',                     es: 'La economía' },
  'econ.head':       { en: 'The most expensive hour in your week is the one you can’t bill.',
                       es: 'La hora más cara de tu semana es la que no puedes facturar.' },
  'econ.cost_label': { en: 'Today — the pile',                  es: 'Hoy — el montón' },
  'econ.cost':       { en: 'Every new matter lands as a pile someone has to sort through before anyone can weigh the merits, and not one of those hours is billable. All the while, the filing deadline keeps ticking down.',
                       es: 'Cada nuevo asunto llega como un montón que alguien debe ordenar antes de que se puedan sopesar los méritos, y ninguna de esas horas es facturable. Mientras tanto, el plazo de presentación sigue corriendo.' },
  'econ.file_label': { en: 'With one3seven — the file',         es: 'Con one3seven — el expediente' },
  'econ.file':       { en: 'Now the file is already organized the moment you open it. You spend your time reviewing the matter instead of assembling it, and the hours you’d have lost to sorting go straight back into billable work.',
                       es: 'Ahora el expediente ya está organizado en el momento en que lo abres. Dedicas tu tiempo a revisar el asunto en lugar de armarlo, y las horas que habrías perdido ordenando vuelven directo al trabajo facturable.' },
  'econ.payback':    { en: 'At your firm’s rate, the very first intake you don’t build by hand already covers a month of one3seven, and everything you organize after that is time you simply keep.',
                       es: 'A la tarifa de tu firma, la primera admisión que no armas a mano ya cubre un mes de one3seven, y todo lo que organizas después es tiempo que simplemente conservas.' },
  'econ.note':       { en: 'one3seven organizes records; it doesn’t evaluate claims or predict outcomes. The judgment stays with your team.',
                       es: 'one3seven organiza documentos; no evalúa reclamos ni predice resultados. El criterio permanece con tu equipo.' },

  // ── AI-trust band (source-linking / human touch) ──
  'ait.eyebrow':     { en: 'Why you can trust it',              es: 'Por qué puedes confiar' },
  'ait.head':        { en: 'AI makes mistakes, so we built around it.',
                       es: 'La IA comete errores, así que construimos en torno a eso.' },
  'ait.body':        { en: 'Because AI makes mistakes, everything one3seven organizes traces straight back to the document it came from, so confirming any fact is a glance rather than a hunt. Checking the work was always your job, and now it’s the easy part. one3seven doesn’t replace the human touch. It makes it a little more super-human.',
                       es: 'Como la IA comete errores, todo lo que one3seven organiza remite directamente al documento del que proviene, de modo que confirmar cualquier dato es un vistazo y no una búsqueda. Revisar el trabajo siempre fue tu labor, y ahora es la parte fácil. one3seven no reemplaza el toque humano. Lo hace un poco más sobrehumano.' },
  'ait.chip':        { en: 'opens the exact page',              es: 'abre la página exacta' },

  // ── Source-linked extraction card (hero right) ──
  'ext.header':      { en: 'Source-linked facts',               es: 'Datos con enlace a la fuente' },
  'ext.from_hr':     { en: 'From the HR complaint',             es: 'De la queja a RR. HH.' },
  'ext.from_term':   { en: 'From the termination letter',       es: 'De la carta de despido' },
  'ext.view':        { en: 'view source',                       es: 'ver fuente' },
  'ext.foot':        { en: 'Every fact links to its exact page — nothing to trust blindly.',
                       es: 'Cada dato enlaza a su página exacta — nada que creer a ciegas.' },

  // LEGAL-REVIEW: footer disclaimer — bilingual read recommended.
  'foot.disc':       { en: 'one3seven organizes records — attorneys independently evaluate them. It is not a law firm, does not provide legal advice, and is not a lawyer referral service; it does not recommend, rank, or select attorneys for workers. Built on Anthropic’s Claude for record organization.',
                       es: 'one3seven organiza documentos — los abogados los evalúan de forma independiente. No es un bufete de abogados, no brinda asesoría legal y no es un servicio de referencia de abogados; no recomienda, clasifica ni selecciona abogados para los trabajadores. Desarrollado con Claude de Anthropic para la organización de documentos.' },
  'foot.terms':      { en: 'Terms', es: 'Términos' },
  'foot.privacy':    { en: 'Privacy', es: 'Privacidad' },
  'foot.choices':    { en: 'Your Privacy Choices', es: 'Sus opciones de privacidad' },
  'foot.contact':    { en: 'Contact', es: 'Contacto' },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const LanguageContext = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { const s = localStorage.getItem('o3s_lang'); if (s === 'es' || s === 'en') return s; } catch { /* ignore */ }
    return 'en';
  });
  const setLang = (l: Lang) => { try { localStorage.setItem('o3s_lang', l); } catch { /* ignore */ } setLangState(l); };
  useEffect(() => { try { document.documentElement.lang = lang; } catch { /* ignore */ } }, [lang]);
  const t = (key: string) => STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key;
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);

/** EN | ES toggle — always shows both so the worker is never unsure which is active. */
export function LangToggle({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { lang, setLang } = useLang();
  const base = tone === 'dark'
    ? 'border-white/15 bg-white/5'
    : 'border-[#D3DED6] bg-white';
  const activeCls = 'bg-[#42574E] text-white';
  const idleCls = tone === 'dark' ? 'text-white/55' : 'text-[#2c332e]/55';
  return (
    <div className={`inline-flex items-center rounded-full border ${base} p-0.5 text-[12px] font-bold`} role="group" aria-label="Language">
      {(['en', 'es'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2.5 py-1 transition ${lang === l ? activeCls : idleCls}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
