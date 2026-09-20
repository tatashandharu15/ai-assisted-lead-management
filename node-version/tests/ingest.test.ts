process.env.DATABASE_PATH = ':memory:';
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import leadsRoutes from '../src/routes/leads.js';
import dashboardRoutes from '../src/routes/dashboard.js';
import { initDb, getDb } from '../src/db.js';
import { all } from '../src/db.js';

const DB_PATH = ':memory:';

async function buildApp(): Promise<FastifyInstance> {
  initDb(DB_PATH);
  const app = Fastify();
  await app.register(fastifyCors, { origin: true });
  await app.register(leadsRoutes);
  await app.register(dashboardRoutes);
  return app;
}

describe('ingest API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
  });
  it('POST /leads/ingest creates a new lead', async () => {
    const payload = [
      {
        name: 'Jane Random Doe',
        email: 'jane.random' + Date.now() + '@example.com',
        phone: '+65 9123 4567',
        company: 'Random Co Pte Ltd',
        country: 'Singapore',
        message: 'Interested in demo'
      }
    ];
    const res = await app.inject({ method: 'POST', url: '/leads/ingest', payload });
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].action).toBe('created');
    expect(typeof body[0].lead_id).toBe('number');
    expect(body[0].matched_on).toBeNull();
  });
  it('POST /leads/ingest existing email updates, count unchanged', async () => {
    const uniqueEmail = 'existing-' + Date.now() + '@test.co';
    const first = await app.inject({
      method: 'POST',
      url: '/leads/ingest',
      payload: [{ name: 'Orig Owner', email: uniqueEmail, phone: '+1 800 000 1111', company: 'Orig Co', country: 'ID', message: 'first msg' }]
    });
    const firstBody = JSON.parse(first.body);
    expect(firstBody[0].action).toBe('created');
    const beforeRows = all('SELECT COUNT(*) as c FROM leads', [], DB_PATH) as Array<{ c: number }>;
    const beforeCount = Number(beforeRows[0].c);
    const second = await app.inject({
      method: 'POST',
      url: '/leads/ingest',
      payload: [{ name: 'Updated Owner', email: uniqueEmail, phone: '+1 800 000 9999', company: 'Updated Co', country: 'SG', message: 'second msg' }]
    });
    const secondBody = JSON.parse(second.body);
    expect(secondBody[0].action).toBe('updated');
    expect(secondBody[0].matched_on).toBeTruthy();
    const afterRows = all('SELECT COUNT(*) as c FROM leads', [], DB_PATH) as Array<{ c: number }>;
    const afterCount = Number(afterRows[0].c);
    expect(afterCount).toBe(beforeCount);
  });
});
