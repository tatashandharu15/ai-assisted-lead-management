import { z } from 'zod';

export const SourceChannel = z.enum(['Website', 'Event', 'LinkedIn', 'Organic Search', 'Referral', 'Manual/Sales', 'Other']);
export type SourceChannelType = z.infer<typeof SourceChannel>;

export const LeadStatusEnum = z.enum(['new', 'contacted', 'connected', 'qualified', 'opportunity', 'closed_won', 'closed_lost']);
export type LeadStatusType = z.infer<typeof LeadStatusEnum>;

export const LeadUpdateSchema = z.object({
  status: LeadStatusEnum.optional(),
  owner: z.string().optional(),
  notes: z.string().optional()
});
export type LeadUpdateType = z.infer<typeof LeadUpdateSchema>;

export const LeadResponseSchema = z.object({
  id: z.number(),
  record_id: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  full_name: z.string().nullable(),
  job_title: z.string().nullable(),
  company_name: z.string(),
  email: z.string(),
  phone_number: z.string(),
  phone_digits: z.string().nullable(),
  country: z.string(),
  lead_status: z.string(),
  lifecycle_stage: z.string().nullable(),
  original_source: z.string().nullable(),
  contact_owner: z.string(),
  create_date: z.string(),
  last_modified_date: z.string().nullable(),
  notes: z.string(),
  lead_score: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const DedupeCandidateSchema = z.object({
  group_id: z.number(),
  confidence: z.number(),
  lead_ids: z.array(z.number()),
  explanation: z.string(),
  leads_preview: z.array(z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    company: z.string()
  }))
});

export const SourceExtractResultSchema = z.object({
  channel: SourceChannel,
  detail: z.string()
});

export const DashboardResponseSchema = z.object({
  by_status: z.record(z.string(), z.number()),
  by_channel: z.record(SourceChannel, z.number())
});

export const IngestPayloadSchema = z.object({
  name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  submitted_at: z.string().optional().nullable(),
  form_id: z.string().optional().nullable(),
  form_name: z.string().optional().nullable(),
  page_url: z.string().optional().nullable()
}).passthrough();
export type IngestPayloadType = z.infer<typeof IngestPayloadSchema>;
