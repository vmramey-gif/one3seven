import { motion } from 'motion/react';
import { Download, Mail, Plus, Share2, Save, Folder, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { Screen } from '../../App';

interface SummaryScreenProps {
  onNavigate: (screen: Screen) => void;
  uploadedFiles: File[];
}

export function SummaryScreen({ onNavigate, uploadedFiles }: SummaryScreenProps) {
  const mockTimeline = [
    { date: 'January 15, 2025', event: 'Employment started', type: 'employment' },
    { date: 'February 1, 2025', event: 'First pay period documented', type: 'pay' },
    { date: 'March 10, 2025', event: 'PTO request submitted', type: 'communication' },
    { date: 'April 5, 2025', event: 'Performance review received', type: 'hr' },
    { date: 'May 1, 2025', event: 'Reimbursement request filed', type: 'reimbursement' },
  ];

  const mockCategories = [
    { name: 'Pay Records', count: 4, icon: Folder },
    { name: 'Time Records', count: 3, icon: Calendar },
    { name: 'Workplace Communications', count: 5, icon: Mail },
    { name: 'Employment Documents', count: 2, icon: Folder },
    { name: 'PTO Records', count: 1, icon: Calendar },
    { name: 'HR Documents', count: 2, icon: Folder },
  ];

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
            Your Intake Summary Is Ready
          </h1>
          <p className="text-base text-slate-600 mb-12">
            Your uploaded records have been organized into a clearer, easier-to-review structure.
          </p>

          {/* Section 1 - Intake Overview */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Intake Overview</h2>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Total Documents</div>
                  <div className="text-2xl font-medium text-slate-900">{uploadedFiles.length || 12}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Upload Date</div>
                  <div className="text-sm text-slate-900">May 12, 2026</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Organization Status</div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-slate-700" />
                    <span className="text-sm text-slate-900">Complete</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Timeline Completeness</div>
                  <div className="text-sm text-slate-900">Good</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 - Employment Timeline */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Employment Timeline</h2>
            <div className="space-y-3">
              {mockTimeline.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-lg p-4 border border-slate-200 flex items-start gap-4"
                >
                  <div className="w-2 h-2 bg-slate-700 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 mb-1">{item.date}</div>
                    <div className="text-sm font-medium text-slate-900">{item.event}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Section 3 - Document Categories */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Document Categories</h2>
            <div className="grid grid-cols-2 gap-3">
              {mockCategories.map((category, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-slate-50 rounded-lg p-4 border border-slate-200"
                >
                  <category.icon className="w-5 h-5 text-slate-600 mb-2" />
                  <div className="text-sm font-medium text-slate-900 mb-1">{category.name}</div>
                  <div className="text-xs text-slate-500">{category.count} {category.count === 1 ? 'file' : 'files'}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Section 4 - Organization Notes */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Organization Notes</h2>
            <div className="space-y-3">
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-amber-900">A few records may still be missing</div>
                  <div className="text-xs text-amber-700 mt-1">Additional records could improve organization clarity</div>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">There may be a small gap in the timeline</div>
              </div>
            </div>
          </div>

          {/* Next Step Buttons */}
          <div className="space-y-3 mb-8">
            <button className="w-full bg-slate-900 text-white py-3.5 px-6 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              Download Summary PDF
            </button>
            <button className="w-full bg-slate-100 text-slate-900 py-3.5 px-6 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              Add More Documents
            </button>
            <button className="w-full bg-slate-100 text-slate-900 py-3.5 px-6 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
              <Mail className="w-5 h-5" />
              Email Summary to Myself
            </button>
            <button className="w-full bg-slate-100 text-slate-900 py-3.5 px-6 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
              <Save className="w-5 h-5" />
              Save for Later
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full bg-slate-100 text-slate-900 py-3.5 px-6 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Share With Participating Firms
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Participating firms independently decide whether to review, request more information, contact, accept, archive, or decline intake submissions.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

