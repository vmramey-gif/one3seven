import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, Layers, FileCheck, CheckCircle2 } from 'lucide-react';
import { Screen } from '../App';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';

interface HowItWorksScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function HowItWorksScreen({ onNavigate }: HowItWorksScreenProps) {
  // Scroll to top when component mounts
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
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 hover:text-slate-700 transition-colors duration-200 font-normal"
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
          <h1 className="text-[32px] leading-[1.2] font-semibold text-slate-900 mb-4 tracking-tight">
            How It Works
          </h1>
          <p className="text-base text-slate-600 mb-12 leading-relaxed">
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
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-[22px] top-[60px] w-0.5 h-16 bg-slate-200/60" />
                )}

                <div className="flex items-start gap-5">
                  {/* Step Icon */}
                  <div className="w-11 h-11 bg-slate-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 pt-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                      Step {step.number}
                    </div>
                    <h3 className="text-[17px] font-semibold text-slate-900 mb-3 leading-snug">
                      {step.title}
                    </h3>

                    {/* Examples */}
                    {step.examples && (
                      <div className="space-y-2">
                        {step.examples.map((example, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                            <div className="w-1 h-1 bg-slate-400 rounded-full flex-shrink-0" />
                            <span>{example}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {step.description && (
                      <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
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
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Accepted Document Types</h2>
            <div className="bg-slate-50 rounded-[16px] p-6 border border-slate-200">
              <div className="space-y-3">
                {documentTypes.map((type, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 leading-relaxed">{type}</span>
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
              className="w-full bg-slate-900 text-white py-4 px-6 rounded-[14px] hover:bg-slate-800 transition-all shadow-sm hover:shadow-md font-medium"
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
            <One3SevenDisclaimer variant="full" className="text-slate-700 bg-slate-50 rounded-[16px] p-6 border border-slate-200" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

