import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, Layers, FileCheck, CheckCircle2 } from 'lucide-react';
import { Screen } from '../App';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';
import { WordMark } from '../components/WordMark';

interface HowItWorksScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function HowItWorksScreen({ onNavigate }: HowItWorksScreenProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const steps = [
    {
      number: '1',
      icon: Upload,
      title: 'Upload your supporting records',
      examples: [
        'Letters and notices',
        'Financial or billing records',
        'Messages and communications',
        'Photos or incident notes',
        'Agreements and forms',
      ],
    },
    {
      number: '2',
      icon: Layers,
      title: 'AI organizes timelines and supporting records',
      description:
        'Documents are categorized, grouped by timeline activity, and organized into a structured chronology.',
    },
    {
      number: '3',
      icon: FileCheck,
      title: 'Generate organized summaries',
      description:
        'Review organized timelines, document categories, and review-ready packets.',
    },
  ];

  const documentTypes = [
    'Pay stubs and wage records (employment)',
    'Lease notices and repair photos (housing)',
    'Medical bills and insurance letters (injury)',
    'Court filings and custody schedules (family)',
    'Immigration notices and receipts',
    'Contracts, invoices, and demand letters (business)',
    'Police reports and court paperwork (criminal)',
    'Screenshots, emails, and message threads',
    'Other records that support your situation',
  ];

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
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#6A6D66] hover:text-[#40433F] transition-colors duration-200 font-normal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="px-6 pt-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-[32px] leading-[1.2] font-semibold text-[#1B2623] mb-4 tracking-tight">
            How It Works
          </h1>
          <p className="text-base text-[#40433F] mb-12 leading-relaxed">
            A calm path from scattered records to a clearer, structured summary you can review and share.
          </p>

          {/* Workflow Steps */}
          <div className="space-y-8 mb-16">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="relative"
              >
                {index < steps.length - 1 && (
                  <div className="absolute left-[22px] top-[60px] w-0.5 h-16 bg-[#D3DED6]" />
                )}

                <div className="flex items-start gap-5">
                  <div className="w-11 h-11 bg-[#42574e] rounded-full flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-5 h-5 text-white" />
                  </div>

                  <div className="flex-1 pt-1">
                    <div className="text-xs text-[#6A6D66] uppercase tracking-wide mb-2">
                      Step {step.number}
                    </div>
                    <h3 className="text-[17px] font-semibold text-[#1B2623] mb-3 leading-snug">
                      {step.title}
                    </h3>

                    {step.examples && (
                      <div className="space-y-2">
                        {step.examples.map((example, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-[#40433F]">
                            <div className="w-1 h-1 bg-[#95AB9B] rounded-full flex-shrink-0" />
                            <span>{example}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {step.description && (
                      <p className="text-sm text-[#40433F] leading-relaxed">{step.description}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Accepted Document Types */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-16"
          >
            <h2 className="text-lg font-semibold text-[#1B2623] mb-6">Accepted Document Types</h2>
            <div className="bg-white rounded-[16px] p-6 border border-[#D3DED6]">
              <div className="space-y-3">
                {documentTypes.map((type, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#42574e] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[#40433F] leading-relaxed">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mb-12"
          >
            <button
              onClick={() => onNavigate('upload')}
              className="w-full bg-[#42574e] text-white py-4 px-6 rounded-[14px] hover:bg-[#4F5F47] transition-all shadow-[0_10px_22px_rgba(66,87,78,0.18)] font-medium"
            >
              Start Organizing
            </button>
          </motion.div>

          {/* Footer Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <One3SevenDisclaimer variant="full" className="text-[#40433F] bg-white rounded-[16px] p-6 border border-[#D3DED6]" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
