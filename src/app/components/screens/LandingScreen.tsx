import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, FileText, Folder, Calendar } from 'lucide-react';
import { Screen } from '../../App';

interface LandingScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function LandingScreen({ onNavigate }: LandingScreenProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 border-b border-slate-100">
        <div className="text-xl font-medium text-slate-900">one3Seven</div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-12 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl font-medium text-slate-900 leading-tight mb-4">
            Organize your documents and build your own intake summary â€” before your next intake conversation.
          </h1>

          <p className="text-lg text-slate-600 mb-8">
            Stay ahead with one3Seven.
          </p>

          <div className="space-y-3 mb-12">
            <button
              onClick={() => onNavigate('consent')}
              className="w-full bg-slate-900 text-white py-3.5 px-6 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Start Organizing
            </button>
            <button className="w-full bg-slate-100 text-slate-900 py-3.5 px-6 rounded-xl hover:bg-slate-200 transition-colors">
              See How It Works
            </button>
          </div>

          {/* Workflow Visualization - Documents transforming into organized structure */}
          <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-8 overflow-hidden border border-slate-200">
            <div className="space-y-8">
              {/* Scattered documents */}
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 1, duration: 1 }}
                className="flex gap-2 flex-wrap justify-center"
              >
                <div className="bg-white p-3 rounded-lg shadow-sm rotate-3 border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm -rotate-2 border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm rotate-6 border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm -rotate-12 border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm rotate-1 border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
              </motion.div>

              {/* Arrow */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 0.5 }}
                className="flex justify-center"
              >
                <ArrowRight className="w-6 h-6 text-slate-400 rotate-90" />
              </motion.div>

              {/* Organized structure */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.5, duration: 0.8 }}
                className="space-y-3"
              >
                <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 flex items-center gap-3">
                  <Folder className="w-5 h-5 text-slate-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Pay Records</div>
                    <div className="text-xs text-slate-500">Organized</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Timeline</div>
                    <div className="text-xs text-slate-500">Structured</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Trust Section */}
      <section className="px-6 py-12 bg-slate-50">
        <div className="space-y-4 mb-12">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="font-medium text-slate-900 mb-4">For Workers</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">Keep employment-related records in one organized place</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">Build structured timelines automatically</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">Review categorized documents more clearly</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">Prepare cleaner intake materials for future conversations</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-900 rounded-xl p-6 text-white">
            <h3 className="font-medium mb-4">For Participating Firms</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-100">Receive more organized intake submissions</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-100">Reduce manual document sorting</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-100">Review structured timelines and categorized records</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-100">Improve intake workflow efficiency</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center leading-relaxed px-4">
          one3Seven is a workflow organization and intake preparation platform. It does not provide legal advice or determine legal outcomes.
        </p>
      </section>
    </div>
  );
}

