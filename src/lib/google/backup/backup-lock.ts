/**
 * Production-Safe Multi-Tenant Backup Lock Manager
 * Prevents concurrent overlapping backups for the same college.
 */

const LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes timeout

// Map of active college locks
const activeLocks = new Map<string, { backupId: string; timestamp: number }>();

export class BackupLock {
  /**
   * Attempts to acquire a lock for the specified collegeId.
   * Returns true if lock was acquired, false if college is already being backed up.
   */
  static acquire(collegeId: string, backupId: string): boolean {
    const now = Date.now();
    const existing = activeLocks.get(collegeId);

    if (existing) {
      if (now - existing.timestamp < LOCK_TIMEOUT_MS) {
        return false; // Still locked
      }
      // Lock expired, allow override
      activeLocks.delete(collegeId);
    }

    activeLocks.set(collegeId, { backupId, timestamp: now });
    return true;
  }

  /**
   * Releases the lock for the specified collegeId.
   */
  static release(collegeId: string, backupId?: string): void {
    const existing = activeLocks.get(collegeId);
    if (!existing) return;

    if (!backupId || existing.backupId === backupId) {
      activeLocks.delete(collegeId);
    }
  }

  /**
   * Checks whether a college backup is currently in progress.
   */
  static isLocked(collegeId: string): boolean {
    const now = Date.now();
    const existing = activeLocks.get(collegeId);
    if (!existing) return false;

    if (now - existing.timestamp >= LOCK_TIMEOUT_MS) {
      activeLocks.delete(collegeId);
      return false;
    }

    return true;
  }
}
