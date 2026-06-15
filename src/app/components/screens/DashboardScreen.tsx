import { motion } from 'motion/react';
import { FileText, Calendar, Mail, DollarSign, User, Clock, MapPin } from 'lucide-react';
import { Screen } from '../../App';

interface DashboardScreenProps {
  onNavigate: (screen: Screen) => void;
}

const mockIntakes = [
  {
    id: 1,
    status: 'New Intake',
    uploadDate: 'May 12, 2026',
    workerLocation: 'California',
    employerState: 'New York',
    timelineCompleteness: 'Good',
    documentCount: 12,
    categories: ['Pay Records', 'Time Records', 'Workplace Communications'],
    organizationNote: 'A few records may still be missing',
  },
  {
    id: 2,
    status: 'Under Review',
    uploadDate: 'May 10, 2026',
    workerLocation: 'California',
    employerState: 'Texas',
    timelineCompleteness: 'Excellent',
    documentCount: 18,
    categories: ['Pay Records', 'Employment Status', 'HR Review'],
    organizationNote: 'Timeline is complete',
  },
  {
    id: 3,
    status: 'Additional Information Requested',
    uploadDate: 'May 8, 2026',
    workerLocation: 'California',
    employerState: 'Delaware',
    timelineCompleteness: 'Fair',
    documentCount: 8,
    categories: ['Time Records', 'Reimbursement Records'],
    organizationNote: 'There may be a small gap in the timeline',
  },
  {
    id: 4,
    status: 'Ready for Internal Review',
    uploadDate: 'May 5, 2026',
    workerLocation: 'California',
    employerState: 'California',
    timelineCompleteness: 'Good',
    documentCount: 15,
    categories: ['Pay Records', 'Workplace Communications', 'HR Review'],
    organizationNote: 'Additional records could improve organization clarity',
  },
];

const statusColors: Record<string, string> = {
  'New Intake': 'bg-blue-100 text-blue-800 border-blue-200',
  'Under Review': 'bg-purple-100 text-purple-800 border-purple-200',
  'Additional Information Requested': 'bg-amber-100 text-amber-800 border-amber-200',
  'Ready for Internal Review': 'bg-green-100 text-green-800 border-green-200',
  'Contacted': 'bg-slate-100 text-slate-800 border-slate-200',
  'Archived': 'bg-slate-100 text-slate-500 border-slate-200',
  'Declined': 'bg-red-100 text-red-800 border-red-200',
};

export function DashboardScreen({ onNavigate }: DashboardScreenProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="text-xl font-medium text-slate-900">one3Seven</div>
          <button
            onClick={() => onNavigate('landing')}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-medium text-slate-900 mb-3">
            Intake Dashboard
          </h1>
          <p className="text-base text-slate-600 mb-12">
            Review organized intake submissions, timelines, document categories, and workflow updates in one place.
          </p>

          {/* Dashboard Cards */}
          <div className="space-y-4 mb-12">
            {mockIntakes.map((intake, index) => (
              <motion.div
                key={intake.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
              >
                {/* Status Badge */}
                <div className="mb-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                      statusColors[intake.status]
                    }`}
                  >
                    {intake.status}
                  </span>
                </div>

                {/* Main Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Upload Date</div>
                      <div className="text-sm text-slate-900">{intake.uploadDate}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Documents</div>
                      <div className="text-sm text-slate-900">{intake.documentCount}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Worker Location</div>
                      <div className="text-sm text-slate-900">{intake.workerLocation}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Employer State</div>
                      <div className="text-sm text-slate-900">{intake.employerState}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Timeline</div>
                      <div className="text-sm text-slate-900">{intake.timelineCompleteness}</div>
                    </div>
                  </div>
                </div>

                {/* Category Tags */}
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">Document Categories</div>
                  <div className="flex flex-wrap gap-2">
                    {intake.categories.map((category, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Organization Note */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-600">{intake.organizationNote}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer Disclaimer */}
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <p className="text-xs text-slate-600 leading-relaxed">
              one3Seven provides workflow organization and intake preparation tools only. It does not provide legal advice, determine legal rights, recommend legal outcomes, or establish attorney-client relationships.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

