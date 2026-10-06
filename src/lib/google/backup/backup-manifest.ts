import {
  createBackupManifestAndSnapshot,
  type CreateManifestParams,
} from '@/lib/backup/backup-manifest';

export const createBackupManifest = createBackupManifestAndSnapshot;
export { createBackupManifestAndSnapshot };
export type { CreateManifestParams };
