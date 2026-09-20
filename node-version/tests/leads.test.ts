process.env.DATABASE_PATH = ':memory:';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import leadsRoutes from '../src/routes/leads.js';
import dashboardRoutes from '../src/routes/dashboard.js';
import { initDb, run, getDb, all } from '../src/db.js';
import { normalizePhoneDigits, parseFullName } from '../src/services/cleaner.js';

const DB_PATH = ':memory:';

function seedSample(dbPath: string, n = 10) {
  const database = getDb(dbPath);
  const stmt = database.prepare(
    'INSERT INTO leads (record_id, first_name, last_name, full_name, job_title, company_name, email, phone_number, phone_digits, country, lead_status, lifecycle_stage, original_source, contact_owner, create_date, last_modified_date, notes, lead_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  const statuses = ['new', 'contacted', 'connected', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
  for (let i = 1; i <= n; i++) {
    const name = `User ${i}`;
    const { firstName, lastName } = parseFullName(name);
    const status = statuses[(i - 1) % statuses.length];
    const phone = `+1 555 000 ${String(1000 + i).padStart(4, '0')}`;
    stmt.run(
      `TEST-${i}`,
      firstName,
      lastName || null,
      name,
      `Title ${i}`,
      `Company ${i} Inc`,
      `user${i}@example.com`,
      phone,
      normalizePhoneDigits(phone),
      i % 2 === 0 ? 'USA' : 'Singapore',
      status,
      i % 3 === 0 ? 'Customer' : 'Lead',
      null,
      i % 2 === 0 ? 'Marcus Wong' : 'Aisha Patel',
      new Date(2025, 0, i).toISOString(),
      null,
      `Notes for lead ${i}. SFF booth QR scan.`,
      50 + i
    );
  }
}

async function buildTestApp(): Promise<FastifyInstance> {
  initDb(DB_PATH);
  seedSample(DB_PATH, 10);
  const app = Fastify();
  await app.register(fastifyCors, { origin: true });
  await app.register(leadsRoutes);
  await app.register(dashboardRoutes);
  return app;
}

describe('leads API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  it('GET /leads returns 200 json array', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
  it('GET /leads?status=qualified returns only qualified', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads?status=qualified' });
    const body = JSON.parse(res.body) as Array<{ lead_status: string }>;
    expect(body.length).toBeGreaterThan(0);
    for (const r of body) expect(r.lead_status).toBe('qualified');
  });
  it('GET /leads/999999 returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads/999999' });
    expect(res.statusCode).toBe(404);
  });
  it('PATCH /leads/1 {notes:"test"} updates notes', async () => {
    const before = await app.inject({ method: 'GET', url: '/leads/1' });
    const beforeBody = JSON.parse(before.body);
    expect(beforeBody.notes).not.toContain('patched-test-note');
    const patch = await app.inject({
      method: 'PATCH',
      url: '/leads/1',
      payload: { notes: 'patched-test-note' }
    });
    expect(patch.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: '/leads/1' });
    const afterBody = JSON.parse(after.body);
    expect(afterBody.notes).toBe('patched-test-note');
  });
  it('GET /leads/export returns csv content type', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads/export' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('csv');
    expect(res.headers['content-disposition']).toContain('leads_export.csv');
    expect(res.body).toContain('record_id');
  });
});
