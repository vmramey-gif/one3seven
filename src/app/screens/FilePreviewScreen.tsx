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
    <div className="min-h-screen bg-[#f8f6ff]">
      {/* Top Navigation */}
      <nav className="sticky top-0 bg-[#f8f6ff]/80 backdrop-blur-md border-b border-[#e5def8] z-50">
        <div className="px-6 py-7">
          <button
            onClick={() => onNavigate('landing')}
            className="text-xl font-semibold text-[#6d4aff] hover:opacity-70 transition-opacity duration-200"
          >
            <WordMark />
          </button>
        </div>
      </nav>

      {/* Back Navigation */}
      <div className="px-6 pt-6">
        <button
          onClick={() => onNavigate('summary')}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#66708f] hover:text-[#39415f] transition-colors duration-200 font-normal"
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
          <h1 className="text-[32px] leading-[1.2] font-semibold text-[#111b3d] mb-4 tracking-tight">
            Document Preview
          </h1>
          <p className="text-base text-[#39415f] mb-10 leading-relaxed">
            Reviewing uploaded document assignment.
          </p>

          {/* File Info Card */}
          <div className="mb-8 bg-white rounded-[14px] p-6 border border-[#e5def8]">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-[#6d4aff] rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#111b3d] mb-2 break-words">{fileName}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-block bg-[#eee9ff] px-2.5 py-1 rounded text-xs text-[#6d4aff] font-medium">
                    {category}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#e5def8]">
              <div className="text-xs font-semibold text-[#111b3d] mb-2">Related summary context</div>
              <div className="text-xs text-[#39415f] leading-relaxed">{timelineEvent}</div>
            </div>
          </div>

          {/* File Preview Area */}
          <div className="bg-gradient-to-br from-[#f8f6ff] to-[#eee9ff] rounded-[18px] p-8 border border-[#e5def8] mb-8">
            <div className="bg-white rounded-lg p-12 shadow-[0_2px_8px_rgba(24,31,67,0.06)] border border-[#e5def8] min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-[#c7b9ff] mx-auto mb-4" />
                <p className="text-sm text-[#39415f] mb-2">Document Preview</p>
                <p className="text-xs text-[#66708f]">{fileName}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => onNavigate('summary')}
              className="w-full bg-[#6d4aff] text-white py-4 px-6 rounded-[14px] hover:bg-[#5b39e6] transition-all shadow-[0_10px_22px_rgba(109,74,255,0.18)] font-medium"
            >
              Return to intake summary
            </button>
            <button className="w-full bg-[#eee9ff] text-[#6d4aff] py-4 px-6 rounded-[14px] hover:bg-[#e5def8] transition-colors font-medium">
              Download Document
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
