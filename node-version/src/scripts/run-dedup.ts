import { findDedupeCandidates } from '../services/dedup.js';

async function main() {
  const candidates = await findDedupeCandidates(0.7, 20);
  console.log(`Top ${candidates.length} dedupe groups:\n`);
  for (const g of candidates) {
    console.log(`[Group ${g.group_id}] confidence=${(g.confidence * 100).toFixed(1)}% lead_ids=[${g.lead_ids.join(', ')}]`);
    console.log(`  Explanation: ${g.explanation}`);
    for (const p of g.leads_preview) {
      console.log(`    - #${p.id} ${p.name} <${p.email}> @ ${p.company}`);
    }
    console.log('');
  }
}

main().catch(console.error);
