export type UploadedFileMeta = {
  fileName: string;
  category: string;
  uploadedFileId?: string;
};

/** Stable key for upload session maps (labels, removals). */
export function uploadedFileKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function truncateFileLabel(name: string, maxChars = 24): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1))}.`;
}