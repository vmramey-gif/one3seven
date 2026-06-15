import { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, FileText, Mail, Calendar, File, DollarSign, Shield } from 'lucide-react';
import { Screen } from '../../App';

interface UploadScreenProps {
  onNavigate: (screen: Screen) => void;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
}

export function UploadScreen({ onNavigate, uploadedFiles, setUploadedFiles }: UploadScreenProps) {
  const [context, setContext] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles([...uploadedFiles, ...Array.from(e.target.files)]);
    }
  };

  const categorizeFiles = () => {
    const categories: Record<string, number> = {
      'pay records': 0,
      'workplace communications': 0,
      'HR documents': 0,
      'employment letters': 0,
      'reimbursement documents': 0,
    };

    uploadedFiles.forEach((file) => {
      const name = file.name.toLowerCase();
      if (name.includes('pay') || name.includes('stub') || name.includes('salary')) {
        categories['pay records']++;
      } else if (name.includes('email') || name.includes('message') || name.includes('slack')) {
        categories['workplace communications']++;
      } else if (name.includes('hr') || name.includes('policy')) {
        categories['HR documents']++;
      } else if (name.includes('offer') || name.includes('termination') || name.includes('employment')) {
        categories['employment letters']++;
      } else if (name.includes('expense') || name.includes('reimburse')) {
        categories['reimbursement documents']++;
      } else {
        categories['HR documents']++;
      }
    });

    return categories;
  };

  const categories = categorizeFiles();

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
            Upload Employment-Related Documents
          </h1>
          <p className="text-base text-slate-600 mb-8">
            Start with the records you already have â€” one3Seven will help organize the rest.
          </p>

          {/* Upload Area */}
          <div className="mb-8">
            <label className="block">
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <div className="text-base font-medium text-slate-900 mb-2">
                  Drag files here
                </div>
                <div className="text-sm text-slate-500 mb-4">or</div>
                <div className="inline-block bg-slate-900 text-white px-6 py-2.5 rounded-lg text-sm">
                  Tap to Upload
                </div>
                <div className="mt-6 text-xs text-slate-500">
                  Accepted: PDF, PNG, JPG, JPEG, DOC, DOCX
                </div>
              </div>
            </label>
          </div>

          {/* Example Document Types */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-slate-900 mb-4">Example Document Types</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: DollarSign, label: 'Pay records' },
                { icon: Calendar, label: 'Time records' },
                { icon: Mail, label: 'Emails' },
                { icon: FileText, label: 'Workplace communications' },
                { icon: File, label: 'Offer letters' },
                { icon: FileText, label: 'End-of-employment letters' },
                { icon: Calendar, label: 'PTO records' },
                { icon: FileText, label: 'HR documents' },
                { icon: DollarSign, label: 'Reimbursement records' },
                { icon: FileText, label: 'Performance reviews' },
              ].map((doc, index) => (
                <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center gap-2">
                  <doc.icon className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <span className="text-xs text-slate-700">{doc.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              You do not need every document to continue.
            </p>
          </div>

          {/* Optional Notes */}
          <div className="mb-8">
            <label className="block mb-2 text-sm font-medium text-slate-900">
              Add Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="I worked remotely from California for an out-of-state company and want help organizing my records into a clearer timeline."
              className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Live Document Preview */}
          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-slate-50 rounded-xl p-6 border border-slate-200"
            >
              <div className="text-base font-medium text-slate-900 mb-4">
                {uploadedFiles.length} {uploadedFiles.length === 1 ? 'document' : 'documents'} uploaded
              </div>
              <div className="space-y-2">
                {Object.entries(categories).map(([category, count]) => {
                  if (count === 0) return null;
                  return (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <div className="w-1.5 h-1.5 bg-slate-600 rounded-full"></div>
                      <span>
                        {count} {category}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* CTAs */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => onNavigate('processing')}
              disabled={uploadedFiles.length === 0}
              className={`w-full py-3.5 px-6 rounded-xl transition-colors ${
                uploadedFiles.length > 0
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Begin Intake Organization
            </button>
            <button className="w-full bg-slate-100 text-slate-900 py-3.5 px-6 rounded-xl hover:bg-slate-200 transition-colors">
              Save and Continue Later
            </button>
          </div>

          {/* Trust Message */}
          <div className="flex items-center gap-2 justify-center">
            <Shield className="w-4 h-4 text-slate-400" />
            <p className="text-xs text-slate-500">
              Your uploaded records are securely processed for organization and intake preparation purposes.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

