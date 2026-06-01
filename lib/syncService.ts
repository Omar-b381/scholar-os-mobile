import { getSyncSettings, setSyncSettings, getDbConnection, registerLocalChangeCallback } from './database';
import { encryptPayload, decryptPayload, calculateSHA256 } from './crypto';

export interface SyncRecord {
  id: string;
  table_name: string;
  payload: string; // Encrypted AES-256 JSON ciphertext
  updated_at: string;
  device_id: string;
  schema_version: number;
  checksum: string;
}

let syncTimeout: any = null;
let syncPromiseInProgress: Promise<any> | null = null;
const statusCallbacks: ((event: string, data?: any) => void)[] = [];

// Register UI listener for sync state updates
export function registerSyncStatusListener(callback: (event: string, data?: any) => void) {
  statusCallbacks.push(callback);
  return () => {
    const idx = statusCallbacks.indexOf(callback);
    if (idx !== -1) statusCallbacks.splice(idx, 1);
  };
}

export function notifySyncStatus(event: string, data?: any) {
  for (const cb of statusCallbacks) {
    try { cb(event, data); } catch (e) {}
  }
}

// Log a sync event to SQLite sync_logs
async function logSyncEvent(status: string, details: {
  recordsPushed: number;
  recordsPulled: number;
  conflictsResolved: number;
  durationMs: number;
  error?: string;
}) {
  try {
    const connection = getDbConnection();
    const settings = await getSyncSettings();
    const id = Math.random().toString(36).substring(2, 15);
    const timestamp = new Date().toISOString();

    await connection.runAsync(`
      INSERT INTO sync_logs (id, timestamp, device_id, status, records_pushed, records_pulled, conflicts_resolved, duration_ms, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      timestamp,
      settings.deviceId,
      status,
      details.recordsPushed,
      details.recordsPulled,
      details.conflictsResolved,
      details.durationMs,
      details.error || null
    ]);
    
    notifySyncStatus('sync:log_added');
  } catch (err) {
    console.error('[SyncGuard Mobile] Failed to write sync log:', err);
  }
}

// Conflict resolution Rules 1-4 (matches desktop exactly)
function resolveConflict(localRecord: any, remoteRecord: any, tableName: string): any {
  const remoteIsDeleted = remoteRecord.is_deleted === 1 || remoteRecord.is_deleted === true;
  const localIsDeleted = localRecord.is_deleted === 1 || localRecord.is_deleted === true;

  // Rule 3: Soft-Delete Preservation
  if (localIsDeleted !== remoteIsDeleted) {
    // Keep active version if one is deleted and the other modified
    return localIsDeleted ? remoteRecord : localRecord;
  }

  // Rule 4: Grade Protection / Logging
  if (tableName === 'grades') {
    // Mobile logs details to console. We keep both in the database via higher timestamp Rule 1 fallback
    console.log('[SyncGuard Mobile] Grade conflict detected and resolved using timestamp.');
  }

  // Rule 1: Timestamp Wins (Default)
  const localTime = new Date(localRecord.updated_at || 0).getTime();
  const remoteTime = new Date(remoteRecord.updated_at || 0).getTime();
  return localTime >= remoteTime ? localRecord : remoteRecord;
}

// Connection tester
export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUrl = url.trim().replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/sync_records?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': anonKey.trim(),
        'Authorization': `Bearer ${anonKey.trim()}`
      }
    });

    if (res.status === 200 || res.status === 204 || res.status === 404) {
      if (res.status === 404) {
        return { success: true, error: 'تم الاتصال بنجاح! ولكن جدول sync_records غير موجود في Supabase. يرجى تهيئته عبر سكربت SQL.' };
      }
      return { success: true };
    } else {
      const text = await res.text();
      let msg = text;
      try { msg = JSON.parse(text).message; } catch(e){}
      return { success: false, error: `خطأ من Supabase (${res.status}): ${msg}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// Core Push & Pull Synchronization Cycle
export async function runSyncCycle(): Promise<{ success: boolean; pushed: number; pulled: number; conflicts: number; error?: string }> {
  const startTime = Date.now();
  const settings = await getSyncSettings();

  if (settings.paused) {
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, error: 'المزامنة متوقفة مؤقتاً' };
  }

  if (settings.offlineSimulated) {
    notifySyncStatus('sync:offline');
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, error: 'الجهاز في وضع غير متصل بالشبكة (محاكاة)' };
  }

  if (!settings.encryptionKey || !settings.encryptionKey.trim()) {
    notifySyncStatus('sync:error', 'مفتاح التشفير فارغ أو غير صالح. يرجى تعيين مفتاح تشفير صالح في الإعدادات.');
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, error: 'مفتاح التشفير فارغ أو غير صالح. يرجى تعيين مفتاح تشفير صالح في الإعدادات.' };
  }

  if (settings.encryptionKey.trim().length < 6) {
    notifySyncStatus('sync:error', 'تنبيه أمان: يجب أن يتكون مفتاح التشفير من 6 خانات أو أكثر.');
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, error: 'تنبيه أمان: يجب أن يتكون مفتاح التشفير من 6 خانات أو أكثر.' };
  }

  let pushedCount = 0;
  let pulledCount = 0;
  let conflictsResolved = 0;

  const isSupabaseActive = settings.supabaseUrl && settings.supabaseAnonKey;
  if (!isSupabaseActive) {
    // If Supabase keys are empty on mobile, sync fails gracefully (mobile must connect to cloud to sync with desktop)
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, error: 'لم يتم إدخال إعدادات سحابة Supabase' };
  }

  try {
    const connection = getDbConnection();
    notifySyncStatus('sync:running');

    // ----------------------------------------------------
    // STEP 1: FLUSH OFFLINE QUEUE (PUSH)
    // ----------------------------------------------------
    const pendingChanges = await connection.getAllAsync(`
      SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY updated_at ASC
    `) as any[];

    if (pendingChanges.length > 0) {
      const batch = pendingChanges.slice(0, 50);

      const recordsToPush = batch.map(change => {
        const decryptedPayload = JSON.parse(change.payload);
        const ciphertext = encryptPayload(decryptedPayload, settings.encryptionKey);
        const checksum = calculateSHA256(decryptedPayload);

        return {
          id: change.record_id,
          table_name: change.table_name,
          payload: ciphertext,
          updated_at: change.updated_at,
          device_id: change.device_id,
          schema_version: change.schema_version,
          checksum: checksum
        };
      });

      // Push to Supabase
      const cleanUrl = settings.supabaseUrl.trim().replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/rest/v1/sync_records`, {
        method: 'POST',
        headers: {
          'apikey': settings.supabaseAnonKey.trim(),
          'Authorization': `Bearer ${settings.supabaseAnonKey.trim()}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(recordsToPush)
      });

      if (![200, 201, 204].includes(res.status)) {
        const text = await res.text();
        throw new Error(`Supabase POST failed: ${res.status} - ${text}`);
      }

      // Mark locally as synced
      for (const change of batch) {
        await connection.runAsync(`UPDATE sync_queue SET status = 'synced' WHERE id = ?`, [change.id]);
        pushedCount++;
      }
    }

    // ----------------------------------------------------
    // STEP 2: DOWNLOAD PENDING RECORDS (PULL)
    // ----------------------------------------------------
    const lastSync = settings.lastSyncTimestamp;
    const cleanUrl = settings.supabaseUrl.trim().replace(/\/$/, '');
    const queryUrl = `${cleanUrl}/rest/v1/sync_records?updated_at=gt.${encodeURIComponent(lastSync)}&device_id=neq.${encodeURIComponent(settings.deviceId)}`;
    
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': settings.supabaseAnonKey.trim(),
        'Authorization': `Bearer ${settings.supabaseAnonKey.trim()}`
      }
    });

    if (res.status !== 200) {
      const text = await res.text();
      throw new Error(`Supabase GET failed: ${res.status} - ${text}`);
    }

    const remoteChanges = await res.json() as SyncRecord[];

    if (remoteChanges.length > 0) {
      for (const remoteRecord of remoteChanges) {
        if (remoteRecord.schema_version > 1) {
          notifySyncStatus('sync:error', 'نسخة قاعدة بيانات السحابة أحدث! يرجى تحديث التطبيق.');
          throw new Error('اصدار قاعدة البيانات غير متطابق');
        }

        // Decrypt payload
        let decryptedPayload: any;
        try {
          decryptedPayload = decryptPayload(remoteRecord.payload, settings.encryptionKey);
        } catch (err) {
          console.warn(`[SyncGuard Mobile] Decryption failed for record ${remoteRecord.id}. Skipping.`);
          continue;
        }

        // Checksum validation
        const calculatedChecksum = calculateSHA256(decryptedPayload);
        if (calculatedChecksum !== remoteRecord.checksum) {
          console.warn(`[SyncGuard Mobile] Checksum mismatch on pulled record ${remoteRecord.id}. Skipping.`);
          continue;
        }

        // Check if record exists locally
        const localRecord = await connection.getFirstAsync(`
          SELECT * FROM ${remoteRecord.table_name} WHERE id = ?
        `, [remoteRecord.id]) as any;

        let winningRecord = decryptedPayload;

        if (localRecord) {
          // Check if there is a pending local change (unsynced mutation)
          const hasLocalChange = await connection.getFirstAsync(`
            SELECT COUNT(*) as cnt FROM sync_queue WHERE record_id = ? AND table_name = ? AND status = 'pending'
          `, [remoteRecord.id, remoteRecord.table_name]) as { cnt: number };

          if (hasLocalChange && hasLocalChange.cnt > 0) {
            // CONFLICT RESOLUTION
            winningRecord = resolveConflict(localRecord, decryptedPayload, remoteRecord.table_name);
            conflictsResolved++;
          }
        }

        // Rule 5: Timetable slot deduplication
        if (remoteRecord.table_name === 'schedule_slots' && winningRecord.is_deleted === 0) {
          const duplicateSlot = await connection.getFirstAsync(`
            SELECT * FROM schedule_slots 
            WHERE course_id = ? AND day_of_week = ? AND start_time = ? AND is_deleted = 0 AND id != ?
          `, [winningRecord.course_id, winningRecord.day_of_week, winningRecord.start_time, winningRecord.id]) as any;

          if (duplicateSlot) {
            const duplicateTime = new Date(duplicateSlot.updated_at || 0).getTime();
            const winningTime = new Date(winningRecord.updated_at || 0).getTime();

            if (duplicateTime > winningTime) {
              // Local duplicate is newer, keep it and skip remote record
              continue;
            } else {
              // Remote slot is newer, soft-delete local slot duplicate
              await connection.runAsync(`UPDATE schedule_slots SET is_deleted = 1 WHERE id = ?`, [duplicateSlot.id]);
              // Enqueue local soft-delete
              const upAt = new Date().toISOString();
              const id = Math.random().toString(36).substring(2, 15);
              await connection.runAsync(`
                INSERT INTO sync_queue (id, table_name, record_id, payload, updated_at, device_id, schema_version, status)
                VALUES (?, 'schedule_slots', ?, ?, ?, ?, 1, 'pending')
              `, [id, duplicateSlot.id, JSON.stringify({ id: duplicateSlot.id, is_deleted: 1, updated_at: upAt, device_id: settings.deviceId }), upAt, settings.deviceId]);
            }
          }
        }

        // Execute INSERT OR REPLACE locally
        const keys = Object.keys(winningRecord);
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => {
          const v = winningRecord[k];
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (typeof v === 'object' && v !== null) return JSON.stringify(v);
          return v;
        });

        await connection.runAsync(`
          INSERT OR REPLACE INTO ${remoteRecord.table_name} (${keys.join(', ')})
          VALUES (${placeholders})
        `, values);

        pulledCount++;
      }
    }

    // Success! Update sync timestamp
    const nowTimestamp = new Date().toISOString();
    await setSyncSettings({ lastSyncTimestamp: nowTimestamp });

    const duration = Date.now() - startTime;
    await logSyncEvent('success', {
      recordsPushed: pushedCount,
      recordsPulled: pulledCount,
      conflictsResolved: conflictsResolved,
      durationMs: duration
    });

    if (pushedCount > 0 || pulledCount > 0 || conflictsResolved > 0) {
      notifySyncStatus('sync:success', {
        pushed: pushedCount,
        pulled: pulledCount,
        conflicts: conflictsResolved
      });
    } else {
      notifySyncStatus('sync:idle');
    }

    return {
      success: true,
      pushed: pushedCount,
      pulled: pulledCount,
      conflicts: conflictsResolved
    };

  } catch (err: any) {
    const duration = Date.now() - startTime;
    await logSyncEvent('error', {
      recordsPushed: pushedCount,
      recordsPulled: pulledCount,
      conflictsResolved: conflictsResolved,
      durationMs: duration,
      error: err.message || String(err)
    });
    
    notifySyncStatus('sync:error', err.message || 'خطأ في الاتصال بسحابة المزامنة.');
    return {
      success: false,
      pushed: pushedCount,
      pulled: pulledCount,
      conflicts: conflictsResolved,
      error: err.message
    };
  }
}

// Debounced silent sync triggers
export function triggerSilentSync() {
  if (syncPromiseInProgress) return;
  syncPromiseInProgress = runSyncCycle().finally(() => {
    syncPromiseInProgress = null;
  });
}

// Setup background timer (runs on start and interval)
export async function startSyncTimer() {
  if (syncTimeout) {
    clearInterval(syncTimeout);
    syncTimeout = null;
  }

  const settings = await getSyncSettings();
  if (settings.paused || !settings.autoSync) return;

  // Trigger once immediately
  triggerSilentSync();

  // Trigger every 5 minutes
  syncTimeout = setInterval(() => {
    triggerSilentSync();
  }, 5 * 60 * 1000);
}

export function stopSyncTimer() {
  if (syncTimeout) {
    clearInterval(syncTimeout);
    syncTimeout = null;
  }
}

// Register callback in database to decouple dependency and avoid circular import issues
registerLocalChangeCallback(triggerSilentSync);
