import type { SourceChannelType } from '../schema.js';
import OpenAI from 'openai';

const EVENT_REGEX = /booth|QR scan|festival|conference|summit|expo|SaaStr|Mobile World Congress|Singapore FinTech|TechCrunch Disrupt|Money20|20.*Asia|Web Summit|London Tech|Dubai FinTech|Retail Asia|APAC Logistics/i;
const REFERRAL_REGEX = /Referred by [A-Z][a-z]+ [A-Z][a-z]+/;
const LINKEDIN_REGEX = /linkedin|DM inbound|LinkedIn after commenting/i;
const ORGANIC_POSITIVE = /organic google search|googled us|found us through.*google/i;
const ORGANIC_NEGATIVE = /google ad/i;
const MANUAL_REGEX = /Manual.*added|cold outreach|general info@|walked into our office|reached out via.*inbox|inbound phone call/i;
const WEBSITE_REGEX = /filled out the form|booked a demo|form on the|book-a-demo|pricing page|contact page|blog post|homepage|product tour|comparison-vs-hubspot|case study page/i;

const CHANNELS: SourceChannelType[] = ['Website', 'Event', 'LinkedIn', 'Organic Search', 'Referral', 'Manual/Sales', 'Other'];

function findMatchDetail(text: string, regex: RegExp): string | null {
  const m = text.match(regex);
  if (m && m[0]) return m[0];
  return null;
}

function mockLlmClassify(text: string): { channel: SourceChannelType; detail: string } {
  const lower = text.toLowerCase();
  if (/demo|form|contact|pricing|homepage|website|sign.?up|sign up|landing|webinar/i.test(lower)) {
    return { channel: 'Website', detail: 'Website (LLM heuristic - form/demo intent)' };
  }
  if (/event|conference|booth|exhibit|expo|trade.?show/i.test(lower)) {
    return { channel: 'Event', detail: 'Event (LLM heuristic - event keyword)' };
  }
  if (/linkedin|dm|social media|twitter|x\.com|facebook|instagram/i.test(lower)) {
    return { channel: 'LinkedIn', detail: 'LinkedIn (LLM heuristic - social)' };
  }
  if (/search|seo|google|bing|yahoo|keyword|found.*search/i.test(lower)) {
    return { channel: 'Organic Search', detail: 'Organic Search (LLM heuristic - search keyword)' };
  }
  if (/refer|friend|colleague|introduce|word.?of.?mouth/i.test(lower)) {
    return { channel: 'Referral', detail: 'Referral (LLM heuristic - referral keyword)' };
  }
  if (/sales|cold|manual|outreach|phone.?call|call in|added.*by|import|crm/i.test(lower)) {
    return { channel: 'Manual/Sales', detail: 'Manual/Sales (LLM heuristic - sales/outreach)' };
  }
  return { channel: 'Other', detail: 'Other (LLM default - no strong signals)' };
}

export function extractSource(text: string, useLlm: boolean = true): { channel: SourceChannelType; detail: string } {
  const safeText = text || '';
  const eventMatch = findMatchDetail(safeText, EVENT_REGEX);
  if (eventMatch) return { channel: 'Event', detail: `Event: ${eventMatch}` };
  const referralMatch = findMatchDetail(safeText, REFERRAL_REGEX);
  if (referralMatch) return { channel: 'Referral', detail: `Referral: ${referralMatch}` };
  const linkedinMatch = findMatchDetail(safeText, LINKEDIN_REGEX);
  if (linkedinMatch) return { channel: 'LinkedIn', detail: `LinkedIn: ${linkedinMatch}` };
  if (ORGANIC_POSITIVE.test(safeText) && !ORGANIC_NEGATIVE.test(safeText)) {
    const m = safeText.match(ORGANIC_POSITIVE);
    return { channel: 'Organic Search', detail: `Organic Search: ${m ? m[0] : 'google organic'}` };
  }
  const manualMatch = findMatchDetail(safeText, MANUAL_REGEX);
  if (manualMatch) return { channel: 'Manual/Sales', detail: `Manual/Sales: ${manualMatch}` };
  const websiteMatch = findMatchDetail(safeText, WEBSITE_REGEX);
  if (websiteMatch) return { channel: 'Website', detail: `Website: ${websiteMatch}` };
  if (useLlm && safeText.length > 10) {
    return mockLlmClassify(safeText);
  }
  return { channel: 'Other', detail: 'Other (no regex match)' };
}

async function llmExtractReal(text: string): Promise<{ channel: SourceChannelType; detail: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return mockLlmClassify(text);
  try {
    const client = new OpenAI({ apiKey });
    const channelsList = CHANNELS.map(c => `"${c}"`).join(', ');
    const sysPrompt = `You are a lead source classifier. Classify the lead context into EXACTLY ONE channel from this fixed list: [${channelsList}].

RULES:
- Respond ONLY with a raw JSON object. No prose, no markdown fences.
- JSON shape: {"channel": "<exact channel name>", "detail": "<1-8 words of context detail>"}
- Channel name MUST be verbatim one of the 7 options above (case-sensitive).
- If unsure, pick "Other".
`;
    const userPrompt = `Lead context:\n"""\n${text}\n"""\n\nReturn JSON:`;
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = res.choices?.[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(raw);
    const ch = String(parsed.channel || 'Other').trim();
    const validChannel = (CHANNELS as string[]).includes(ch) ? (ch as SourceChannelType) : 'Other';
    const detail = String(parsed.detail || 'GPT-4o-mini classified').trim();
    return { channel: validChannel, detail: `${validChannel}: ${detail}` };
  } catch (err: any) {
    const fallback = mockLlmClassify(text);
    fallback.detail = `${fallback.detail} [GPT fallback: ${err?.message || 'error'}]`;
    return fallback;
  }
}

export async function extractSourceAsync(text: string, useLlm: boolean = true): Promise<{ channel: SourceChannelType; detail: string }> {
  const safeText = text || '';
  const eventMatch = findMatchDetail(safeText, EVENT_REGEX);
  if (eventMatch) return { channel: 'Event', detail: `Event: ${eventMatch}` };
  const referralMatch = findMatchDetail(safeText, REFERRAL_REGEX);
  if (referralMatch) return { channel: 'Referral', detail: `Referral: ${referralMatch}` };
  const linkedinMatch = findMatchDetail(safeText, LINKEDIN_REGEX);
  if (linkedinMatch) return { channel: 'LinkedIn', detail: `LinkedIn: ${linkedinMatch}` };
  if (ORGANIC_POSITIVE.test(safeText) && !ORGANIC_NEGATIVE.test(safeText)) {
    const m = safeText.match(ORGANIC_POSITIVE);
    return { channel: 'Organic Search', detail: `Organic Search: ${m ? m[0] : 'google organic'}` };
  }
  const manualMatch = findMatchDetail(safeText, MANUAL_REGEX);
  if (manualMatch) return { channel: 'Manual/Sales', detail: `Manual/Sales: ${manualMatch}` };
  const websiteMatch = findMatchDetail(safeText, WEBSITE_REGEX);
  if (websiteMatch) return { channel: 'Website', detail: `Website: ${websiteMatch}` };
  if (useLlm && safeText.length > 10 && process.env.OPENAI_API_KEY) {
    return await llmExtractReal(safeText);
  }
  if (useLlm && safeText.length > 10) {
    return mockLlmClassify(safeText);
  }
  return { channel: 'Other', detail: 'Other (no regex match)' };
}

