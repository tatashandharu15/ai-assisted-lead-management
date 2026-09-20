import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function normalizeLeadStatus(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/\s+/g, '_');
  if (s === 'closed_lost' || s === 'closed_won') {
    return s;
  }
  const valid = ['new', 'contacted', 'connected', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
  if (valid.includes(s)) return s;
  if (s === 'closed' || s === 'lost') return 'closed_lost';
  if (s === 'won') return 'closed_won';
  return 'new';
}

export function normalizePhoneDigits(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function normalizeCompanyTokens(name: string): string {
  let s = (name || '').toLowerCase();
  const suffixRegex = /\b(inc\.?|ltd\.?|pte\.?|co\.?|llc\.?|srl\.?|holdings\.?|gmbh\.?|ab\.?|ltda\.?|partners\.?|solutions\.?|studio\.?|retail\.?|digital\.?|trading\.?|freight\.?|logistics\.?|consulting\.?|analytics\.?|robotics\.?|group\.?|ventures\.?)\s*$/gi;
  let prev: string;
  let iter = 0;
  do {
    prev = s;
    s = s.replace(suffixRegex, '').trim();
    iter++;
  } while (s !== prev && iter < 10);
  return s.trim();
}

export function parseMixedDate(raw: string): Date {
  if (!raw) throw new Error('Empty date');
  let s = String(raw).trim();
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  const slash = s.split('/');
  if (slash.length === 3) {
    const [m, d, y] = slash.map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  throw new Error(`Cannot parse date: ${raw}`);
}

export function parseFullName(full: string): { firstName: string; lastName: string } {
  const s = (full || '').trim();
  if (!s) return { firstName: '', lastName: '' };
  const parts = s.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

export interface CleanedLeadRow {
  record_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  job_title: string | null;
  company_name: string;
  email: string;
  phone_number: string;
  phone_digits: string;
  country: string;
  lead_status: string;
  lifecycle_stage: string | null;
  original_source: string | null;
  contact_owner: string;
  create_date: Date;
  last_modified_date: Date | null;
  notes: string;
  lead_score: number | null;
}

const columnRename: Record<string, string> = {
  'Record ID': 'record_id',
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Full Name': 'full_name',
  'Job Title': 'job_title',
  'Company Name': 'company_name',
  'Email': 'email',
  'Phone Number': 'phone_number',
  'Country/Region': 'country',
  'Lead Status': 'lead_status',
  'Lifecycle Stage': 'lifecycle_stage',
  'Original Source': 'original_source',
  'Contact Owner': 'contact_owner',
  'Create Date': 'create_date',
  'Last Modified Date': 'last_modified_date',
  'Notes': 'notes',
  'Lead Score': 'lead_score'
};

const dropColumns = new Set(['City', 'Original Source Drill-Down 1', 'Annual Revenue', 'Marketing contact status', 'GDPR consent']);

export async function loadAndCleanCSV(csvPath: string): Promise<CleanedLeadRow[]> {
  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true
  });
  const rows: CleanedLeadRow[] = [];
  for (const rawRow of parsed.data as any[]) {
    const renamed: Record<string, any> = {};
    for (const key of Object.keys(rawRow)) {
      if (dropColumns.has(key)) continue;
      const newKey = columnRename[key] || key;
      renamed[newKey] = rawRow[key];
    }
    const r = renamed as any;
    const firstName = r.first_name && r.first_name.trim() ? r.first_name.trim() : null;
    const lastName = r.last_name && r.last_name.trim() ? r.last_name.trim() : null;
    let fullName = r.full_name && r.full_name.trim() ? r.full_name.trim() : null;
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    }
    const parsedName = fullName ? parseFullName(fullName) : null;
    const finalFirstName = firstName || (parsedName?.firstName || null);
    const finalLastName = lastName || (parsedName?.lastName || null);

    const lead: CleanedLeadRow = {
      record_id: String(r.record_id || '').trim(),
      first_name: finalFirstName,
      last_name: finalLastName,
      full_name: fullName,
      job_title: r.job_title && r.job_title.trim() ? r.job_title.trim() : null,
      company_name: String(r.company_name || '').trim(),
      email: String(r.email || '').trim().toLowerCase(),
      phone_number: String(r.phone_number || '').trim(),
      phone_digits: normalizePhoneDigits(String(r.phone_number || '')),
      country: String(r.country || '').trim(),
      lead_status: normalizeLeadStatus(String(r.lead_status || 'new')),
      lifecycle_stage: r.lifecycle_stage && r.lifecycle_stage.trim() ? r.lifecycle_stage.trim() : null,
      original_source: r.original_source && r.original_source.trim() ? r.original_source.trim() : null,
      contact_owner: String(r.contact_owner || '').trim() || 'Unassigned',
      create_date: parseMixedDate(String(r.create_date || '')),
      last_modified_date: r.last_modified_date ? parseMixedDate(String(r.last_modified_date)) : null,
      notes: String(r.notes || '').trim(),
      lead_score: r.lead_score && r.lead_score.trim() !== '' ? Number(r.lead_score) : null
    };
    rows.push(lead);
  }
  return rows;
}
