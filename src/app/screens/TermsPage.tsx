import { LegalDocPage } from '../components/LegalDocPage';
import { TERMS_OF_SERVICE } from '../constants/legalContent';

export function TermsPage() {
  return <LegalDocPage doc={TERMS_OF_SERVICE} />;
}
