import { initDb, run, all, getDb } from './db.js';
import { loadAndCleanCSV } from './services/cleaner.js';
import path from 'path';

async function main() {
  initDb();
  const csvPath = path.resolve(process.cwd(), '../data/leads_seed.csv');
  const rows = await loadAndCleanCSV(csvPath);
  console.log(`Loaded and cleaned ${rows.length} rows from CSV`);
  const database = getDb();
  const insertTx = database.transaction((dataRows: any[]) => {
    const stmt = database.prepare(
      'INSERT INTO leads (record_id, first_name, last_name, full_name, job_title, company_name, email, phone_number, phone_digits, country, lead_status, lifecycle_stage, original_source, contact_owner, create_date, last_modified_date, notes, lead_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    for (const r of dataRows) {
      stmt.run(
        r.record_id,
        r.first_name,
        r.last_name,
        r.full_name,
        r.job_title,
        r.company_name,
        r.email,
        r.phone_number,
        r.phone_digits || null,
        r.country,
        r.lead_status,
        r.lifecycle_stage,
        r.original_source,
        r.contact_owner,
        r.create_date.toISOString(),
        r.last_modified_date ? r.last_modified_date.toISOString() : null,
        r.notes,
        r.lead_score
      );
    }
  });
  insertTx(rows);
  const countRow = all('SELECT COUNT(*) as c FROM leads') as Array<{ c: number }>;
  const total = Number(countRow[0]?.c || 0);
  console.log(`Rows inserted: ${total} (expected 2049)`);
  const statusRows = all('SELECT lead_status, COUNT(*) as c FROM leads GROUP BY lead_status ORDER BY c DESC') as Array<{ lead_status: string; c: number }>;
  console.log('\nStatus counts:');
  for (const s of statusRows) {
    console.log(`  ${s.lead_status}: ${s.c}`);
  }
  const ownerRows = all('SELECT contact_owner, COUNT(*) as c FROM leads GROUP BY contact_owner ORDER BY c DESC') as Array<{ contact_owner: string; c: number }>;
  console.log('\nOwner counts:');
  for (const o of ownerRows) {
    console.log(`  ${o.contact_owner}: ${o.c}`);
  }
}

main().catch(console.error);
