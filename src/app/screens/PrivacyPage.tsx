import { LegalDocPage } from '../components/LegalDocPage';
import { PRIVACY_POLICY } from '../constants/legalContent';

export function PrivacyPage() {
  return <LegalDocPage doc={PRIVACY_POLICY} />;
}
