import { useState } from 'react';
import { motion } from 'motion/react';
import { WordMark } from '../components/WordMark';
import { AuthWelcomeScreen } from './AuthWelcomeScreen';
import { SignInScreen } from './SignInScreen';
import { CreateAccountScreen } from './CreateAccountScreen';
import { RoleSelectionScreen } from './RoleSelectionScreen';
import { WorkerDetailsScreen } from './WorkerDetailsScreen';
import { LandingScreen } from './LandingScreen';
import { LawFirmDashboardScreen } from './LawFirmDashboardScreen';
import { IntakeReviewScreen } from './IntakeReviewScreen';
import { FirmSettingsScreen } from './FirmSettingsScreen';
import { Screen } from '../App';

interface GalleryScreenProps {
  onNavigate: (screen: Screen) => void;
  submittedIntakes: any[];
}

export function GalleryScreen({ onNavigate, submittedIntakes }: GalleryScreenProps) {
  const [focusedScreen, setFocusedScreen] = useState<string | null>(null);

  const screens = [
    { id: 'authWelcome', name: 'Auth Welcome', category: 'Auth' },
    { id: 'signIn', name: 'Sign In', category: 'Auth' },
    { id: 'createAccount', name: 'Create Account', category: 'Auth' },
    { id: 'roleSelection', name: 'Role Selection', category: 'Auth' },
    { id: 'workerDetails', name: 'Worker Details', category: 'Auth' },
    { id: 'landing', name: 'Landing Page', category: 'Worker' },
    { id: 'firmDashboard', name: 'Firm Dashboard', category: 'Firm' },
    { id: 'intakeReview', name: 'Intake Review', category: 'Firm' },
    { id: 'firmSettings', name: 'Firm Settings', category: 'Firm' },
  ];

  const handleScreenClick = (screenId: string) => {
    setFocusedScreen(screenId === focusedScreen ? null : screenId);
  };

  const handleScreenDoubleClick = (screenId: string) => {
    onNavigate(screenId as Screen);
  };

  const renderScreen = (screenId: string) => {
    const dummyNavigate = () => {};
    const dummySignIn = async () => ({});
    const dummyCreateAccount = async () => ({});
    const dummyWorkerDetailsComplete = async () => ({});
    const dummySelectRole = () => {};
    const dummySelectIntake = () => {};
    const noopUpdate = () => {};

    switch (screenId) {
      case 'authWelcome':
        return <AuthWelcomeScreen onNavigate={dummyNavigate} />;
      case 'signIn':
        return <SignInScreen onNavigate={dummyNavigate} onSignIn={dummySignIn} />;
      case 'createAccount':
        return <CreateAccountScreen onNavigate={dummyNavigate} onCreateAccount={dummyCreateAccount} />;
      case 'roleSelection':
        return <RoleSelectionScreen onNavigate={dummyNavigate} onSelectRole={dummySelectRole} />;
      case 'workerDetails':
        return <WorkerDetailsScreen onNavigate={dummyNavigate} onComplete={dummyWorkerDetailsComplete} />;
      case 'landing':
        return <LandingScreen onNavigate={dummyNavigate} />;
      case 'firmDashboard':
        return (
          <LawFirmDashboardScreen
            onNavigate={dummyNavigate}
            onSelectIntake={dummySelectIntake}
            submittedIntakes={submittedIntakes}
            onViewSampleIntakeFlow={() => {}}
            firmBellNotifications={[]}
          />
        );
      case 'intakeReview':
        return <IntakeReviewScreen onNavigate={dummyNavigate} intakeId="1" onUpdateWorkspace={noopUpdate} />;
      case 'firmSettings':
        return <FirmSettingsScreen onNavigate={dummyNavigate} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* Header */}
      <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4">
        <h1 className="text-xl font-semibold text-slate-900 mb-2"><WordMark /> Gallery</h1>
        <p className="text-sm text-slate-600 mb-3">Click to focus, double-click to enter full screen</p>
        <div className="flex gap-2">
          <button
            onClick={() => setFocusedScreen(null)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Show All
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {screens.map((screen) => (
          <motion.div
            key={screen.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${
              focusedScreen === screen.id
                ? 'border-slate-900 shadow-2xl'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Card Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{screen.name}</h3>
                  <p className="text-xs text-slate-500">{screen.category}</p>
                </div>
                <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-medium">
                  {screen.id}
                </span>
              </div>
            </div>

            {/* Screen Preview */}
            <div
              onClick={() => handleScreenClick(screen.id)}
              onDoubleClick={() => handleScreenDoubleClick(screen.id)}
              className="cursor-pointer"
              style={{ height: '600px', overflow: 'auto' }}
            >
              <div className="scale-[0.5] origin-top-left" style={{ width: '200%', height: '200%' }}>
                {renderScreen(screen.id)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
