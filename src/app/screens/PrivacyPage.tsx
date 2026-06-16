import { WordMark } from '../components/WordMark';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f8f6ff] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[#6D4AFF] mb-3">
          <WordMark />
        </p>
        <h1 className="text-2xl font-semibold text-[#1E1B4B] mb-3">Privacy Policy</h1>
        <p className="text-sm text-[#66708f] leading-relaxed">
          Under legal review. Full privacy policy will be published here before wider launch.
        </p>
      </div>
    </div>
  );
}
