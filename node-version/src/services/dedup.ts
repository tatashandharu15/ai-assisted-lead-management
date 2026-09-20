import { distance } from 'fastest-levenshtein';
import { all, getDb } from '../db.js';
import { normalizeCompanyTokens } from './cleaner.js';

export function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const max = Math.max(s1.length, s2.length);
  if (max === 0) return 100;
  return Math.max(0, (1 - distance(s1, s2) / max) * 100);
}

export interface DbLead {
  id: number;
  record_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  company_name: string;
  email: string;
  phone_digits: string | null;
  country: string;
}

export function getAllLeadsForDedup(dbPath?: string): DbLead[] {
  return all(
    'SELECT id, record_id, first_name, last_name, full_name, company_name, email, phone_digits, country FROM leads',
    [],
    dbPath
  ) as DbLead[];
}

function getFullName(l: DbLead): string {
  if (l.first_name && l.last_name) {
    const s = (l.first_name + ' ' + l.last_name).trim();
    if (s) return s;
  }
  return (l.full_name || '').trim();
}

export async function findDedupeCandidates(minConfidence: number = 0.7, limit?: number, dbPath?: string): Promise<any[]> {
  const leads = getAllLeadsForDedup(dbPath);

  const phoneGroups = new Map<string, number[]>();
  const emailNameGroups = new Map<string, number[]>();
  const companyCountryGroups = new Map<string, number[]>();

  for (let i = 0; i < leads.length; i++) {
    const l = leads[i];
    if (l.phone_digits && l.phone_digits.length >= 5) {
      if (!phoneGroups.has(l.phone_digits)) phoneGroups.set(l.phone_digits, []);
      phoneGroups.get(l.phone_digits)!.push(i);
    }
    const emailLocal = (l.email || '').split('@')[0] || '';
    const firstInitial = ((l.first_name || l.full_name || '')[0] || '').toLowerCase();
    if (emailLocal && firstInitial) {
      const enKey = emailLocal.toLowerCase() + '|' + firstInitial;
      if (!emailNameGroups.has(enKey)) emailNameGroups.set(enKey, []);
      emailNameGroups.get(enKey)!.push(i);
    }
    const compTok = normalizeCompanyTokens(l.company_name).slice(0, 3);
    const ccKey = compTok + '|' + (l.country || '').slice(0, 2).toLowerCase();
    if (compTok && (l.country || '').slice(0, 2)) {
      if (!companyCountryGroups.has(ccKey)) companyCountryGroups.set(ccKey, []);
      companyCountryGroups.get(ccKey)!.push(i);
    }
  }

  const pairSet = new Set<string>();
  const pairs: Array<[number, number]> = [];

  function addPairsFromGroups(groups: Map<string, number[]>) {
    for (const indices of groups.values()) {
      if (indices.length > 1) {
        for (let a = 0; a < indices.length; a++) {
          for (let b = a + 1; b < indices.length; b++) {
            const i = indices[a];
            const j = indices[b];
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (!pairSet.has(key)) {
              pairSet.add(key);
              pairs.push([i, j]);
            }
          }
        }
      }
    }
  }

  addPairsFromGroups(phoneGroups);
  addPairsFromGroups(emailNameGroups);
  addPairsFromGroups(companyCountryGroups);

  const scoredPairs: Array<{ i: number; j: number; confidence: number; nameSim: number; compSim: number; emailLocalSim: number; phoneIdentical: boolean }> = [];

  for (const [i, j] of pairs) {
    const L1 = leads[i];
    const L2 = leads[j];
    const name1 = getFullName(L1).toLowerCase();
    const name2 = getFullName(L2).toLowerCase();
    const scoreName = similarity(name1, name2);
    const comp1 = normalizeCompanyTokens(L1.company_name);
    const comp2 = normalizeCompanyTokens(L2.company_name);
    const scoreCompany = similarity(comp1, comp2);
    const el1 = (L1.email.split('@')[0] || '').toLowerCase();
    const el2 = (L2.email.split('@')[0] || '').toLowerCase();
    const scoreEmailLocal = similarity(el1, el2);
    let confidence = (0.35 * scoreName + 0.35 * scoreCompany + 0.3 * scoreEmailLocal) / 100;
    const phoneIdentical = !!(L1.phone_digits && L1.phone_digits === L2.phone_digits);
    if (phoneIdentical) {
      confidence = Math.min(1, confidence * 1.1);
    }
    if (confidence >= minConfidence) {
      scoredPairs.push({ i, j, confidence, nameSim: scoreName, compSim: scoreCompany, emailLocalSim: scoreEmailLocal, phoneIdentical });
    }
  }

  const adjacency: Map<number, Array<{ node: number; confidence: number; pair: any }>> = new Map();
  for (const sp of scoredPairs) {
    const id1 = leads[sp.i].id;
    const id2 = leads[sp.j].id;
    if (!adjacency.has(id1)) adjacency.set(id1, []);
    if (!adjacency.has(id2)) adjacency.set(id2, []);
    adjacency.get(id1)!.push({ node: id2, confidence: sp.confidence, pair: sp });
    adjacency.get(id2)!.push({ node: id1, confidence: sp.confidence, pair: sp });
  }

  const visited = new Set<number>();
  const groups: Array<{ lead_ids: number[]; maxConfidence: number; avgConfidence: number; pairs: any[] }> = [];

  for (const sp of scoredPairs) {
    const id1 = leads[sp.i].id;
    if (visited.has(id1)) continue;
    const stack = [id1];
    const component: number[] = [];
    const compPairs: any[] = [];
    const pairConf: number[] = [];
    while (stack.length) {
      const n = stack.pop()!;
      if (visited.has(n)) continue;
      visited.add(n);
      component.push(n);
      const neighbors = adjacency.get(n) || [];
      for (const nb of neighbors) {
        compPairs.push(nb.pair);
        pairConf.push(nb.confidence);
        if (!visited.has(nb.node)) {
          stack.push(nb.node);
        }
      }
    }
    if (component.length >= 2) {
      const maxC = pairConf.length ? Math.max(...pairConf) : 0;
      const avgC = pairConf.length ? pairConf.reduce((a, b) => a + b, 0) / pairConf.length : 0;
      groups.push({ lead_ids: component.sort((a, b) => a - b), maxConfidence: maxC, avgConfidence: avgC, pairs: compPairs });
    }
  }

  groups.sort((a, b) => {
    if (b.maxConfidence !== a.maxConfidence) return b.maxConfidence - a.maxConfidence;
    return b.avgConfidence - a.avgConfidence;
  });

  const limitedGroups = limit ? groups.slice(0, limit) : groups;
  const leadById = new Map<number, DbLead>();
  for (const l of leads) leadById.set(l.id, l);

  const result: any[] = [];
  for (let gIdx = 0; gIdx < limitedGroups.length; gIdx++) {
    const g = limitedGroups[gIdx];
    const leadsPreview = g.lead_ids.map((lid) => {
      const l = leadById.get(lid)!;
      return {
        id: lid,
        name: getFullName(l) || l.email,
        email: l.email,
        company: l.company_name
      };
    });
    const topPair = g.pairs.sort((a, b) => b.confidence - a.confidence)[0];
    const nSim = topPair ? Math.round(topPair.nameSim) : 0;
    const cSim = topPair ? Math.round(topPair.compSim) : 0;
    const pIdent = topPair ? topPair.phoneIdentical : false;
    const explanation = `Match signals: phone_identical=${pIdent}, name_sim=${nSim}%, company_sim=${cSim}%`;
    result.push({
      group_id: gIdx + 1,
      confidence: g.maxConfidence,
      lead_ids: g.lead_ids,
      explanation: explanation,
      leads_preview: leadsPreview
    });
  }
  return result;
}
