import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, FileText, X } from 'lucide-react';
import { Screen } from '../App';

interface FilePreviewScreenProps {
  onNavigate: (screen: Screen) => void;
  fileName: string;
  category: string;
  timelineEvent: string;
}

export function FilePreviewScreen({
  onNavigate,
  fileName,
  category,
  timelineEvent,
}: FilePreviewScreenProps) {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="px-6 py-7">
          <button
            onClick={() => onNavigate('landing')}
            className="text-xl font-semibold text-slate-900 hover:opacity-70 transition-opacity duration-200"
          >
            one3Seven
          </button>
        </div>
      </nav>

      {/* Back Navigation */}
      <div className="px-6 pt-6">
        <button
          onClick={() => onNavigate('summary')}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 hover:text-slate-700 transition-colors duration-200 font-normal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to summary
        </button>
      </div>

      {/* Content */}
      <div className="px-6 pt-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <h1 className="text-[32px] leading-[1.2] font-semibold text-slate-900 mb-4 tracking-tight">
            Document Preview
          </h1>
          <p className="text-base text-slate-600 mb-10 leading-relaxed">
            Reviewing uploaded document assignment.
          </p>

          {/* File Info Card */}
          <div className="mb-8 bg-slate-50 rounded-[14px] p-6 border border-slate-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 mb-2 break-words">{fileName}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-block bg-slate-200 px-2.5 py-1 rounded text-xs text-slate-700">
                    {category}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-900 mb-2">Related summary context</div>
              <div className="text-xs text-slate-700 leading-relaxed">{timelineEvent}</div>
            </div>
          </div>

          {/* File Preview Area */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-[18px] p-8 border border-slate-200 mb-8">
            <div className="bg-white rounded-lg p-12 shadow-sm border border-slate-200 min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-600 mb-2">Document Preview</p>
                <p className="text-xs text-slate-500">{fileName}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => onNavigate('summary')}
              className="w-full bg-slate-900 text-white py-4 px-6 rounded-[14px] hover:bg-slate-800 transition-all shadow-sm hover:shadow-md font-medium"
            >
              Return to intake summary
            </button>
            <button className="w-full bg-slate-100 text-slate-900 py-4 px-6 rounded-[14px] hover:bg-slate-200 transition-colors font-medium">
              Download Document
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

