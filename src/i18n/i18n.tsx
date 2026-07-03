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
    : 'border-[#E7E1FF] bg-white';
  const activeCls = 'bg-[#6D4AFF] text-white';
  const idleCls = tone === 'dark' ? 'text-white/55' : 'text-[#1E1B4B]/55';
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
