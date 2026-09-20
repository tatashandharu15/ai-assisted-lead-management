process.env.DATABASE_PATH = ':memory:';
import { describe, it, expect, beforeAll } from 'vitest';
import { initDb, getDb, run, all } from '../src/db.js';
import { loadAndCleanCSV } from '../src/services/cleaner.js';
import { getAllLeadsForDedup, findDedupeCandidates, similarity } from '../src/services/dedup.js';
import { normalizeCompanyTokens, normalizePhoneDigits, parseFullName } from '../src/services/cleaner.js';
import path from 'path';

const DB_PATH = ':memory:';

describe('dedup', () => {
  beforeAll(async () => {
    initDb(DB_PATH);
    const csvPath = path.resolve(process.cwd(), '../data/leads_seed.csv');
    const rows = await loadAndCleanCSV(csvPath);
    const database = getDb(DB_PATH);
    const tx = database.transaction((dataRows: any[]) => {
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
    tx(rows);
  }, 120000);
  it('blocking pair count stays reasonable (< 5000 when scored pairs + groups)', async () => {
    const leads = getAllLeadsForDedup(DB_PATH);
    const phoneGroups = new Map<string, number[]>();
    const emailNameGroups = new Map<string, number[]>();
    const companyCountryGroups = new Map<string, number[]>();
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      if (l.phone_digits && l.phone_digits.length > 1) {
        if (!phoneGroups.has(l.phone_digits)) phoneGroups.set(l.phone_digits, []);
        phoneGroups.get(l.phone_digits)!.push(i);
      }
      const emailLocal = l.email.split('@')[0] || '';
      const firstInitial = ((l.first_name || l.full_name || '')[0] || '').toLowerCase();
      const enKey = emailLocal.toLowerCase() + '|' + firstInitial;
      if (!emailNameGroups.has(enKey)) emailNameGroups.set(enKey, []);
      emailNameGroups.get(enKey)!.push(i);
      const compTok = normalizeCompanyTokens(l.company_name);
      const ccKey = compTok + '|' + (l.country || '').slice(0, 2).toLowerCase();
      if (!companyCountryGroups.has(ccKey)) companyCountryGroups.set(ccKey, []);
      companyCountryGroups.get(ccKey)!.push(i);
    }
    let pairCount = 0;
    function countPairs(groups: Map<string, number[]>) {
      for (const arr of groups.values()) {
        if (arr.length > 1) pairCount += (arr.length * (arr.length - 1)) / 2;
      }
    }
    countPairs(phoneGroups);
    countPairs(emailNameGroups);
    countPairs(companyCountryGroups);
    expect(pairCount).toBeLessThan(5000);
  }, 60000);
  it('known dup pair record 100234834 & 100234835 in same group with confidence >= 0.8', async () => {
    const candidates = await findDedupeCandidates(0.5, undefined, DB_PATH);
    const allLeads = getAllLeadsForDedup(DB_PATH);
    const byRecordId = new Map<string, number>();
    for (const l of allLeads) byRecordId.set(l.record_id, l.id);
    const idA = byRecordId.get('100234834');
    const idB = byRecordId.get('100234835');
    expect(idA).toBeDefined();
    expect(idB).toBeDefined();
    let found = false;
    for (const g of candidates) {
      if (g.lead_ids.includes(idA!) && g.lead_ids.includes(idB!)) {
        found = true;
        expect(g.confidence).toBeGreaterThanOrEqual(0.8);
        break;
      }
    }
    expect(found).toBe(true);
  }, 120000);
  it('runtime of findDedupeCandidates < 30 seconds', async () => {
    const t0 = Date.now();
    await findDedupeCandidates(0.7, 200, DB_PATH);
    const elapsed = (Date.now() - t0) / 1000;
    expect(elapsed).toBeLessThan(30);
  }, 60000);
});
