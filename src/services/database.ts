import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateSHA256 } from './crypto';

let db: SQLite.SQLiteDatabase | null = null;
let localChangeCallback: (() => void) | null = null;

// Initialize Database (Expo SQLite modern async client)
export async function initDatabase() {
  if (db) return db;
  try {
    db = await SQLite.openDatabaseAsync('scholar-os-mobile.db');
    
    // Enable WAL mode
    await db.execAsync('PRAGMA journal_mode = WAL;');
    
    // Create local schemas (mirroring desktop SyncGuard)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT,
        teacher_name TEXT,
        teacher_email TEXT,
        color TEXT,
        schedule TEXT,
        syllabus TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        device_id TEXT,
        checksum TEXT,
        is_deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS schedule_slots (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        room TEXT,
        instructor TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        device_id TEXT,
        checksum TEXT,
        is_deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        course_id TEXT,
        due_date TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        device_id TEXT,
        checksum TEXT,
        is_deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS grades (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        semester TEXT NOT NULL,
        grade_value REAL,
        credit_hours INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        device_id TEXT,
        checksum TEXT,
        is_deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        device_id TEXT NOT NULL,
        schema_version INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS sync_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        device_id TEXT,
        status TEXT,
        records_pushed INTEGER DEFAULT 0,
        records_pulled INTEGER DEFAULT 0,
        conflicts_resolved INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        error TEXT
      );
    `);
    
    console.log('[SQLite Mobile] Database successfully initialized with all SyncGuard tables.');
    return db;
  } catch (err) {
    console.error('[SQLite Mobile] Initialization Error:', err);
    throw err;
  }
}

export function getDbConnection() {
  if (!db) throw new Error('Database is not initialized yet. Call initDatabase() first.');
  return db;
}

// Register sync callback (decouples db from syncService to prevent circular dependency)
export function registerLocalChangeCallback(callback: () => void) {
  localChangeCallback = callback;
}

export interface SyncSettings {
  autoSync: boolean;
  paused: boolean;
  deviceId: string;
  encryptionKey: string;
  offlineSimulated: boolean;
  lastSyncTimestamp: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// Settings Storage Managers
export async function getSyncSettings(): Promise<SyncSettings> {
  try {
    const keys = [
      'settings.sync.autoSync',
      'settings.sync.paused',
      'settings.sync.deviceId',
      'settings.sync.encryptionKey',
      'settings.sync.offlineSimulated',
      'settings.sync.lastSyncTimestamp',
      'settings.sync.supabaseUrl',
      'settings.sync.supabaseAnonKey'
    ];
    const pairs = await AsyncStorage.multiGet(keys);
    const settings: any = {};
    for (const [key, val] of pairs) {
      const cleanKey = key.replace('settings.sync.', '');
      if (val === null) {
        // Defaults
        if (cleanKey === 'autoSync') settings[cleanKey] = true;
        else if (cleanKey === 'paused') settings[cleanKey] = false;
        else if (cleanKey === 'deviceId') settings[cleanKey] = 'student-phone';
        else if (cleanKey === 'encryptionKey') settings[cleanKey] = 'scholar-default-passkey';
        else if (cleanKey === 'offlineSimulated') settings[cleanKey] = false;
        else if (cleanKey === 'lastSyncTimestamp') settings[cleanKey] = '1970-01-01T00:00:00.000Z';
        else settings[cleanKey] = '';
      } else {
        if (val === 'true') settings[cleanKey] = true;
        else if (val === 'false') settings[cleanKey] = false;
        else settings[cleanKey] = val;
      }
    }
    return settings as SyncSettings;
  } catch (e) {
    console.error('AsyncStorage settings load error:', e);
    return {
      autoSync: true,
      paused: false,
      deviceId: 'student-phone',
      encryptionKey: 'scholar-default-passkey',
      offlineSimulated: false,
      lastSyncTimestamp: '1970-01-01T00:00:00.000Z',
      supabaseUrl: '',
      supabaseAnonKey: ''
    };
  }
}

export async function setSyncSettings(settings: Partial<SyncSettings>) {
  try {
    const pairs: [string, string][] = [];
    for (const [key, val] of Object.entries(settings)) {
      pairs.push([`settings.sync.${key}`, String(val)]);
    }
    await AsyncStorage.multiSet(pairs);
  } catch (e) {
    console.error('AsyncStorage settings save error:', e);
  }
}

// SyncGuard Change Enqueuer Hook
export async function enqueueChange(tableName: string, recordId: string, payload: any, isDeleted: number = 0) {
  try {
    const settings = await getSyncSettings();
    const connection = getDbConnection();
    const updatedAt = new Date().toISOString();

    const recordPayload = {
      ...payload,
      id: recordId,
      updated_at: updatedAt,
      device_id: settings.deviceId,
      is_deleted: isDeleted
    };

    const checksum = calculateSHA256(recordPayload);
    recordPayload.checksum = checksum;

    // 1. Update SQLite local row metadata
    try {
      await connection.runAsync(`
        UPDATE ${tableName}
        SET updated_at = ?, device_id = ?, checksum = ?, is_deleted = ?
        WHERE id = ?
      `, [updatedAt, settings.deviceId, checksum, isDeleted, recordId]);
    } catch (e) {
      // Ignored if row doesn't support metadata or update is redundant
    }

    // 2. Enqueue the mutation in sync_queue
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await connection.runAsync(`
      INSERT INTO sync_queue (id, table_name, record_id, payload, updated_at, device_id, schema_version, status)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'pending')
    `, [id, tableName, recordId, JSON.stringify(recordPayload), updatedAt, settings.deviceId]);

    console.log(`[SyncGuard Mobile] Change enqueued: ${tableName} / id: ${recordId}`);

    // Trigger sync cycle if registered
    if (localChangeCallback) {
      localChangeCallback();
    }
  } catch (err) {
    console.error('[SyncGuard Mobile] Error enqueuing change:', err);
  }
}

// --- Local CRUD Database Operations ---

// 1. Courses
export async function getAllCourses() {
  const connection = getDbConnection();
  return await connection.getAllAsync('SELECT * FROM courses WHERE is_deleted = 0 ORDER BY name ASC');
}

export async function saveCourse(course: any) {
  const connection = getDbConnection();
  const { id, name, code, teacher_name, teacher_email, color, schedule, syllabus, notes } = course;
  
  await connection.runAsync(`
    INSERT OR REPLACE INTO courses (id, name, code, teacher_name, teacher_email, color, schedule, syllabus, notes, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [id, name, code || null, teacher_name || null, teacher_email || null, color || '#6d28d9', schedule || null, syllabus || null, notes || null]);

  await enqueueChange('courses', id, course);
}

export async function deleteCourse(id: string) {
  const connection = getDbConnection();
  await connection.runAsync('UPDATE courses SET is_deleted = 1 WHERE id = ?', [id]);
  await enqueueChange('courses', id, { id }, 1);
}

// 2. Schedule Slots
export async function getScheduleSlots() {
  const connection = getDbConnection();
  return await connection.getAllAsync('SELECT * FROM schedule_slots WHERE is_deleted = 0 ORDER BY day_of_week ASC, start_time ASC');
}

export async function saveScheduleSlot(slot: any) {
  const connection = getDbConnection();
  const { id, course_id, day_of_week, start_time, room, instructor } = slot;

  await connection.runAsync(`
    INSERT OR REPLACE INTO schedule_slots (id, course_id, day_of_week, start_time, room, instructor, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `, [id, course_id, day_of_week, start_time, room || null, instructor || null]);

  await enqueueChange('schedule_slots', id, slot);
}

export async function deleteScheduleSlot(id: string) {
  const connection = getDbConnection();
  await connection.runAsync('UPDATE schedule_slots SET is_deleted = 1 WHERE id = ?', [id]);
  await enqueueChange('schedule_slots', id, { id }, 1);
}

// 3. Tasks
export async function getTasks() {
  const connection = getDbConnection();
  return await connection.getAllAsync('SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY due_date ASC');
}

export async function saveTask(task: any) {
  const connection = getDbConnection();
  const { id, title, course_id, due_date, status, notes } = task;

  await connection.runAsync(`
    INSERT OR REPLACE INTO tasks (id, title, course_id, due_date, status, notes, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `, [id, title, course_id || null, due_date || null, status || 'pending', notes || null]);

  await enqueueChange('tasks', id, task);
}

export async function deleteTask(id: string) {
  const connection = getDbConnection();
  await connection.runAsync('UPDATE tasks SET is_deleted = 1 WHERE id = ?', [id]);
  await enqueueChange('tasks', id, { id }, 1);
}

// 4. Grades
export async function getGrades() {
  const connection = getDbConnection();
  return await connection.getAllAsync('SELECT * FROM grades WHERE is_deleted = 0 ORDER BY semester ASC');
}

export async function saveGrade(grade: any) {
  const connection = getDbConnection();
  const { id, course_id, semester, grade_value, credit_hours } = grade;

  await connection.runAsync(`
    INSERT OR REPLACE INTO grades (id, course_id, semester, grade_value, credit_hours, is_deleted)
    VALUES (?, ?, ?, ?, ?, 0)
  `, [id, course_id || null, semester, grade_value !== undefined ? grade_value : null, credit_hours !== undefined ? credit_hours : null]);

  await enqueueChange('grades', id, grade);
}

export async function deleteGrade(id: string) {
  const connection = getDbConnection();
  await connection.runAsync('UPDATE grades SET is_deleted = 1 WHERE id = ?', [id]);
  await enqueueChange('grades', id, { id }, 1);
}
