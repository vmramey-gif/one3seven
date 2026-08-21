/**
 * Overlay modals + toast for IntakeReviewScreen's firm-side actions (decline, demo workflow
 * status, request additional documents, add a worker reminder). Extracted 2026-08-21 from
 * IntakeReviewScreen.tsx (architecture stabilization sprint, screen decomposition seam 1) --
 * pure move, no behavior change. Each modal is purely presentational: all state, submission
 * handlers, and validation stay owned by IntakeReviewScreen and are passed down as props.
 */
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import type { WorkflowStatus } from '../types/IntakeWorkspace';
import { FIRM_ADDITIONAL_DOCUMENT_CATEGORIES } from '../../services/intakeDataService';
import { polishHumanReadableDisplayText } from '../../services/firmIntakeDisplay';

export function DeclineConfirmModal({
  open,
  submitting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="decline-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] bg-black/40"
            onClick={() => !submitting && onCancel()}
          />
          <motion.div
            key="decline-confirm-dialog"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="fixed inset-x-4 bottom-6 z-[200] mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2"
          >
            <h3 className="text-base font-semibold text-[#1B2623] mb-2">
              Mark as not pursuing?
            </h3>
            <p className="text-sm text-[#1B2623]/65 leading-relaxed mb-6">
              This intake will stay in your review queue for reference. The worker won't be notified — this is an internal status only.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="flex-1 rounded-full border border-[#E4E5DE] py-3 text-sm font-medium text-[#6A6D66] transition-colors hover:bg-[#F2F4EC] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className="flex-1 rounded-full bg-[#42574E] py-3 text-sm font-medium text-white transition-colors hover:bg-[#42574E] disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ReviewToast({ show, message }: { show: boolean; message: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#42574E] text-white px-6 py-3 rounded-lg shadow-lg z-50 text-sm"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const DEMO_WORKFLOW_STATUSES: WorkflowStatus[] = [
  'new',
  'additional-docs',
  'ready-review',
  'under-review',
  'contacted',
  'archived',
  'not-pursuing',
];

export function DemoWorkflowStatusModal({
  open,
  workflowStatus,
  getStatusLabel,
  onSelectStatus,
  onClose,
}: {
  open: boolean;
  workflowStatus: WorkflowStatus;
  getStatusLabel: (status: WorkflowStatus) => string;
  onSelectStatus: (status: WorkflowStatus) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-[#1B2623] mb-2">Update demo workspace status</h3>
            <p className="text-xs text-[#7C857F] mb-4 leading-relaxed">
              For local demo layouts only. Live intakes use persisted workflow status from the database.
            </p>
            <div className="space-y-2 mb-6">
              {DEMO_WORKFLOW_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => onSelectStatus(status)}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors ${
                    workflowStatus === status
                      ? 'bg-[#42574E] text-white'
                      : 'bg-[#FAF9F6] text-[#384039] hover:bg-[#F2F4EC]'
                  }`}
                >
                  {getStatusLabel(status)}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-full bg-[#F2F4EC] text-[#1B2623] py-2.5 px-4 rounded-lg hover:bg-[#E4E5DE] transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RequestAdditionalDocumentsModal({
  open,
  error,
  selectedCategories,
  onToggleCategory,
  note,
  onNoteChange,
  submitting,
  canSubmit,
  onSubmit,
  onClose,
}: {
  open: boolean;
  error: string | null;
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-[#1B2623] mb-2">Request additional documents</h3>
            <p className="text-sm text-[#6A6D66] mb-4">
              Select the records your firm needs before continuing review.
            </p>
            {error ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            ) : null}
            <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
              {FIRM_ADDITIONAL_DOCUMENT_CATEGORIES.map((category) => (
                <label
                  key={category}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm cursor-pointer border transition-colors ${
                    selectedCategories.includes(category)
                      ? 'bg-[#42574E] text-white border-[#42574E]'
                      : 'bg-[#FAF9F6] text-[#384039] border-[#E4E5DE] hover:bg-[#F2F4EC]'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedCategories.includes(category)}
                    onChange={() => onToggleCategory(category)}
                    disabled={submitting}
                  />
                  <span
                    className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                      selectedCategories.includes(category) ? 'border-white bg-white' : 'border-[#CBD6CF] bg-white'
                    }`}
                  >
                    {selectedCategories.includes(category) ? (
                      <CheckCircle2 className="w-3 h-3 text-[#1B2623]" />
                    ) : null}
                  </span>
                  {polishHumanReadableDisplayText(category) || category}
                </label>
              ))}
            </div>
            <label className="text-sm font-medium text-[#1B2623] mb-1 block">Optional note</label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm h-24 resize-none text-[#1B2623]"
              placeholder="Add context for the record owner (optional)."
              disabled={submitting}
            />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="flex-1 bg-[#42574E] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 bg-[#F2F4EC] text-[#1B2623] py-2.5 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AddWorkerReminderModal({
  open,
  error,
  text,
  onTextChange,
  dueDate,
  onDueDateChange,
  submitting,
  canSubmit,
  onSubmit,
  onClose,
}: {
  open: boolean;
  error: string | null;
  text: string;
  onTextChange: (text: string) => void;
  dueDate: string;
  onDueDateChange: (dueDate: string) => void;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-[#1B2623] mb-2">Add a date for the worker</h3>
            <p className="text-sm text-[#6A6D66] mb-4">
              Shows up on their dashboard, tagged as from your firm. This is a plain logistics
              note — one3seven does not calculate legal deadlines, so set the date yourself.
            </p>
            {error ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            ) : null}
            <label className="text-sm font-medium text-[#1B2623] mb-1 block">What is this for?</label>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm h-20 resize-none text-[#1B2623]"
              placeholder="e.g. Deposition, examination appointment, records due back"
              disabled={submitting}
            />
            <label className="text-sm font-medium text-[#1B2623] mb-1 block">Date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm text-[#1B2623]"
              disabled={submitting}
            />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="flex-1 bg-[#42574E] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Adding…' : 'Add reminder'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 bg-[#F2F4EC] text-[#1B2623] py-2.5 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
