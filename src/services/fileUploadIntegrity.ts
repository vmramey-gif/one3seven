/** SHA-256 hex digest of file bytes for duplicate detection. */
export async function computeFileContentHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function buildFileFingerprint(fileName: string, fileSize: number, contentHash: string): string {
  return `${fileName.trim().toLowerCase()}|${fileSize}|${contentHash}`;
}
