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
  'nav.workers':     { en: 'Wronged at work?',                   es: '¿Te trataron mal en el trabajo?' },
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

  // ── Worker landing page (WorkerLandingPage) ──
  'wl.forfirms':     { en: 'For firms',                          es: 'Para bufetes' },
  'wl.eyebrow':      { en: 'For California workers',             es: 'Para trabajadores de California' },
  'wl.h1a':          { en: 'Wronged at work?',                   es: '¿Te trataron mal en el trabajo?' },
  'wl.h1b':          { en: 'Get your records in order.',         es: 'Pon tus documentos en orden.' },
  'wl.belief':       { en: 'You were heard — not processed.',    es: 'Te escuchamos — no te procesamos.' },
  'wl.lede':         { en: 'Fired unfairly, shorted on pay, or pushed out? Before you talk to a lawyer, one3seven helps you tell your story and organize your scattered records — texts, pay stubs, emails, photos — into one clear, dated file you can bring to any attorney you choose. Free, private, and yours to keep.',
                       es: '¿Te despidieron injustamente, te pagaron de menos o te forzaron a renunciar? Antes de hablar con un abogado, one3seven te ayuda a contar tu historia y a organizar tus documentos dispersos —mensajes, recibos de pago, correos, fotos— en un expediente claro y fechado que puedes llevar al abogado que tú elijas. Gratis, privado y tuyo para siempre.' },
  'wl.cta':          { en: 'Start organizing — free',            es: 'Empieza a organizar — gratis' },
  'wl.howlink':      { en: 'See how it works',                   es: 'Mira cómo funciona' },
  'wl.chip.free':    { en: 'Free',                               es: 'Gratis' },
  'wl.chip.notified':{ en: 'Your employer isn’t notified',       es: 'Tu empleador no es notificado' },
  'wl.chip.keep':    { en: 'Yours to keep',                      es: 'Tuyo para siempre' },
  'wl.chip.choose':  { en: 'You choose who sees it',             es: 'Tú eliges quién lo ve' },
  'wl.sly.eyebrow':  { en: 'Worth sitting with',                 es: 'Vale la pena pensarlo' },
  'wl.sly.h':        { en: 'Does any of this sound like you?',   es: '¿Algo de esto te suena?' },
  'wl.sly.q1':       { en: 'Do you work remotely in California — for a company based in another state?',
                       es: '¿Trabajas de forma remota en California — para una empresa de otro estado?' },
  'wl.sly.q2':       { en: 'Do you use your own phone, internet, or car for the job?',
                       es: '¿Usas tu propio teléfono, internet o carro para el trabajo?' },
  'wl.sly.q3':       { en: 'Called “salaried,” but working long hours with no overtime?',
                       es: '¿Te dicen que eres “asalariado”, pero trabajas muchas horas sin pago de horas extra?' },
  'wl.sly.q4':       { en: 'Asked for your pay records or your file — and never got them?',
                       es: '¿Pediste tus registros de pago o tu expediente — y nunca te los dieron?' },
  'wl.sly.q5':       { en: 'Let go, or pushed out, soon after you spoke up or asked about pay?',
                       es: '¿Te despidieron o te forzaron a salir poco después de quejarte o preguntar por tu pago?' },
  'wl.sly.bridge1':  { en: 'If any of these feel familiar, it’s worth getting your records in order.',
                       es: 'Si algo de esto te suena, vale la pena poner tus documentos en orden.' },
  'wl.sly.bridge2':  { en: 'one3seven helps you do exactly that. Then an attorney can tell you what it means — you just have to show up ready.',
                       es: 'one3seven te ayuda a hacer justo eso. Después, un abogado puede decirte qué significa — tú solo tienes que llegar preparado.' },
  'wl.founder.eyebrow': { en: 'Why I built this',                es: 'Por qué lo creé' },
  'wl.founder.quote':{ en: 'I was a worker too. When things went wrong at my job, I had a pile of pay stubs, texts, and emails — and no idea what mattered or where to start. So I organized it all myself, until my story was clear enough to stand on its own. That’s when I stopped feeling powerless. I built one3seven so you don’t have to figure it out alone the way I did.',
                       es: 'Yo también fui trabajadora. Cuando las cosas salieron mal en mi empleo, tenía un montón de recibos de pago, mensajes y correos — y ninguna idea de qué importaba ni por dónde empezar. Así que lo organicé todo yo misma, hasta que mi historia fue lo bastante clara para sostenerse por sí sola. Ahí dejé de sentirme sin poder. Creé one3seven para que no tengas que resolverlo sola como yo lo hice.' },
  // First name only — the founder's surname is deliberately kept off public surfaces.
  'wl.founder.name': { en: 'Victoria',                           es: 'Victoria' },
  'wl.founder.title':{ en: 'Founder of one3seven — and a California worker who’s been where you are.',
                       es: 'Fundadora de one3seven — y una trabajadora de California que estuvo donde tú estás.' },
  'wl.how.eyebrow':  { en: 'How it works',                       es: 'Cómo funciona' },
  'wl.how.h2':       { en: 'Three steps. No legal jargon.',      es: 'Tres pasos. Sin jerga legal.' },
  'wl.how.sub':      { en: 'You don’t need to know if you “have a case.” You just need to get your story and your records in one place.',
                       es: 'No necesitas saber si “tienes un caso”. Solo necesitas reunir tu historia y tus documentos en un solo lugar.' },
  'wl.step1.t':      { en: 'Tell us what happened',              es: 'Cuéntanos qué pasó' },
  'wl.step1.b':      { en: 'In your own words — start wherever makes sense. We keep your account exactly as you tell it. No forms, no legal terms.',
                       es: 'En tus propias palabras — empieza por donde te resulte más fácil. Guardamos tu relato tal como lo cuentas. Sin formularios, sin términos legales.' },
  'wl.step2.t':      { en: 'Add what you have',                  es: 'Agrega lo que tengas' },
  'wl.step2.b':      { en: 'Upload the texts, pay stubs, emails, schedules, and photos you’ve saved. Don’t worry if it’s a mess — that’s the point.',
                       es: 'Sube los mensajes, recibos de pago, correos, horarios y fotos que hayas guardado. No te preocupes si es un desorden — de eso se trata.' },
  'wl.step3.t':      { en: 'Get an organized file',              es: 'Obtén un expediente organizado' },
  'wl.step3.b':      { en: 'one3seven builds a clear, dated timeline where every fact links back to your document — ready to bring to an attorney.',
                       es: 'one3seven crea una cronología clara y fechada donde cada dato enlaza a tu documento — listo para llevar a un abogado.' },
  // Hero illustration — shows organization only (no case narrative, no sequencing, no merit).
  'wl.hero.card.tag':    { en: 'Illustrative example',          es: 'Ejemplo ilustrativo' },
  'wl.hero.card.before': { en: 'What you have now',             es: 'Lo que tienes ahora' },
  'wl.hero.card.pain':   { en: 'Scattered across your phone, your email, a drawer somewhere. When it looks like this, details that matter get missed.',
                           es: 'Repartido entre tu teléfono, tu correo y algún cajón. Así, se pierden detalles que importan.' },
  'wl.hero.card.arrow':  { en: 'Organized by date',             es: 'Ordenado por fecha' },
  'wl.hero.card.after':  { en: 'What you get',                  es: 'Lo que recibes' },
  'wl.hero.g1':      { en: 'An organized, dated timeline — every item linked to its source, the way attorneys review a file.',
                       es: 'Una cronología organizada y fechada: cada elemento enlazado a su fuente, como los abogados revisan un expediente.' },
  'wl.hero.g2':      { en: 'Yours to send to any attorney you choose.',
                       es: 'Tuyo para enviarlo al abogado que tú elijas.' },
  'wl.hero.g3':      { en: 'So they can review all of your records — not just what you remembered to bring.',
                       es: 'Para que puedan revisar todos tus documentos, no solo lo que recordaste llevar.' },
  'wl.hero.g4':      { en: 'Free — you’re never charged to organize your own records.',
                       es: 'Gratis: nunca te cobramos por organizar tus propios documentos.' },
  'wl.hero.c1':      { en: 'A text message',                    es: 'Un mensaje de texto' },
  'wl.hero.c2':      { en: 'Pay stubs',                         es: 'Recibos de pago' },
  'wl.hero.c3':      { en: 'A photo of a schedule',             es: 'Una foto de un horario' },
  'wl.hero.c4':      { en: 'An email',                          es: 'Un correo' },
  'wl.ai.eyebrow':   { en: 'How the AI helps',                  es: 'Cómo ayuda la IA' },
  'wl.ai.h':         { en: 'A different kind of AI. It organizes — it never judges your case.',
                       es: 'Una IA diferente. Organiza — nunca juzga tu caso.' },
  'wl.ai.body':      { en: 'one3seven uses AI to read your records and line them up into a clear, dated timeline. It doesn’t decide anything about your situation, score your case, or take the place of a lawyer.',
                       es: 'one3seven usa IA para leer tus documentos y ordenarlos en una cronología clara y fechada. No decide nada sobre tu situación, no califica tu caso, ni reemplaza a un abogado.' },
  'wl.ai.trust':     { en: 'Because AI can make mistakes, every detail links back to the exact document it came from — so you, and any attorney you show it to, can check it in a glance.',
                       es: 'Como la IA puede equivocarse, cada dato enlaza al documento exacto de donde salió — para que tú, y cualquier abogado a quien se lo muestres, puedan verificarlo de un vistazo.' },
  'wl.ai.builton':   { en: 'Built on Anthropic’s Claude for record organization.',
                       es: 'Desarrollado con Claude de Anthropic para la organización de documentos.' },
  'wl.straight.eyebrow': { en: 'Straight with you',             es: 'Con franqueza' },
  'wl.straight.h':   { en: 'We organize your records. We don’t tell you whether you have a case.',
                       es: 'Organizamos tus documentos. No te decimos si tienes un caso.' },
  'wl.straight.body':{ en: 'An attorney decides that — that’s their job, not a tool’s. What one3seven does is make sure that when you walk into that conversation, you’re prepared, your story is intact, and nothing important got lost. You’ll be taken seriously because your record speaks for itself.',
                       es: 'Eso lo decide un abogado — es su trabajo, no el de una herramienta. Lo que one3seven hace es asegurarse de que, cuando entres a esa conversación, estés preparado, tu historia esté intacta y no se haya perdido nada importante. Te tomarán en serio porque tu expediente habla por sí solo.' },
  'wl.yours.eyebrow':{ en: 'Your record, your call',             es: 'Tu expediente, tu decisión' },
  'wl.yours.h2':     { en: 'It stays yours — start to finish.',  es: 'Sigue siendo tuyo — de principio a fin.' },
  'wl.yours1.t':     { en: 'You own it',                         es: 'Es tuyo' },
  'wl.yours1.b':     { en: 'Your documents and your words belong to you. one3seven organizes them — it never takes them over, and never sells your information.',
                       es: 'Tus documentos y tus palabras te pertenecen. one3seven los organiza — nunca se apropia de ellos y nunca vende tu información.' },
  'wl.yours2.t':     { en: 'You choose the attorney',            es: 'Tú eliges al abogado' },
  'wl.yours2.b':     { en: 'When you’re ready, you decide which attorney to share your organized file with. one3seven never picks a lawyer for you and is not a referral service.',
                       es: 'Cuando estés listo, tú decides con qué abogado compartir tu expediente organizado. one3seven nunca elige un abogado por ti y no es un servicio de referencia de abogados.' },
  'wl.yours3.t':     { en: 'You control sharing',               es: 'Tú controlas lo que se comparte' },
  'wl.yours3.b':     { en: 'Nothing goes to anyone until you choose to send it. Your employer is never notified, and you’re never locked to a single firm.',
                       es: 'Nada se envía a nadie hasta que tú decidas enviarlo. Tu empleador nunca es notificado, y nunca quedas atado a un solo bufete.' },
  'wl.yours4.t':     { en: 'You can delete it',                  es: 'Puedes borrarlo' },
  'wl.yours4.b':     { en: 'Change your mind? Request deletion at any time — it’s your account and your decision.',
                       es: '¿Cambiaste de opinión? Solicita eliminarlo en cualquier momento — es tu cuenta y tu decisión.' },
  'wl.final.h2':     { en: 'Get your story in order — free.',    es: 'Pon tu historia en orden — gratis.' },
  'wl.final.sub':    { en: 'It takes minutes to start, and you keep everything you build.',
                       es: 'Empezar toma unos minutos, y conservas todo lo que construyes.' },
  'wl.footer.disc':  { en: 'one3seven is not a law firm and does not provide legal advice. It is not a lawyer referral service and does not recommend, rank, or select attorneys for you. It organizes your records and preserves your account so you can prepare to speak with an attorney of your own choosing. Built on Anthropic’s Claude for record organization.',
                       es: 'one3seven no es un bufete de abogados y no brinda asesoría legal. No es un servicio de referencia de abogados y no recomienda, clasifica ni selecciona abogados para ti. Organiza tus documentos y preserva tu cuenta para que puedas prepararte para hablar con un abogado de tu propia elección. Desarrollado con Claude de Anthropic para la organización de documentos.' },

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
