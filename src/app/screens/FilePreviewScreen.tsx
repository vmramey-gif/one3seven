import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, FileText } from 'lucide-react';
import { WordMark } from '../components/WordMark';
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
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F3EF]">
      {/* Top Navigation */}
      <nav className="sticky top-0 bg-[#F1F3EF]/80 backdrop-blur-md border-b border-[#D3DED6] z-50">
        <div className="px-6 py-7">
          <button
            onClick={() => onNavigate('landing')}
            className="text-xl font-semibold text-[#42574e] hover:opacity-70 transition-opacity duration-200"
          >
            <WordMark />
          </button>
        </div>
      </nav>

      {/* Back Navigation */}
      <div className="px-6 pt-6">
        <button
          onClick={() => onNavigate('summary')}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#6A6D66] hover:text-[#40433F] transition-colors duration-200 font-normal"
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
          <h1 className="text-[32px] leading-[1.2] font-semibold text-[#1B2623] mb-4 tracking-tight">
            Document Preview
          </h1>
          <p className="text-base text-[#40433F] mb-10 leading-relaxed">
            Reviewing uploaded document assignment.
          </p>

          {/* File Info Card */}
          <div className="mb-8 bg-white rounded-[14px] p-6 border border-[#D3DED6]">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-[#42574e] rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1B2623] mb-2 break-words">{fileName}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-block bg-[#E7EDE8] px-2.5 py-1 rounded text-xs text-[#42574e] font-medium">
                    {category}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#D3DED6]">
              <div className="text-xs font-semibold text-[#1B2623] mb-2">Related summary context</div>
              <div className="text-xs text-[#40433F] leading-relaxed">{timelineEvent}</div>
            </div>
          </div>

          {/* File Preview Area */}
          <div className="bg-gradient-to-br from-[#F1F3EF] to-[#E7EDE8] rounded-[18px] p-8 border border-[#D3DED6] mb-8">
            <div className="bg-white rounded-lg p-12 shadow-[0_2px_8px_rgba(24,31,67,0.06)] border border-[#D3DED6] min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-[#95AB9B] mx-auto mb-4" />
                <p className="text-sm text-[#40433F] mb-2">Document Preview</p>
                <p className="text-xs text-[#6A6D66]">{fileName}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => onNavigate('summary')}
              className="w-full bg-[#42574e] text-white py-4 px-6 rounded-[14px] hover:bg-[#4F5F47] transition-all shadow-[0_10px_22px_rgba(66,87,78,0.18)] font-medium"
            >
              Return to intake summary
            </button>
            <button className="w-full bg-[#E7EDE8] text-[#42574e] py-4 px-6 rounded-[14px] hover:bg-[#D3DED6] transition-colors font-medium">
              Download Document
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
