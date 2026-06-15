import { describe, expect, it } from 'vitest';
import { buildFileFingerprint, computeFileContentHash } from '../fileUploadIntegrity';

describe('fileUploadIntegrity', () => {
  it('builds a stable fingerprint from name, size, and hash', () => {
    expect(buildFileFingerprint('Paystub.pdf', 1200, 'abc123')).toBe('paystub.pdf|1200|abc123');
  });

  it('hashes identical file bytes to the same digest', async () => {
    const fileA = new File(['same-bytes'], 'a.pdf', { type: 'application/pdf' });
    const fileB = new File(['same-bytes'], 'b.pdf', { type: 'application/pdf' });
    const [hashA, hashB] = await Promise.all([computeFileContentHash(fileA), computeFileContentHash(fileB)]);
    expect(hashA).toBe(hashB);
  });

  it('hashes different file bytes to different digests', async () => {
    const fileA = new File(['alpha'], 'a.pdf', { type: 'application/pdf' });
    const fileB = new File(['beta'], 'b.pdf', { type: 'application/pdf' });
    const [hashA, hashB] = await Promise.all([computeFileContentHash(fileA), computeFileContentHash(fileB)]);
    expect(hashA).not.toBe(hashB);
  });
});
