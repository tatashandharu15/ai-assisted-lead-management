import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { stringify } from 'csv-stringify/sync';
import { randomUUID } from 'node:crypto';
import { all, get, run, getDb } from '../db.js';
import { LeadUpdateSchema, IngestPayloadSchema } from '../schema.js';
import { normalizePhoneDigits, parseFullName } from '../services/cleaner.js';
import { findDedupeCandidates } from '../services/dedup.js';
import { extractSource, extractSourceAsync } from '../services/source-extract.js';

interface ListQuery {
  status?: string;
  owner?: string;
  country?: string;
  q?: string;
  limit?: number | string;
}

function buildWhereAndParams(q: ListQuery): { where: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  if (q.status) {
    clauses.push('lead_status = ?');
    params.push(q.status);
  }
  if (q.owner) {
    clauses.push('contact_owner LIKE ?');
    params.push(`%${q.owner}%`);
  }
  if (q.country) {
    clauses.push('country LIKE ?');
    params.push(`%${q.country}%`);
  }
  if (q.q) {
    const search = `%${q.q}%`.toLowerCase();
    clauses.push('(LOWER(email) LIKE ? OR LOWER(full_name) LIKE ? OR LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(company_name) LIKE ? OR LOWER(notes) LIKE ?)');
    params.push(search, search, search, search, search, search);
  }
  return { where: clauses.length ? ' WHERE ' + clauses.join(' AND ') : '', params };
}

export default async function leadsRoutes(fastify: FastifyInstance) {
  fastify.get('/leads', async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const q = request.query;
    const rawLimit = typeof q.limit === 'string' ? parseInt(q.limit as string, 10) : Number(q.limit);
    const limit = (!isNaN(rawLimit) && rawLimit > 0) ? Math.min(rawLimit, 5000) : 100;
    const { where, params } = buildWhereAndParams(q as any);
    const limitClause = ` LIMIT ${Math.floor(limit)}`;
    const rows = all(`SELECT * FROM leads${where} ORDER BY id ASC${limitClause}`, params);
    return rows;
  });

  fastify.get('/leads/export', async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const q = request.query;
    const { where, params } = buildWhereAndParams(q as any);
    const rows = all(`SELECT * FROM leads${where} ORDER BY id ASC`, params);
    const csv = stringify(rows, { header: true });
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename=leads_export.csv');
    return csv;
  });

  fastify.post('/leads/ingest', async (request: FastifyRequest<{ Body: any[] | any }>, reply: FastifyReply) => {
    const body = Array.isArray(request.body) ? request.body : [request.body];
    const database = getDb();

    const processItem = database.transaction((item: any) => {
      const parsed = IngestPayloadSchema.safeParse(item);
      if (!parsed.success) {
        return { action: 'error', lead_id: 0, matched_on: null, error: parsed.error.issues };
      }
      const payload = parsed.data;
      const phoneDigits = normalizePhoneDigits(payload.phone);
      let email = (payload.email || '').toLowerCase().trim();
      let phone = payload.phone || '';
      const { firstName, lastName } = parseFullName(payload.name);

      let createDate: Date;
      if (payload.submitted_at) {
        const parsedDate = new Date(payload.submitted_at);
        createDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      } else {
        createDate = new Date();
      }
      const dateIso = createDate.toISOString().slice(0, 10);
      const now = Date.now();
      const timestamp = `${now}-${process.hrtime.bigint().toString(36)}`;

      if (!email) email = `unknown_ingest_${timestamp}@unknown.invalid`;
      if (!phone) phone = '0';
      const finalPhoneDigits = phoneDigits || '0';
      const finalCompany = (payload.company || '').toString().trim() || 'Unknown';
      const finalCountry = (payload.country || '').toString().trim() || 'Unknown';

      let phoneMatch: any = null;
      let emailMatch: any = null;

      if (finalPhoneDigits && finalPhoneDigits !== '0') {
        phoneMatch = get('SELECT * FROM leads WHERE phone_digits = ? LIMIT 1', [finalPhoneDigits]);
      }
      if (email && !email.startsWith('unknown_ingest_')) {
        emailMatch = get('SELECT * FROM leads WHERE email = ? LIMIT 1', [email]);
      }

      if (phoneMatch && emailMatch && phoneMatch.id !== emailMatch.id) {
        return {
          action: 'conflict',
          matched_on: 'conflict_phone_email_split',
          phone_lead_id: phoneMatch.id,
          email_lead_id: emailMatch.id,
          detail: 'Phone and email match different existing records; manual merge required',
        };
      }

      let matchedOn: string | null = null;
      let existing: any = null;
      if (phoneMatch && emailMatch) {
        existing = phoneMatch;
        matchedOn = 'both';
      } else if (phoneMatch) {
        existing = phoneMatch;
        matchedOn = 'phone';
      } else if (emailMatch) {
        existing = emailMatch;
        matchedOn = 'email';
      }

      if (existing) {
        const newNote = `[Ingest ${dateIso}]: ${payload.message || ''}`.trim();
        const appendedNotes = (existing.notes || '') ? existing.notes + '\n' + newNote : newNote;
        const newFirst = firstName || existing.first_name;
        const newLast = lastName || existing.last_name;
        const newFull = (newFirst || newLast) ? [newFirst, newLast].filter(Boolean).join(' ') : existing.full_name;
        const newCompany = finalCompany !== 'Unknown' ? finalCompany : existing.company_name;
        const newCountry = finalCountry !== 'Unknown' ? finalCountry : existing.country;

        run(
          'UPDATE leads SET first_name=?, last_name=?, full_name=?, company_name=?, country=?, notes=?, phone_number=?, phone_digits=?, email=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
          [
            newFirst, newLast, newFull || null, newCompany, newCountry, appendedNotes,
            phone, finalPhoneDigits || null, email,
            existing.id,
          ]
        );
        const updated = get('SELECT * FROM leads WHERE id = ?', [existing.id]);
        return { action: 'updated', lead_id: updated.id, matched_on: matchedOn };
      } else {
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
        const initNote = payload.message ? `[Ingest ${dateIso}]: ${payload.message}` : '';
        // randomUUID imported at top of file from 'node:crypto'
        const recordId = `INGEST-${randomUUID()}`;
        const res = run(
          `INSERT INTO leads (record_id, first_name, last_name, full_name, job_title, company_name, email, phone_number, phone_digits, country, lead_status, lifecycle_stage, original_source, contact_owner, create_date, last_modified_date, notes, lead_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            recordId,
            firstName || null,
            lastName || null,
            fullName,
            null,
            finalCompany,
            email,
            phone,
            finalPhoneDigits || null,
            finalCountry,
            'new',
            null,
            null,
            'Unassigned',
            createDate.toISOString(),
            null,
            initNote,
            null,
          ]
        );
        return { action: 'created', lead_id: Number(res.lastInsertRowid), matched_on: null };
      }
    });

    const results: any[] = [];
    for (const item of body) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          results.push(processItem(item));
          break;
        } catch (err: any) {
          if (attempt === 2) {
            results.push({
              action: 'failed',
              matched_on: null,
              detail: `Race conflict retries exhausted: ${err?.message || String(err)}`,
            });
          }
        }
      }
    }
    return results;
  });

  fastify.post('/leads/dedupe-candidates', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const body = request.body || {};
    const minConf = typeof body.min_confidence === 'number' ? body.min_confidence : 0.7;
    const lim = typeof body.limit === 'number' ? body.limit : 50;
    return findDedupeCandidates(minConf, lim);
  });

  fastify.post('/leads/extract-source', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const body = request.body || {};
    const text = typeof body.text === 'string' ? body.text : '';
    const useLlm = typeof body.use_llm === 'boolean' ? body.use_llm : true;
    return await extractSourceAsync(text, useLlm);
  });

  fastify.get('/leads/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id, 10);
    const row = get('SELECT * FROM leads WHERE id = ?', [id]);
    if (!row) {
      reply.code(404);
      return { error: 'Lead not found' };
    }
    return row;
  });

  fastify.patch('/leads/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id, 10);
    const existing = get('SELECT * FROM leads WHERE id = ?', [id]);
    if (!existing) {
      reply.code(404);
      return { error: 'Lead not found' };
    }
    const parsed = LeadUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid body', issues: parsed.error.issues };
    }
    const data = parsed.data as any;
    const sets: string[] = [];
    const params: any[] = [];
    if (data.status !== undefined) {
      sets.push('lead_status = ?');
      params.push(data.status);
    }
    if (data.owner !== undefined) {
      sets.push('contact_owner = ?');
      params.push(data.owner);
    }
    if (data.notes !== undefined) {
      sets.push('notes = ?');
      params.push(data.notes);
    }
    if (sets.length === 0) {
      reply.code(400);
      return { error: 'No fields to update' };
    }
    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    run(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, params);
    const updated = get('SELECT * FROM leads WHERE id = ?', [id]);
    return updated;
  });

  fastify.get('/leads/:id/extracted-source', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id, 10);
    const row = get('SELECT * FROM leads WHERE id = ?', [id]);
    if (!row) {
      reply.code(404);
      return { error: 'Lead not found' };
    }
    const combinedText = (row.notes || '') + ' ' + (row.original_source || '');
    return await extractSourceAsync(combinedText, true);
  });
}
