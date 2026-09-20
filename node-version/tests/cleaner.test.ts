process.env.DATABASE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { normalizeLeadStatus, normalizePhoneDigits, normalizeCompanyTokens, parseFullName, loadAndCleanCSV } from '../src/services/cleaner.js';
import path from 'path';

describe('cleaner', () => {
  it('normalizeLeadStatus trims & lowercases NEW', () => {
    expect(normalizeLeadStatus('  NEW ')).toBe('new');
  });
  it('normalizeLeadStatus Closed Lost -> closed_lost', () => {
    expect(normalizeLeadStatus('Closed Lost')).toBe('closed_lost');
  });
  it('normalizeLeadStatus opportunity -> opportunity', () => {
    expect(normalizeLeadStatus('opportunity')).toBe('opportunity');
  });
  it('normalizePhoneDigits strips non-digits + plus sign', () => {
    expect(normalizePhoneDigits('+62 (875) 4899-5562')).toBe('6287548995562');
  });
  it('normalizeCompanyTokens strips legal suffixes', () => {
    expect(normalizeCompanyTokens('Acme Co Ltd')).toBe('acme');
    expect(normalizeCompanyTokens('Globex Holdings Inc.')).toBe('globex');
  });
  it('parseFullName splits Joey Van Der Saar', () => {
    const r = parseFullName('Joey Van Der Saar');
    expect(r.firstName).toBe('Joey');
    expect(r.lastName).toBe('Van Der Saar');
  });
  it('loadAndCleanCSV returns 2049 rows', async () => {
    const p = path.resolve(process.cwd(), '../data/leads_seed.csv');
    const rows = await loadAndCleanCSV(p);
    expect(rows.length).toBe(2049);
  });
});
