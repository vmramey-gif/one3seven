import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../App';

interface DevNavMapScreenProps {
  onNavigate: (screen: Screen) => void;
}

const DEV_SCREENS: { id: Screen; label: string }[] = [
  { id: 'authWelcome', label: 'Auth Welcome' },
  { id: 'signIn', label: 'Sign In' },
  { id: 'createAccount', label: 'Create Account' },
  { id: 'workerDetails', label: 'Worker details (onboarding)' },
  { id: 'landing', label: 'Worker Dashboard (landing)' },
  { id: 'upload', label: 'Upload' },
  { id: 'processing', label: 'Processing' },
  { id: 'summary', label: 'Intake Summary' },
  { id: 'filePreview', label: 'File Preview (needs selected file)' },
  { id: 'howItWorks', label: 'How It Works' },
  { id: 'workerSettings', label: 'Worker Settings' },
  { id: 'firmDashboard', label: 'Law Firm Dashboard' },
  { id: 'intakeReview', label: 'Intake Review (needs selected intake)' },
  { id: 'firmSettings', label: 'Firm Settings' },
  { id: 'gallery', label: 'Gallery (mock embeds)' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'devNavMap', label: 'Dev map (this screen)' },
];

/**
 * Internal dev-only screen map. Shown only when SHOW_DEV_GALLERY is true (see flags.ts).
 */
export function DevNavMapScreen({ onNavigate }: DevNavMapScreenProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => onNavigate('authWelcome')}
          className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Close map (Auth Welcome)
        </button>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-semibold mb-2">Dev: screen map</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            For internal navigation testing only. Not shown in production when{' '}
            <span className="font-mono text-slate-300">VITE_SHOW_DEV_GALLERY</span> is unset.
          </p>
          <ul className="space-y-2">
            {DEV_SCREENS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(s.id)}
                  className="w-full text-left text-sm px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700"
                >
                  {s.label}
                  <span className="block text-xs text-slate-500 font-mono mt-0.5">{s.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
