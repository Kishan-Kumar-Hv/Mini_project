import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const SEED_DEMO_DATA = String(process.env.SEED_DEMO_DATA || 'false').toLowerCase() === 'true';
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const ESCALATION_MINUTES = Number(process.env.ESCALATION_MINUTES || 15);
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 12000);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS || 30000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'medassist.sqlite');
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', 'dist');
const RESOLVED_FRONTEND_DIST = path.resolve(FRONTEND_DIST);
const FRONTEND_INDEX = path.join(RESOLVED_FRONTEND_DIST, 'index.html');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

const FALLBACK_NEWS = [
  {
    id: 'news-fallback-1',
    title: 'WHO expands guidance on digital health for chronic care',
    source: 'World Health Organization',
    published: '2026-02-01',
    url: 'https://www.who.int/news',
  },
  {
    id: 'news-fallback-2',
    title: 'India public health update: stronger preventive screening programs',
    source: 'Ministry of Health and Family Welfare',
    published: '2026-01-26',
    url: 'https://www.mohfw.gov.in/',
  },
  {
    id: 'news-fallback-3',
    title: 'AI-assisted medication adherence tools show improved outcomes',
    source: 'NIH',
    published: '2026-01-19',
    url: 'https://www.nih.gov/news-events',
  },
  {
    id: 'news-fallback-4',
    title: 'Heart health awareness campaign highlights daily activity goals',
    source: 'CDC',
    published: '2026-01-15',
    url: 'https://www.cdc.gov/media/',
  },
  {
    id: 'news-fallback-5',
    title: 'New telemedicine frameworks improve rural access in Karnataka',
    source: 'Karnataka Health and Family Welfare',
    published: '2026-01-11',
    url: 'https://karunadu.karnataka.gov.in/hfw/Pages/home.aspx',
  },
];

const FALLBACK_PHARMACIES = [
  {
    id: 'ph-fallback-1',
    name: 'Hassan Medico Plus',
    area: 'BM Road, Hassan',
    hours: '07:00-23:00',
    phone: '+91 8172 223344',
    openStatus: 'unknown',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=BM+Road+Hassan+Pharmacy',
  },
  {
    id: 'ph-fallback-2',
    name: 'Sri Lakshmi Pharmacy',
    area: 'Salagame Road, Hassan',
    hours: '08:00-22:00',
    phone: '+91 8172 246810',
    openStatus: 'unknown',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Salagame+Road+Hassan+Pharmacy',
  },
  {
    id: 'ph-fallback-3',
    name: '24x7 Care Pharmacy',
    area: 'Near District Hospital, Hassan',
    hours: '24/7',
    phone: '+91 8172 265555',
    openStatus: 'open',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=District+Hospital+Hassan+Pharmacy',
  },
];

const KARNATAKA_DISTRICTS = [
  { name: 'Bagalkot', lat: 16.1867, lon: 75.6961 },
  { name: 'Ballari', lat: 15.1394, lon: 76.9214 },
  { name: 'Belagavi', lat: 15.8497, lon: 74.4977 },
  { name: 'Bengaluru Rural', lat: 13.2845, lon: 77.6078 },
  { name: 'Bengaluru Urban', lat: 12.9716, lon: 77.5946 },
  { name: 'Bidar', lat: 17.9133, lon: 77.5301 },
  { name: 'Chamarajanagar', lat: 11.9261, lon: 76.9400 },
  { name: 'Chikkaballapur', lat: 13.4351, lon: 77.7315 },
  { name: 'Chikkamagaluru', lat: 13.3153, lon: 75.7754 },
  { name: 'Chitradurga', lat: 14.2306, lon: 76.3980 },
  { name: 'Dakshina Kannada', lat: 12.9141, lon: 74.8560 },
  { name: 'Davanagere', lat: 14.4644, lon: 75.9218 },
  { name: 'Dharwad', lat: 15.4589, lon: 75.0078 },
  { name: 'Gadag', lat: 15.4298, lon: 75.6340 },
  { name: 'Hassan', lat: 13.0072, lon: 76.0962 },
  { name: 'Haveri', lat: 14.7937, lon: 75.4041 },
  { name: 'Kalaburagi', lat: 17.3297, lon: 76.8343 },
  { name: 'Kodagu', lat: 12.3375, lon: 75.8069 },
  { name: 'Kolar', lat: 13.1377, lon: 78.1299 },
  { name: 'Koppal', lat: 15.3450, lon: 76.1548 },
  { name: 'Mandya', lat: 12.5239, lon: 76.8950 },
  { name: 'Mysuru', lat: 12.2958, lon: 76.6394 },
  { name: 'Raichur', lat: 16.2076, lon: 77.3463 },
  { name: 'Ramanagara', lat: 12.7210, lon: 77.2810 },
  { name: 'Shivamogga', lat: 13.9299, lon: 75.5681 },
  { name: 'Tumakuru', lat: 13.3409, lon: 77.1010 },
  { name: 'Udupi', lat: 13.3409, lon: 74.7421 },
  { name: 'Uttara Kannada', lat: 14.8136, lon: 74.1295 },
  { name: 'Vijayapura', lat: 16.8302, lon: 75.7100 },
  { name: 'Vijayanagara', lat: 15.3350, lon: 76.4600 },
  { name: 'Yadgir', lat: 16.7700, lon: 77.1376 },
];

const authAttempts = new Map();
const rateWindowMs = 10 * 60 * 1000;
const rateMaxAttempts = 25;

let newsCache = {
  expiresAt: 0,
  data: FALLBACK_NEWS,
};

const directoryCache = new Map();

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('guardian', 'patient')),
      city TEXT NOT NULL DEFAULT 'Hassan, Karnataka',
      phone TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      guardian_id TEXT NOT NULL,
      patient_email TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT DEFAULT '',
      caretaker_phone TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(guardian_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('taken', 'escalated')),
      scheduled_at TEXT,
      taken_at TEXT,
      escalated_at TEXT,
      caretaker_phone TEXT DEFAULT '',
      caretaker_called_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(schedule_id, date_key),
      FOREIGN KEY(schedule_id) REFERENCES medications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      event_type TEXT NOT NULL,
      recipient_role TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      message TEXT NOT NULL,
      provider TEXT,
      provider_reference TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(schedule_id, date_key, event_type, recipient_phone),
      FOREIGN KEY(schedule_id) REFERENCES medications(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_medications_guardian ON medications(guardian_id);
    CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_email);
    CREATE INDEX IF NOT EXISTS idx_logs_schedule_date ON logs(schedule_id, date_key);
    CREATE INDEX IF NOT EXISTS idx_notifications_schedule_date ON notifications(schedule_id, date_key);
  `);

  ensureColumn('logs', 'call_provider', 'TEXT');
  ensureColumn('logs', 'call_reference', 'TEXT');
  ensureColumn('logs', 'call_status', 'TEXT');

  if (SEED_DEMO_DATA) {
    seedDemoData();
  }
}

function ensureColumn(table, column, definition) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((item) => item.name);

  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedDemoData() {
  const guardianEmail = 'guardian@medassist.com';
  const patientEmail = 'patient@medassist.com';

  const guardianUser = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(guardianEmail));

  if (!guardianUser) {
    const now = new Date().toISOString();

    const guardian = createUserRecord({
      id: 'guardian-demo-1',
      name: 'Anita Rao',
      email: guardianEmail,
      password: '123456',
      role: 'guardian',
      city: 'Hassan, Karnataka',
      phone: '+91 99887 76655',
      createdAt: now,
    });

    const patient = createUserRecord({
      id: 'patient-demo-1',
      name: 'Ravi Kumar',
      email: patientEmail,
      password: '123456',
      role: 'patient',
      city: 'Hassan, Karnataka',
      phone: '+91 99887 76655',
      createdAt: now,
    });

    insertUser(guardian);
    insertUser(patient);
  }

  const defaultMedication = db
    .prepare('SELECT id FROM medications WHERE id = ?')
    .get('med-demo-1');

  if (!defaultMedication) {
    const guardian = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizeEmail(guardianEmail));

    if (guardian) {
      db.prepare(
        `INSERT INTO medications (
          id, guardian_id, patient_email, medicine_name, dosage, time,
          notes, caretaker_phone, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'med-demo-1',
        guardian.id,
        normalizeEmail(patientEmail),
        'Paracetamol',
        '500 mg',
        '08:00',
        'After breakfast',
        '+91 99887 76655',
        new Date().toISOString(),
      );
    }
  }
}

function createUserRecord({ id, name, email, password, role, city, phone, createdAt }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  return {
    id,
    name: cleanText(name, 80),
    email: normalizeEmail(email),
    passwordHash: hash,
    passwordSalt: salt,
    role: role === 'guardian' ? 'guardian' : 'patient',
    city: cleanText(city || 'Hassan, Karnataka', 120),
    phone: cleanText(phone || '', 30),
    createdAt,
  };
}

function insertUser(record) {
  db.prepare(
    `INSERT INTO users (
      id, name, email, password_hash, password_salt, role, city, phone, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.name,
    record.email,
    record.passwordHash,
    record.passwordSalt,
    record.role,
    record.city,
    record.phone,
    record.createdAt,
  );
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 210000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const calculated = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (calculated.length !== expected.length) return false;
  return crypto.timingSafeEqual(calculated, expected);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(tokenHash, userId, expiresAt, now);

  return { token, expiresAt };
}

function parseTimeToMinutes(value) {
  const [hh = '0', mm = '0'] = String(value || '00:00').split(':');
  return Number(hh) * 60 + Number(mm);
}

function getTimezoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = {};
  parts.forEach((part) => {
    map[part.type] = part.value;
  });

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour || '0'),
    minute: Number(map.minute || '0'),
  };
}

function getDateKeyInTimeZone(date, timeZone) {
  const parts = getTimezoneParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getMinutesNowInTimeZone(date, timeZone) {
  const parts = getTimezoneParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    city: row.city,
    phone: row.phone,
    createdAt: row.created_at,
  };
}

function mapMedication(row) {
  return {
    id: row.id,
    guardianId: row.guardian_id,
    patientEmail: row.patient_email,
    medicineName: row.medicine_name,
    dosage: row.dosage,
    time: row.time,
    notes: row.notes,
    caretakerPhone: row.caretaker_phone,
    createdAt: row.created_at,
  };
}

function mapLog(row) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    dateKey: row.date_key,
    status: row.status,
    scheduledAt: row.scheduled_at,
    takenAt: row.taken_at,
    escalatedAt: row.escalated_at,
    caretakerPhone: row.caretaker_phone,
    caretakerCalledAt: row.caretaker_called_at,
    callProvider: row.call_provider,
    callReference: row.call_reference,
    callStatus: row.call_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    dateKey: row.date_key,
    eventType: row.event_type,
    recipientRole: row.recipient_role,
    recipientPhone: row.recipient_phone,
    message: row.message,
    provider: row.provider,
    providerReference: row.provider_reference,
    status: row.status,
    createdAt: row.created_at,
    medicineName: row.medicine_name,
    patientEmail: row.patient_email,
    time: row.time,
  };
}

function allowAttempt(ipAddress) {
  const key = ipAddress || 'unknown';
  const now = Date.now();
  const existing = authAttempts.get(key);

  if (!existing || now > existing.resetAt) {
    authAttempts.set(key, { count: 1, resetAt: now + rateWindowMs });
    return true;
  }

  existing.count += 1;
  authAttempts.set(key, existing);
  return existing.count <= rateMaxAttempts;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message, details) {
  const payload = { ok: false, error: message };
  if (details) payload.details = details;
  sendJson(res, statusCode, payload);
}

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function tryServeFrontend(pathname, res) {
  if (!fs.existsSync(FRONTEND_INDEX)) return false;

  let safePathname = pathname || '/';
  try {
    safePathname = decodeURIComponent(safePathname);
  } catch {
    return false;
  }

  const requestedPath = safePathname === '/' ? '/index.html' : safePathname;
  const candidate = path.resolve(RESOLVED_FRONTEND_DIST, `.${requestedPath}`);

  if (!candidate.startsWith(RESOLVED_FRONTEND_DIST)) {
    return false;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(candidate));
    res.end(fs.readFileSync(candidate));
    return true;
  }

  if (path.extname(requestedPath)) {
    return false;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(FRONTEND_INDEX));
  return true;
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', (error) => reject(error));
  });
}

function authenticate(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const tokenHash = sha256(token);

  const row = db
    .prepare(
      `SELECT
        s.token_hash,
        s.expires_at,
        u.id,
        u.name,
        u.email,
        u.role,
        u.city,
        u.phone,
        u.created_at
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    )
    .get(tokenHash);

  if (!row) return null;

  if (Date.now() > Number(row.expires_at)) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return {
    tokenHash,
    user: mapUser(row),
  };
}

function requireRole(auth, role, res) {
  if (!auth || auth.user.role !== role) {
    sendError(res, 403, `${role} role required`);
    return false;
  }
  return true;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function placeCaretakerCall(phone, medicineName, patientEmail) {
  const to = cleanText(phone, 30);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const twimlUrl = process.env.TWILIO_TWIML_URL || 'http://demo.twilio.com/docs/voice.xml';

  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      provider: 'mock',
      status: 'missing_twilio_config',
      message: `Twilio config missing. Simulated escalation for ${patientEmail} (${medicineName}).`,
    };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
  const authValue = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const form = new URLSearchParams();
  form.set('To', to);
  form.set('From', from);
  form.set('Url', twimlUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authValue}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: controller.signal,
    });

    const payload = await safeJson(response);

    if (!response.ok) {
      return {
        ok: false,
        provider: 'twilio',
        status: 'failed',
        message: payload?.message || `Twilio request failed (${response.status})`,
      };
    }

    return {
      ok: true,
      provider: 'twilio',
      status: payload?.status || 'queued',
      reference: payload?.sid || '',
      message: 'Twilio call requested successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'twilio',
      status: 'failed',
      message: String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendSms(phone, message) {
  const to = cleanText(phone, 30);
  const body = cleanText(message, 700);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER;

  if (!to) {
    return {
      ok: false,
      provider: 'mock',
      status: 'missing_phone',
      message: 'Recipient phone is missing.',
    };
  }

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    return {
      ok: false,
      provider: 'mock',
      status: 'missing_twilio_config',
      message: `Twilio SMS config missing. Add a Messaging Service SID or sender number to deliver SMS to ${to}.`,
    };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authValue = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const form = new URLSearchParams();
  form.set('To', to);
  if (messagingServiceSid) {
    form.set('MessagingServiceSid', messagingServiceSid);
  } else {
    form.set('From', from);
  }
  form.set('Body', body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authValue}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: controller.signal,
    });

    const payload = await safeJson(response);

    if (!response.ok) {
      return {
        ok: false,
        provider: 'twilio',
        status: 'failed',
        message: payload?.message || `Twilio SMS request failed (${response.status})`,
      };
    }

    return {
      ok: true,
      provider: 'twilio',
      status: payload?.status || 'queued',
      reference: payload?.sid || '',
      message: 'SMS requested successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'twilio',
      status: 'failed',
      message: String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseOpeningStatus(hoursRaw, nowMinutes) {
  if (!hoursRaw) {
    return {
      openStatus: 'unknown',
      hours: 'Hours unavailable',
    };
  }

  const hours = String(hoursRaw).trim();
  const normalized = hours.toLowerCase();

  if (normalized.includes('24/7')) {
    return {
      openStatus: 'open',
      hours,
    };
  }

  const match = normalized.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    return {
      openStatus: 'unknown',
      hours,
    };
  }

  const openAt = Number(match[1]) * 60 + Number(match[2]);
  const closeAt = Number(match[3]) * 60 + Number(match[4]);
  const isOvernight = closeAt < openAt;
  const isOpen = isOvernight
    ? nowMinutes >= openAt || nowMinutes <= closeAt
    : nowMinutes >= openAt && nowMinutes <= closeAt;

  return {
    openStatus: isOpen ? 'open' : 'closed',
    hours,
  };
}

function getDistrictByName(rawDistrict) {
  const target = cleanText(rawDistrict || 'Hassan', 80).toLowerCase();
  const district = KARNATAKA_DISTRICTS.find((item) => item.name.toLowerCase() === target);
  return district || KARNATAKA_DISTRICTS.find((item) => item.name === 'Hassan');
}

function getDirectoryCacheKey(districtName, type) {
  return `${districtName}:${type}`;
}

function fallbackDirectoryItems(districtName, type) {
  const district = cleanText(districtName || 'Hassan', 80);
  const items = [];

  if (type === 'pharmacy' || type === 'both') {
    items.push({
      id: `fallback-${district}-pharmacy-1`,
      name: `${district} Main Medical Store`,
      area: `${district} Central Area`,
      hours: 'Hours unavailable',
      phone: '-',
      openStatus: 'unknown',
      category: 'pharmacy',
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${district} pharmacy`)}`,
    });
  }

  if (type === 'hospital' || type === 'both') {
    items.push({
      id: `fallback-${district}-hospital-1`,
      name: `District Hospital ${district}`,
      area: `${district}, Karnataka`,
      hours: '24/7',
      phone: '-',
      openStatus: 'open',
      category: 'hospital',
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`District Hospital ${district}`)}`,
    });
  }

  if (district.toLowerCase() === 'hassan' && (type === 'pharmacy' || type === 'both')) {
    return [...FALLBACK_PHARMACIES].map((item) => ({
      ...item,
      category: 'pharmacy',
    }));
  }

  return items;
}

async function fetchDistrictDirectory(rawDistrict, rawType = 'both') {
  const district = getDistrictByName(rawDistrict);
  const type = ['pharmacy', 'hospital', 'both'].includes(rawType) ? rawType : 'both';
  const cacheKey = getDirectoryCacheKey(district.name, type);
  const cached = directoryCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const nowMinutes = getMinutesNowInTimeZone(new Date(), APP_TIMEZONE);
  const includePharmacy = type === 'pharmacy' || type === 'both';
  const includeHospital = type === 'hospital' || type === 'both';

  const query = `
    [out:json][timeout:20];
    (
      ${
        includePharmacy
          ? `node["amenity"="pharmacy"](around:25000,${district.lat},${district.lon});
      way["amenity"="pharmacy"](around:25000,${district.lat},${district.lon});
      relation["amenity"="pharmacy"](around:25000,${district.lat},${district.lon});`
          : ''
      }
      ${
        includeHospital
          ? `node["amenity"="hospital"](around:25000,${district.lat},${district.lon});
      way["amenity"="hospital"](around:25000,${district.lat},${district.lon});
      relation["amenity"="hospital"](around:25000,${district.lat},${district.lon});`
          : ''
      }
    );
    out center tags;
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: controller.signal,
    });

    const payload = await safeJson(response);
    const elements = payload?.elements || [];

    const mapped = elements
      .map((item, index) => {
        const tags = item.tags || {};
        const amenity = cleanText(tags.amenity || 'pharmacy', 30).toLowerCase();
        const category = amenity === 'hospital' ? 'hospital' : 'pharmacy';
        const latitude = item.lat || item.center?.lat;
        const longitude = item.lon || item.center?.lon;
        const name = cleanText(
          tags.name || `${category === 'hospital' ? 'Hospital' : 'Pharmacy'} ${index + 1}`,
          120,
        );
        const area = cleanText(
          tags['addr:street'] || tags['addr:suburb'] || `${district.name}, Karnataka`,
          140,
        );
        const phone = cleanText(tags.phone || tags['contact:phone'] || '-', 40);
        const openingHours = tags.opening_hours || tags['opening_hours:covid19'] || '';
        const openingStatus = parseOpeningStatus(openingHours, nowMinutes);

        const mapUrl =
          latitude && longitude
            ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${district.name}`)}`;

        return {
          id: item.id ? `live-${item.id}` : `live-${district.name}-${index}`,
          name,
          area,
          hours: openingStatus.hours,
          phone,
          openStatus: openingStatus.openStatus,
          category,
          mapUrl,
        };
      })
      .filter((item) => item.name)
      .slice(0, 24);

    if (mapped.length > 0) {
      directoryCache.set(cacheKey, {
        expiresAt: Date.now() + 30 * 60 * 1000,
        data: mapped,
      });
      return mapped;
    }
  } catch {
    // Fallback below.
  } finally {
    clearTimeout(timeout);
  }

  const fallback = fallbackDirectoryItems(district.name, type);
  directoryCache.set(cacheKey, {
    expiresAt: Date.now() + 5 * 60 * 1000,
    data: fallback,
  });

  return fallback;
}

async function fetchLivePharmacies() {
  const items = await fetchDistrictDirectory('Hassan', 'pharmacy');
  return items.filter((item) => item.category === 'pharmacy');
}

async function fetchLiveNews() {
  if (Date.now() < newsCache.expiresAt && Array.isArray(newsCache.data)) {
    return newsCache.data;
  }

  const key = process.env.NEWS_API_KEY;

  if (!key) {
    newsCache = {
      expiresAt: Date.now() + 15 * 60 * 1000,
      data: FALLBACK_NEWS,
    };
    return FALLBACK_NEWS;
  }

  const endpoint = `https://newsapi.org/v2/top-headlines?country=in&category=health&pageSize=8&apiKey=${encodeURIComponent(key)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    const payload = await safeJson(response);

    if (!response.ok || !Array.isArray(payload?.articles)) {
      throw new Error(payload?.message || `News API failed (${response.status})`);
    }

    const mapped = payload.articles
      .filter((article) => article?.title && article?.url)
      .map((article, index) => ({
        id: `news-live-${index}`,
        title: cleanText(article.title, 240),
        source: cleanText(article.source?.name || 'News API', 120),
        published: article.publishedAt || new Date().toISOString(),
        url: article.url,
      }))
      .slice(0, 8);

    if (mapped.length > 0) {
      newsCache = {
        expiresAt: Date.now() + 15 * 60 * 1000,
        data: mapped,
      };
      return mapped;
    }
  } catch {
    // Fallback below.
  } finally {
    clearTimeout(timeout);
  }

  newsCache = {
    expiresAt: Date.now() + 5 * 60 * 1000,
    data: FALLBACK_NEWS,
  };

  return FALLBACK_NEWS;
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

function formatScheduleTime(hhmm) {
  const [hour = 0, minute = 0] = String(hhmm || '00:00').split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function getNotification(scheduleId, dateKey, eventType, recipientPhone) {
  return db
    .prepare(
      `SELECT n.*, m.medicine_name, m.patient_email, m.time
       FROM notifications n
       INNER JOIN medications m ON m.id = n.schedule_id
       WHERE n.schedule_id = ? AND n.date_key = ? AND n.event_type = ? AND n.recipient_phone = ?`,
    )
    .get(scheduleId, dateKey, eventType, recipientPhone);
}

async function recordSmsNotification({
  scheduleId,
  dateKey,
  eventType,
  recipientRole,
  recipientPhone,
  message,
}) {
  const phone = cleanText(recipientPhone || '', 30);
  if (!phone) {
    return {
      sent: false,
      skipped: true,
      reason: 'missing_phone',
    };
  }

  const existing = getNotification(scheduleId, dateKey, eventType, phone);
  if (existing) {
    return {
      sent: false,
      skipped: true,
      reason: 'already_sent',
      item: mapNotification(existing),
    };
  }

  const smsResult = await sendSms(phone, message);
  const id = uuid();

  db.prepare(
    `INSERT INTO notifications (
      id, schedule_id, date_key, event_type, recipient_role, recipient_phone,
      message, provider, provider_reference, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    scheduleId,
    dateKey,
    eventType,
    recipientRole,
    phone,
    cleanText(message, 700),
    smsResult.provider || 'mock',
    smsResult.reference || '',
    smsResult.status || 'queued',
    new Date().toISOString(),
  );

  const inserted = db
    .prepare(
      `SELECT n.*, m.medicine_name, m.patient_email, m.time
       FROM notifications n
       INNER JOIN medications m ON m.id = n.schedule_id
       WHERE n.id = ?`,
    )
    .get(id);

  return {
    sent: Boolean(smsResult.ok),
    skipped: false,
    result: smsResult,
    item: inserted ? mapNotification(inserted) : null,
  };
}

async function notifyDueReminders(medication, dateKey) {
  const patient = getUserByEmail(medication.patient_email);
  const scheduleLabel = `${medication.medicine_name} (${medication.dosage}) at ${formatScheduleTime(medication.time)}`;

  const results = [];

  results.push(
    await recordSmsNotification({
      scheduleId: medication.id,
      dateKey,
      eventType: 'due_patient',
      recipientRole: 'patient',
      recipientPhone: patient?.phone || '',
      message: `Reminder: Take ${scheduleLabel}.`,
    }),
  );

  results.push(
    await recordSmsNotification({
      scheduleId: medication.id,
      dateKey,
      eventType: 'due_caretaker',
      recipientRole: 'caretaker',
      recipientPhone: medication.caretaker_phone || '',
      message: `Reminder: ${medication.patient_email} should take ${scheduleLabel}.`,
    }),
  );

  return results;
}

async function notifyMissedReminders(medication, dateKey) {
  const patient = getUserByEmail(medication.patient_email);
  const scheduleLabel = `${medication.medicine_name} (${medication.dosage}) at ${formatScheduleTime(medication.time)}`;
  const results = [];

  results.push(
    await recordSmsNotification({
      scheduleId: medication.id,
      dateKey,
      eventType: 'missed_patient',
      recipientRole: 'patient',
      recipientPhone: patient?.phone || '',
      message: `Missed alert: ${scheduleLabel} is overdue by ${ESCALATION_MINUTES}+ minutes. Please take it now.`,
    }),
  );

  results.push(
    await recordSmsNotification({
      scheduleId: medication.id,
      dateKey,
      eventType: 'missed_caretaker',
      recipientRole: 'caretaker',
      recipientPhone: medication.caretaker_phone || '',
      message: `Alert: ${medication.patient_email} missed ${scheduleLabel}. Escalation workflow started.`,
    }),
  );

  return results;
}

async function notifyTakenToCaretaker(medication, dateKey, takenAtIso) {
  const takenAt = new Date(takenAtIso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return recordSmsNotification({
    scheduleId: medication.id,
    dateKey,
    eventType: 'taken_caretaker',
    recipientRole: 'caretaker',
    recipientPhone: medication.caretaker_phone || '',
    message: `Update: ${medication.patient_email} marked ${medication.medicine_name} as taken at ${takenAt}.`,
  });
}

function getMedicationForUser(id, user) {
  const medication = db.prepare('SELECT * FROM medications WHERE id = ?').get(id);
  if (!medication) return null;

  if (user.role === 'guardian' && medication.guardian_id === user.id) {
    return medication;
  }

  if (user.role === 'patient' && normalizeEmail(medication.patient_email) === normalizeEmail(user.email)) {
    return medication;
  }

  return null;
}

function getLogByScheduleAndDate(scheduleId, dateKey) {
  return db
    .prepare('SELECT * FROM logs WHERE schedule_id = ? AND date_key = ?')
    .get(scheduleId, dateKey);
}

function upsertLog({
  id,
  scheduleId,
  dateKey,
  status,
  scheduledAt,
  takenAt,
  escalatedAt,
  caretakerPhone,
  caretakerCalledAt,
  callProvider,
  callReference,
  callStatus,
}) {
  const nowIso = new Date().toISOString();

  db.prepare(
    `INSERT INTO logs (
      id, schedule_id, date_key, status, scheduled_at, taken_at, escalated_at,
      caretaker_phone, caretaker_called_at, call_provider, call_reference, call_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(schedule_id, date_key) DO UPDATE SET
      status = excluded.status,
      scheduled_at = excluded.scheduled_at,
      taken_at = excluded.taken_at,
      escalated_at = excluded.escalated_at,
      caretaker_phone = excluded.caretaker_phone,
      caretaker_called_at = excluded.caretaker_called_at,
      call_provider = excluded.call_provider,
      call_reference = excluded.call_reference,
      call_status = excluded.call_status,
      updated_at = excluded.updated_at`,
  ).run(
    id,
    scheduleId,
    dateKey,
    status,
    scheduledAt,
    takenAt,
    escalatedAt,
    caretakerPhone,
    caretakerCalledAt,
    callProvider,
    callReference,
    callStatus,
    nowIso,
    nowIso,
  );

  return getLogByScheduleAndDate(scheduleId, dateKey);
}

async function handleEscalationForMedication(medication, dateKey, forceCall = false) {
  const now = new Date();
  const nowIso = now.toISOString();
  const scheduledAt = `${dateKey}T${medication.time}:00+05:30`;

  let log = getLogByScheduleAndDate(medication.id, dateKey);

  if (log?.status === 'taken') {
    return { log, callResult: null };
  }

  if (!log || log.status !== 'escalated') {
    log = upsertLog({
      id: log?.id || uuid(),
      scheduleId: medication.id,
      dateKey,
      status: 'escalated',
      scheduledAt,
      takenAt: null,
      escalatedAt: nowIso,
      caretakerPhone: medication.caretaker_phone || '',
      caretakerCalledAt: log?.caretaker_called_at || null,
      callProvider: log?.call_provider || null,
      callReference: log?.call_reference || null,
      callStatus: log?.call_status || null,
    });
  }

  if (!medication.caretaker_phone) {
    return { log, callResult: null };
  }

  if (log?.caretaker_called_at && !forceCall) {
    return { log, callResult: null };
  }

  const callResult = await placeCaretakerCall(
    medication.caretaker_phone,
    medication.medicine_name,
    medication.patient_email,
  );

  log = upsertLog({
    id: log?.id || uuid(),
    scheduleId: medication.id,
    dateKey,
    status: 'escalated',
    scheduledAt,
    takenAt: null,
    escalatedAt: log?.escalated_at || nowIso,
    caretakerPhone: medication.caretaker_phone || '',
    caretakerCalledAt: nowIso,
    callProvider: callResult.provider,
    callReference: callResult.reference || '',
    callStatus: callResult.status,
  });

  return { log, callResult };
}

async function runEscalationSweep() {
  const now = new Date();
  const dateKey = getDateKeyInTimeZone(now, APP_TIMEZONE);
  const minutesNow = getMinutesNowInTimeZone(now, APP_TIMEZONE);

  const schedules = db.prepare('SELECT * FROM medications').all();

  for (const medication of schedules) {
    const dueMinutes = parseTimeToMinutes(medication.time);
    const overdueMinutes = minutesNow - dueMinutes;
    const log = getLogByScheduleAndDate(medication.id, dateKey);

    if (log?.status === 'taken') {
      continue;
    }

    if (overdueMinutes >= 0 && overdueMinutes < ESCALATION_MINUTES) {
      await notifyDueReminders(medication, dateKey);
      continue;
    }

    if (overdueMinutes >= ESCALATION_MINUTES) {
      await handleEscalationForMedication(medication, dateKey, false);
      await notifyMissedReminders(medication, dateKey);
    }
  }
}

function cleanupExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

async function router(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'medassist-backend',
      time: new Date().toISOString(),
      timezone: APP_TIMEZONE,
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/public/news') {
    const news = await fetchLiveNews();
    sendJson(res, 200, { ok: true, items: news });
    return;
  }

  if (method === 'GET' && pathname === '/api/public/pharmacies') {
    const pharmacies = await fetchLivePharmacies();
    sendJson(res, 200, {
      ok: true,
      city: 'Hassan, Karnataka',
      timezone: APP_TIMEZONE,
      items: pharmacies,
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/public/districts') {
    sendJson(res, 200, {
      ok: true,
      state: 'Karnataka',
      items: KARNATAKA_DISTRICTS.map((item) => item.name),
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/public/directory') {
    const district = cleanText(url.searchParams.get('district') || 'Hassan', 80);
    const type = cleanText(url.searchParams.get('type') || 'both', 20).toLowerCase();
    const validType = ['pharmacy', 'hospital', 'both'].includes(type) ? type : 'both';
    const items = await fetchDistrictDirectory(district, validType);

    sendJson(res, 200, {
      ok: true,
      district: getDistrictByName(district).name,
      type: validType,
      items,
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    if (!allowAttempt(req.socket.remoteAddress)) {
      sendError(res, 429, 'Too many attempts. Try again later.');
      return;
    }

    const payload = await readJsonBody(req);

    const name = cleanText(payload.name, 80);
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || '');
    const role = payload.role === 'guardian' ? 'guardian' : 'patient';
    const city = cleanText(payload.city || 'Hassan, Karnataka', 120);
    const phone = cleanText(payload.phone || '', 30);

    if (!name) {
      sendError(res, 400, 'Name is required.');
      return;
    }

    if (!email || !password) {
      sendError(res, 400, 'Email and password are required.');
      return;
    }

    if (password.length < 6) {
      sendError(res, 400, 'Password must be at least 6 characters.');
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      sendError(res, 409, 'Email already registered.');
      return;
    }

    const record = createUserRecord({
      id: uuid(),
      name,
      email,
      password,
      role,
      city,
      phone,
      createdAt: new Date().toISOString(),
    });

    insertUser(record);

    const session = createSession(record.id);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(record.id);

    sendJson(res, 201, {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: mapUser(row),
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!allowAttempt(req.socket.remoteAddress)) {
      sendError(res, 429, 'Too many attempts. Try again later.');
      return;
    }

    const payload = await readJsonBody(req);
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || '');

    if (!email || !password) {
      sendError(res, 400, 'Email and password are required.');
      return;
    }

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!row) {
      sendError(res, 401, 'Invalid credentials.');
      return;
    }

    const valid = verifyPassword(password, row.password_salt, row.password_hash);
    if (!valid) {
      sendError(res, 401, 'Invalid credentials.');
      return;
    }

    const session = createSession(row.id);

    sendJson(res, 200, {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: mapUser(row),
    });
    return;
  }

  const auth = authenticate(req);

  if (method === 'GET' && pathname === '/api/auth/me') {
    if (!auth) {
      sendError(res, 401, 'Unauthorized.');
      return;
    }

    sendJson(res, 200, {
      ok: true,
      user: auth.user,
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (!auth) {
      sendError(res, 401, 'Unauthorized.');
      return;
    }

    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(auth.tokenHash);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!auth) {
    sendError(res, 401, 'Unauthorized.');
    return;
  }

  if (method === 'GET' && pathname === '/api/users/patients') {
    if (!requireRole(auth, 'guardian', res)) return;

    const rows = db
      .prepare('SELECT * FROM users WHERE role = ? ORDER BY name ASC')
      .all('patient');

    sendJson(res, 200, {
      ok: true,
      items: rows.map(mapUser),
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/notifications') {
    let rows;

    if (auth.user.role === 'guardian') {
      rows = db
        .prepare(
          `SELECT n.*, m.medicine_name, m.patient_email, m.time
           FROM notifications n
           INNER JOIN medications m ON m.id = n.schedule_id
           WHERE m.guardian_id = ?
           ORDER BY n.created_at DESC
           LIMIT 200`,
        )
        .all(auth.user.id);
    } else {
      rows = db
        .prepare(
          `SELECT n.*, m.medicine_name, m.patient_email, m.time
           FROM notifications n
           INNER JOIN medications m ON m.id = n.schedule_id
           WHERE m.patient_email = ?
           ORDER BY n.created_at DESC
           LIMIT 200`,
        )
        .all(normalizeEmail(auth.user.email));
    }

    sendJson(res, 200, {
      ok: true,
      items: rows.map(mapNotification),
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/medications') {
    let rows;

    if (auth.user.role === 'guardian') {
      rows = db
        .prepare('SELECT * FROM medications WHERE guardian_id = ? ORDER BY created_at DESC')
        .all(auth.user.id);
    } else {
      rows = db
        .prepare('SELECT * FROM medications WHERE patient_email = ? ORDER BY created_at DESC')
        .all(normalizeEmail(auth.user.email));
    }

    sendJson(res, 200, {
      ok: true,
      items: rows.map(mapMedication),
    });
    return;
  }

  if (method === 'POST' && pathname === '/api/medications') {
    if (!requireRole(auth, 'guardian', res)) return;

    const payload = await readJsonBody(req);

    const patientEmail = normalizeEmail(payload.patientEmail);
    const medicineName = cleanText(payload.medicineName, 80);
    const dosage = cleanText(payload.dosage, 60);
    const time = cleanText(payload.time, 5);
    const notes = cleanText(payload.notes || '', 220);
    const caretakerPhone = cleanText(payload.caretakerPhone || '', 30);

    if (!patientEmail || !medicineName || !dosage || !time) {
      sendError(res, 400, 'Patient, medicine, dosage and time are required.');
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
      sendError(res, 400, 'Time must be in HH:MM format.');
      return;
    }

    const patient = getUserByEmail(patientEmail);
    if (!patient || patient.role !== 'patient') {
      sendError(res, 400, 'Selected patient account not found. Register patient first.');
      return;
    }

    const medication = {
      id: uuid(),
      guardianId: auth.user.id,
      patientEmail,
      medicineName,
      dosage,
      time,
      notes,
      caretakerPhone,
      createdAt: new Date().toISOString(),
    };

    db.prepare(
      `INSERT INTO medications (
        id, guardian_id, patient_email, medicine_name,
        dosage, time, notes, caretaker_phone, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      medication.id,
      medication.guardianId,
      medication.patientEmail,
      medication.medicineName,
      medication.dosage,
      medication.time,
      medication.notes,
      medication.caretakerPhone,
      medication.createdAt,
    );

    runEscalationSweep().catch(() => {
      // Keep API response fast even if sweep provider requests fail.
    });

    sendJson(res, 201, {
      ok: true,
      item: medication,
    });
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/medications\/([^/]+)$/);
  if (method === 'DELETE' && deleteMatch) {
    if (!requireRole(auth, 'guardian', res)) return;

    const medicationId = decodeURIComponent(deleteMatch[1]);
    const row = db.prepare('SELECT * FROM medications WHERE id = ?').get(medicationId);

    if (!row) {
      sendError(res, 404, 'Medication plan not found.');
      return;
    }

    if (row.guardian_id !== auth.user.id) {
      sendError(res, 403, 'You can delete only your own medication plans.');
      return;
    }

    db.prepare('DELETE FROM medications WHERE id = ?').run(medicationId);

    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'GET' && pathname === '/api/logs') {
    let rows;

    if (auth.user.role === 'guardian') {
      rows = db
        .prepare(
          `SELECT l.*
           FROM logs l
           INNER JOIN medications m ON m.id = l.schedule_id
           WHERE m.guardian_id = ?
           ORDER BY l.date_key DESC, l.updated_at DESC`,
        )
        .all(auth.user.id);
    } else {
      rows = db
        .prepare(
          `SELECT l.*
           FROM logs l
           INNER JOIN medications m ON m.id = l.schedule_id
           WHERE m.patient_email = ?
           ORDER BY l.date_key DESC, l.updated_at DESC`,
        )
        .all(normalizeEmail(auth.user.email));
    }

    sendJson(res, 200, {
      ok: true,
      items: rows.map(mapLog),
    });
    return;
  }

  const markTakenMatch = pathname.match(/^\/api\/medications\/([^/]+)\/taken$/);
  if (method === 'POST' && markTakenMatch) {
    if (!requireRole(auth, 'patient', res)) return;

    const medicationId = decodeURIComponent(markTakenMatch[1]);
    const medication = getMedicationForUser(medicationId, auth.user);

    if (!medication) {
      sendError(res, 404, 'Medication plan not found for this patient.');
      return;
    }

    const now = new Date();
    const dateKey = getDateKeyInTimeZone(now, APP_TIMEZONE);
    const scheduledAt = `${dateKey}T${medication.time}:00+05:30`;
    const takenAtIso = now.toISOString();
    const log = upsertLog({
      id: uuid(),
      scheduleId: medication.id,
      dateKey,
      status: 'taken',
      scheduledAt,
      takenAt: takenAtIso,
      escalatedAt: null,
      caretakerPhone: medication.caretaker_phone || '',
      caretakerCalledAt: null,
      callProvider: null,
      callReference: null,
      callStatus: null,
    });

    const smsResult = await notifyTakenToCaretaker(medication, dateKey, takenAtIso);

    sendJson(res, 200, {
      ok: true,
      log: mapLog(log),
      smsResult,
    });
    return;
  }

  const escalateMatch = pathname.match(/^\/api\/medications\/([^/]+)\/escalate$/);
  if (method === 'POST' && escalateMatch) {
    const medicationId = decodeURIComponent(escalateMatch[1]);
    const medication = getMedicationForUser(medicationId, auth.user);

    if (!medication) {
      sendError(res, 404, 'Medication plan not found.');
      return;
    }

    const dateKey = getDateKeyInTimeZone(new Date(), APP_TIMEZONE);
    const result = await handleEscalationForMedication(medication, dateKey, true);
    const smsResults = await notifyMissedReminders(medication, dateKey);

    sendJson(res, 200, {
      ok: true,
      log: result.log ? mapLog(result.log) : null,
      callResult: result.callResult,
      smsResults,
    });
    return;
  }

  if (method === 'GET' && !pathname.startsWith('/api')) {
    if (tryServeFrontend(pathname, res)) {
      return;
    }
  }

  sendError(res, 404, 'Route not found.');
}

initDatabase();
cleanupExpiredSessions();
runEscalationSweep().catch(() => {
  // Keep startup resilient if third-party provider calls fail.
});

const server = http.createServer(async (req, res) => {
  try {
    await router(req, res);
  } catch (error) {
    sendError(res, 500, 'Internal server error.', String(error?.message || error));
  }
});

const sweepTimer = setInterval(() => {
  runEscalationSweep().catch(() => {
    // keep server alive even if provider API fails
  });
  cleanupExpiredSessions();
}, SWEEP_INTERVAL_MS);

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '127.0.0.1' ? 'localhost' : HOST;
  console.log(`MedAssist backend running on http://${displayHost}:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
  if (fs.existsSync(FRONTEND_INDEX)) {
    console.log(`Serving frontend from: ${FRONTEND_DIST}`);
  } else {
    console.log('Frontend dist not found. Run "npm run build" to serve UI from backend.');
  }
});

process.on('SIGINT', () => {
  clearInterval(sweepTimer);
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  clearInterval(sweepTimer);
  server.close(() => process.exit(0));
});
