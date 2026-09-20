import type { FastifyInstance } from 'fastify';
import { all } from '../db.js';
import { extractSource } from '../services/source-extract.js';
import type { SourceChannelType } from '../schema.js';

const STATUSES = ['new', 'contacted', 'connected', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
const CHANNELS: SourceChannelType[] = ['Website', 'Event', 'LinkedIn', 'Organic Search', 'Referral', 'Manual/Sales', 'Other'];

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard', async () => {
    const byStatus: Record<string, number> = {};
    for (const s of STATUSES) byStatus[s] = 0;
    const statusRows = all('SELECT lead_status, COUNT(*) as c FROM leads GROUP BY lead_status') as Array<{ lead_status: string; c: number }>;
    for (const row of statusRows) {
      byStatus[row.lead_status] = Number(row.c);
    }
    const byChannel: Record<SourceChannelType, number> = {
      Website: 0, Event: 0, LinkedIn: 0, 'Organic Search': 0, Referral: 0, 'Manual/Sales': 0, Other: 0
    };
    const noteRows = all('SELECT id, notes FROM leads') as Array<{ id: number; notes: string }>;
    for (const row of noteRows) {
      const { channel } = extractSource(row.notes || '', false);
      byChannel[channel] = (byChannel[channel] || 0) + 1;
    }
    return { by_status: byStatus, by_channel: byChannel };
  });
}
