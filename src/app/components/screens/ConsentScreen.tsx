import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, FileCheck, User, Info } from 'lucide-react';
import { Screen } from '../../App';

interface ConsentScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function ConsentScreen({ onNavigate }: ConsentScreenProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 border-b border-slate-100">
        <div className="text-xl font-medium text-slate-900">one3Seven</div>
      </header>

      {/* Content */}
      <div className="px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-medium text-slate-900 mb-3">
            Before You Upload
          </h1>
          <p className="text-base text-slate-600 mb-8">
            A few important things to review before getting started.
          </p>

          <div className="space-y-4">
            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="bg-slate-50 rounded-xl p-6 border border-slate-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-slate-200">
                  <FileCheck className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">What one3Seven Does</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    one3Seven helps organize records, timelines, and intake materials into a cleaner structure. It does not provide legal advice or determine whether someone has a legal claim.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="bg-slate-50 rounded-xl p-6 border border-slate-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-slate-200">
                  <Shield className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">Your Privacy</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Uploaded records are processed only for document organization and intake workflow preparation.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="bg-slate-50 rounded-xl p-6 border border-slate-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-slate-200">
                  <User className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">You Stay In Control</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    You choose what gets uploaded, saved, or shared during the intake process.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Card 4 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-slate-50 rounded-xl p-6 border border-slate-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-slate-200">
                  <Info className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">About Uploaded Information</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    one3Seven organizes the information provided but does not independently verify uploaded records for accuracy or completeness.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Checkbox */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 mb-6"
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-sm text-slate-700">
                I understand that one3Seven is a document organization and intake preparation platform.
              </span>
            </label>
          </motion.div>

          {/* Continue Button */}
          <button
            onClick={() => onNavigate('upload')}
            disabled={!agreed}
            className={`w-full py-3.5 px-6 rounded-xl transition-colors ${
              agreed
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </motion.div>
      </div>
    </div>
  );
}

