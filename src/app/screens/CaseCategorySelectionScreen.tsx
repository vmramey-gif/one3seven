import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  CALIFORNIA_BETA_CASE_CATEGORIES,
  type IntakeCaseCategory,
  UPLOAD_REDACTION_NOTICE,
} from '../constants/caseCategories';
import {
  INTAKE_CATEGORY_DISPLAY_ORDER,
  INTAKE_CATEGORY_PRIORITY_HINT,
  INTAKE_OPENING_MICROCOPY,
  INTAKE_OPENING_SHELL,
} from '../constants/intakeOpeningPresentation';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';

type CaseCategorySelectionScreenProps = {
  intakeNumber?: string | null;
  selectedCategory?: IntakeCaseCategory | null;
  onSelect: (category: IntakeCaseCategory) => void;
  onBackToLanding: () => void;
};

function orderCategoriesForDisplay() {
  const priority = INTAKE_CATEGORY_DISPLAY_ORDER.map((name) =>
    CALIFORNIA_BETA_CASE_CATEGORIES.find((c) => c.name === name)
  ).filter((c): c is (typeof CALIFORNIA_BETA_CASE_CATEGORIES)[number] => Boolean(c));
  const rest = CALIFORNIA_BETA_CASE_CATEGORIES.filter(
    (c) => !INTAKE_CATEGORY_DISPLAY_ORDER.includes(c.name)
  );
  return { priority, rest };
}

function CategoryCard({
  category,
  selected,
  onSelect,
  compact = false,
}: {
  category: (typeof CALIFORNIA_BETA_CASE_CATEGORIES)[number];
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const hint = INTAKE_CATEGORY_PRIORITY_HINT[category.name];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[14px] border text-left transition ${
        compact ? 'px-3.5 py-3' : 'px-4 py-4'
      } ${
        selected
          ? 'border-[#6d4aff] bg-[#6d4aff] text-white'
          : 'border-[#e5def8] bg-white text-[#111b3d] hover:border-[#d5c9f3]'
      } touch-manipulation`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className={`font-semibold ${compact ? 'text-sm' : 'text-sm'}`}>{category.name}</h2>
        <ArrowRight className={`h-4 w-4 shrink-0 ${selected ? 'text-white' : 'text-[#66708f]'}`} />
      </div>
      {hint && !compact ? (
        <p className={`mt-1 text-xs ${selected ? 'text-white/80' : 'text-[#66708f]'}`}>{hint}</p>
      ) : null}
      {!compact ? (
        <>
          <p className={`mt-2 text-sm leading-relaxed ${selected ? 'text-white/90' : 'text-[#39415f]'}`}>
            {category.description}
          </p>
          <p className={`mt-2 text-xs leading-relaxed ${selected ? 'text-white/80' : 'text-[#66708f]'}`}>
            Helpful records: {category.helpfulRecords.join(', ')}
          </p>
        </>
      ) : (
        <p className={`mt-1 text-sm leading-relaxed line-clamp-2 ${selected ? 'text-white/90' : 'text-[#39415f]'}`}>
          {category.description}
        </p>
      )}
    </button>
  );
}

export function CaseCategorySelectionScreen({
  intakeNumber,
  selectedCategory,
  onSelect,
  onBackToLanding,
}: CaseCategorySelectionScreenProps) {
  const { priority, rest } = orderCategoriesForDisplay();

  return (
    <div className="min-h-screen bg-[#f8f6ff]">
      <header className="border-b border-[#e5def8] bg-white px-6 py-4">
        <div className={INTAKE_OPENING_SHELL}>
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#39415f] hover:text-[#111b3d]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#66708f]">California beta</p>
          <h1 className="mt-1 text-xl font-semibold text-[#111b3d]">Choose intake category</h1>
          <p className="mt-2 text-sm text-[#39415f] leading-relaxed">
            {INTAKE_OPENING_MICROCOPY.beforeUpload}. {INTAKE_OPENING_MICROCOPY.shareWhatRelevant}
          </p>
          {intakeNumber ? (
            <p className="mt-2 text-xs text-[#66708f]">Intake {intakeNumber}</p>
          ) : null}
        </div>
      </header>

      <main className={`${INTAKE_OPENING_SHELL} px-6 py-8`}>
        <div className="mb-8 rounded-[14px] border border-[#e5def8] bg-white/90 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-[#39415f]">{UPLOAD_REDACTION_NOTICE}</p>
        </div>

        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#66708f] mb-3">Common categories</p>
          <div className="space-y-3">
            {priority.map((category) => (
              <CategoryCard
                key={category.name}
                category={category}
                selected={selectedCategory === category.name}
                onSelect={() => onSelect(category.name)}
              />
            ))}
          </div>
        </section>

        <div className="mb-6 border-t border-[#e5def8]" aria-hidden />

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#66708f] mb-3">More categories</p>
          <div className="space-y-2">
            {rest.map((category) => (
              <CategoryCard
                key={category.name}
                category={category}
                selected={selectedCategory === category.name}
                onSelect={() => onSelect(category.name)}
                compact
              />
            ))}
          </div>
        </section>

        <p className="mt-8 text-xs text-[#66708f] leading-relaxed text-center">
          {INTAKE_OPENING_MICROCOPY.editLater}
        </p>
        <One3SevenDisclaimer variant="compact" className="mt-6" />
      </main>
    </div>
  );
}
