import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';

try {
  const dotenv = await import('dotenv');
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
} catch {
  // dotenv optional jika sudah inject env via container/systemd
}

const dbInstances = new Map<string, Database.Database>();

function getDbPath(): string {
  const envPath = process.env.DATABASE_PATH;
  if (envPath) {
    if (envPath === ':memory:') return envPath;
    const projectRoot = process.cwd();
    return join(projectRoot, envPath);
  }
  const projectRoot = process.cwd();
  return join(projectRoot, 'leads.db');
}

export function getDb(dbPath?: string): Database.Database {
  const path = dbPath || getDbPath();
  if (!dbInstances.has(path)) {
    if (path !== ':memory:') {
      try {
        fs.mkdirSync(dirname(path), { recursive: true });
      } catch {}
    }
    const database = new Database(path);
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    database.pragma('busy_timeout = 5000');
    database.pragma('synchronous = NORMAL');
    dbInstances.set(path, database);
  }
  return dbInstances.get(path)!;
}

export function run(sql: string, params: any[] = [], dbPath?: string): Database.RunResult {
  const database = getDb(dbPath);
  return database.prepare(sql).run(...params);
}

export function all(sql: string, params: any[] = [], dbPath?: string): any[] {
  const database = getDb(dbPath);
  return database.prepare(sql).all(...params) as any[];
}

export function get(sql: string, params: any[] = [], dbPath?: string): any | undefined {
  const database = getDb(dbPath);
  return database.prepare(sql).get(...params) as any | undefined;
}

export function initDb(dbPath?: string): void {
  const database = getDb(dbPath);
  database.exec(`
    DROP TABLE IF EXISTS leads;
  `);
  database.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      full_name TEXT,
      job_title TEXT,
      company_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      phone_digits TEXT,
      country TEXT NOT NULL,
      lead_status TEXT NOT NULL,
      lifecycle_stage TEXT,
      original_source TEXT,
      contact_owner TEXT NOT NULL,
      create_date TEXT NOT NULL,
      last_modified_date TEXT,
      notes TEXT NOT NULL,
      lead_score INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_leads_phone_digits ON leads(phone_digits) WHERE phone_digits IS NOT NULL AND phone_digits != '';`);
  database.exec(`CREATE INDEX idx_leads_lead_status ON leads(lead_status);`);
}
