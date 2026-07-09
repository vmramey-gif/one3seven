import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { WordMark } from '../components/WordMark';
import { Screen } from '../App';

export type WorkerDetailsPayload = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
};

interface WorkerDetailsScreenProps {
  onNavigate: (screen: Screen) => void;
  onComplete: (details: WorkerDetailsPayload) => Promise<{ error?: string }>;
  /** Pre-filled values loaded from Supabase (profiles table). */
  initialDetails?: Partial<WorkerDetailsPayload> | null;
}

export function WorkerDetailsScreen({ onNavigate, onComplete, initialDetails }: WorkerDetailsScreenProps) {
  const [firstName, setFirstName] = useState(initialDetails?.firstName ?? '');
  const [middleInitial, setMiddleInitial] = useState(initialDetails?.middleInitial ?? '');
  const [lastName, setLastName] = useState(initialDetails?.lastName ?? '');
  const [phone, setPhone] = useState(initialDetails?.phone ?? '');
  const [addressLine1, setAddressLine1] = useState(initialDetails?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(initialDetails?.addressLine2 ?? '');
  const [city, setCity] = useState(initialDetails?.city ?? '');
  const [state, setState] = useState(initialDetails?.state ?? '');
  const [zip, setZip] = useState(initialDetails?.zip ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setError('Address line 1, city, state, and ZIP are required.');
      return;
    }
    setSubmitting(true);
    const res = await onComplete({
      firstName: firstName.trim(),
      middleInitial: middleInitial.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
    });
    setSubmitting(false);
    if (res.error) setError(res.error);
  };

  const inputCls = 'w-full px-4 py-3 bg-[#f8f6ff] border border-[#e5def8] rounded-[14px] text-sm text-[#111b3d] placeholder:text-[#66708f] focus:border-[#42574e] focus:outline-none focus:ring-2 focus:ring-[#c7b9ff]';

  return (
    <div className="min-h-screen bg-[#f8f6ff]">
      <div className="px-6 pt-6">
        <button
          type="button"
          onClick={() => onNavigate('authWelcome')}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#66708f] hover:text-[#39415f]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      <div className="px-6 pt-8 pb-16 max-w-[420px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-semibold text-[#1E1B4B] mb-1"><WordMark /></h1>
          <h2 className="text-lg font-semibold text-[#111b3d] mb-2">Your details</h2>
          <p className="text-sm text-[#39415f] mb-6">
            Add your name and contact information so we can reach you about your intake when needed.
          </p>

          {error ? (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-[14px] text-sm">
              {error}
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#111b3d] mb-1 block">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} autoComplete="given-name" required />
            </div>
            <div>
              <label className="text-sm font-medium text-[#111b3d] mb-1 block">Middle initial (optional)</label>
              <input value={middleInitial} onChange={(e) => setMiddleInitial(e.target.value.slice(0, 3))} className={`${inputCls} max-w-[120px]`} autoComplete="additional-name" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#111b3d] mb-1 block">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} autoComplete="family-name" required />
            </div>
            <div>
              <label className="text-sm font-medium text-[#111b3d] mb-1 block">Phone number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className={inputCls} autoComplete="tel" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#111b3d] mb-1 block">Address line 1</label>
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputCls} autoComplete="street-address" required />
            </div>
            <div>
              <label className="text-sm font-medium text-[#111b3d] mb-1 block">Address line 2 (optional)</label>
              <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium text-[#111b3d] mb-1 block">City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} autoComplete="address-level2" required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-medium text-[#111b3d] mb-1 block">State</label>
                <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} autoComplete="address-level1" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#111b3d] mb-1 block">ZIP code</label>
              <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls} autoComplete="postal-code" required />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 bg-[#42574e] text-white py-4 px-6 rounded-[14px] hover:bg-[#5b39e6] font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              Continue to dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
