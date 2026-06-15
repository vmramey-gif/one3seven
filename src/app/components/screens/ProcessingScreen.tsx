import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Loader2, FileText, Folder, Calendar, Network } from 'lucide-react';
import { Screen } from '../../App';

interface ProcessingScreenProps {
  onNavigate: (screen: Screen) => void;
}

const steps = [
  'Documents uploaded',
  'Files categorized',
  'Timeline structure created',
  'Related records grouped together',
  'Reviewing document completeness',
  'Preparing intake summary',
];

const rotatingMessages = [
  'Organizing uploaded records',
  'Building timeline structure',
  'Grouping related documents',
  'Preparing summary',
  'Finalizing organization',
];

export function ProcessingScreen({ onNavigate }: ProcessingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [rotatingMessage, setRotatingMessage] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          setTimeout(() => onNavigate('summary'), 1500);
          return prev;
        }
      });
    }, 1500);

    const messageInterval = setInterval(() => {
      setRotatingMessage((prev) => (prev + 1) % rotatingMessages.length);
    }, 2000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(messageInterval);
    };
  }, [onNavigate]);

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
            Organizing Your Records
          </h1>
          <p className="text-base text-slate-600 mb-12">
            one3Seven is building your intake summary and organizing your uploaded records into a clearer structure.
          </p>

          {/* Visual Experience */}
          <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-8 mb-12 overflow-hidden border border-slate-200">
            {/* Background animated elements */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="w-32 h-32 border border-slate-200 rounded-full opacity-20"
              />
            </div>

            {/* Workflow visualization */}
            <div className="relative space-y-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                className="flex justify-center"
              >
                <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
                  <div className="flex gap-4 items-center">
                    <FileText className="w-8 h-8 text-slate-600" />
                    <div className="w-12 border-t-2 border-slate-300 border-dashed" />
                    <Folder className="w-8 h-8 text-slate-700" />
                    <div className="w-12 border-t-2 border-slate-300 border-dashed" />
                    <Calendar className="w-8 h-8 text-slate-800" />
                  </div>
                </div>
              </motion.div>

              <div className="flex justify-center">
                <Network className="w-6 h-6 text-slate-400" />
              </div>

              <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                className="text-center"
              >
                <div className="inline-block bg-slate-900 text-white px-6 py-3 rounded-lg text-sm font-medium">
                  {rotatingMessages[rotatingMessage]}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Live Status Updates */}
          <div className="space-y-4 mb-12">
            {steps.map((step, index) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.3 }}
                className="flex items-center gap-3"
              >
                {index < currentStep ? (
                  <CheckCircle2 className="w-5 h-5 text-slate-700 flex-shrink-0" />
                ) : index === currentStep ? (
                  <Loader2 className="w-5 h-5 text-slate-600 flex-shrink-0 animate-spin" />
                ) : (
                  <div className="w-5 h-5 border-2 border-slate-300 rounded-full flex-shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    index <= currentStep ? 'text-slate-900 font-medium' : 'text-slate-400'
                  }`}
                >
                  {step}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Bottom Messages */}
          <div className="space-y-4 text-center">
            <p className="text-xs text-slate-500">
              Your records are being securely processed for organization and intake preparation purposes only.
            </p>
            <p className="text-xs text-slate-400">
              one3Seven does not provide legal advice or determine legal outcomes.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

