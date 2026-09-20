# Node.js TypeScript Fastify Lead Management System

Sistem manajemen lead (prospek pelanggan) berbasis REST API, dibangun menggunakan **Node.js + TypeScript + Fastify + SQLite (better-sqlite3)**. Data di-seed dari file CSV (2049 baris) dengan fitur pencarian duplikat (dedupe), ekstraksi sumber lead, ingestion batch dari form website, dan export CSV.

## 1. Cara Menjalankan

### Persyaratan
- Node.js **v20+** (ES Module / NodeNext module resolution)
- npm v9+

### Langkah-langkah

```bash
# 1. Masuk ke direktori
cd node-version

# 2. Install semua dependensi (prod + dev)
npm install --include=dev --legacy-peer-deps

# 3. Opsional: copy .env.example ke .env dan edit jika perlu
cp .env.example .env
# Default: PORT=3000, DATABASE_PATH=./leads.db, OPENAI_API_KEY=(kosong)

# 4. Inisialisasi DB & seed 2049 baris dari ../data/leads_seed.csv
npm run seed
# Output yang diharapkan:
#   Loaded and cleaned 2049 rows from CSV
#   Rows inserted: 2049 (expected 2049)
#   Status counts + Owner counts dicetak ke console

# 5. Jalankan dev server dengan hot-reload (tsx watch)
npm run dev
# Server berjalan di http://localhost:3000
# Dokumentasi Scalar API Reference: http://localhost:3000/reference

# 6. Jalankan unit/integration test (vitest run)
npm test
# Expected: 5 Test Files | 27 Tests passed
#   - cleaner.test.ts      : 7 tests
#   - dedup.test.ts        : 3 tests (with full seed)
#   - ingest.test.ts       : 2 tests
#   - leads.test.ts        : 5 tests
#   - source-extract.test.ts: 10 tests

# 7. Build untuk production (TypeScript -> dist/)
npm run build
npm start

# 8. Jalankan skrip dedup untuk melihat top 20 grup duplikat
npm run dedup
```

## 2. Design Decisions (Keputusan Arsitektur)

### Framework & Stack
| Komponen | Pilihan | Alasan |
|---|---|---|
| **Web Framework** | **Fastify v5** | Performa tinggi (lebih cepat dari Express), built-in JSON schema validation, plugin system yang clean, integrasi Swagger/Scalar tanpa boilerplate. |
| **Bahasa** | **TypeScript v5 (strict, NodeNext)** | Type safety ketat di seluruh pipeline (DB → service → route handler → response). `NodeNext` module resolution kompatibel dengan ESM `import .js` suffix. |
| **Database** | **better-sqlite3 v11** | SQLite synchronous driver native tercepat untuk Node.js. Tanpa TCP overhead, single-file ideal untuk seed/demo. *Transaction-based bulk insert* untuk 2049 baris selesai dalam <50ms. Support in-memory DB (`:memory:`) untuk testing isolate per test-file worker. |
| **CSV Parser** | **papaparse v5** | Sync parse CSV dengan handling quote & newlines yang robust. Banyak digunakan di industri, stabil. |
| **String Similarity** | **fastest-levenshtein v1** | Implementasi Levenshtein distance tercepat di npm (WASM-accelerated). Penting agar stage 2 scoring dedup untuk 2049 baris selesai <30 detik. |
| **Validator** | **zod v3** | Schema-first validation untuk request body & query. Infer TypeScript type otomatis dari schema. Digunakan di PATCH /leads, POST /ingest. |
| **API Docs** | **@fastify/swagger v9 + @scalar/fastify-api-reference v1** | Swagger auto-generate OpenAPI spec dari route, Scalar UI yang modern & interaktif di `/reference`. |
| **CORS** | **@fastify/cors v10** | Allow all origin (`origin: true`) untuk integrasi frontend local. |
| **CSV Export** | **csv-stringify v6 (sync)** | Sinkron export 2049+ baris tanpa callback, memory friendly streaming via sync API. |
| **Test Runner** | **vitest v2** | Native ESM, TypeScript via esbuild tanpa transform lambat. `vitest run` untuk CI. Support in-memory DB dengan mudah. |
| **Dev Runtime** | **tsx v4** | TypeScript execution engine tercepat. `tsx watch` untuk hot reload tanpa restart process penuh. |

### Dedupe Pipeline Design
Dedup menjalankan 2 stage (sesuai best practice entity resolution):
1. **Stage 1 - Blocking** (reduce quadratic complexity):
   - Group by `phone_digits` (non-null, length >1)
   - Group by `email_local_part | first_initial`
   - Group by `normalized_company_token | country[:2]`
   - Union semua grup, generate pairs (dedupe via canonical `minId-maxId` key). Hasilnya **< 5000 pasangan** untuk 2049 lead (bukan ~2 juta pasangan O(n²)).
2. **Stage 2 - Scoring**:
   - Weighted: `(0.35 * name_sim + 0.35 * company_sim + 0.3 * email_local_sim) / 100`
   - Jika phone identik → boost confidence × 1.1 (clamp max 1.0).
   - **Connected components via adjacency list + DFS** untuk merge grup jika ada transitive match (A≈B, B≈C → grup [A,B,C]).
   - Sort grup by `max(confidence)` DESC, lalu `avg(confidence)` DESC.

### Source Extraction Priority
Regex dijalankan dengan urutan prioritas deterministik (mirror logika Python):
1. **Event** (booth, QR, conference, SaaStr, expo...)
2. **Referral** (Referred by First Last)
3. **LinkedIn** (linkedin, DM inbound, commenting...)
4. **Organic Search** (google organic, TANPA "google ad")
5. **Manual/Sales** (Manual added, cold outreach, inbound call...)
6. **Website** (form, booked demo, pricing page, blog...)
7. **Other** + Mock LLM heuristic deterministik (jika text >10 char & use_llm=true). Tidak ada random, semua test reproducible.

### Data Normalization
- `normalizeLeadStatus`: lowercase + trim, `Closed Lost` → `closed_lost`, `Closed Won` → `closed_won`, unknown defaults → `new`.
- `normalizePhoneDigits`: `raw.replace(/\D/g, '')` → **hanya digits, tanpa tanda +**.
- `normalizeCompanyTokens`: lowercase + while-loop strip trailing legal suffix (Co/Ltd/Inc/Holdings/Pte/LLC/dll) sampai konvergen.
- `parseMixedDate`: support ISO with T, YYYY-MM-DD, M/D/YYYY slash format.
- `parseFullName`: split whitespace, token[0] = firstName, sisanya join = lastName.

## 3. Daftar Endpoint

Base URL: `http://localhost:3000`

### Root
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/` | Health check: `{service, port, docs: '/reference'}` |
| GET | `/reference` | Scalar API Reference UI (dengan Swagger auto-generated) |

### Leads (`/leads`)
| Method | Path | Deskripsi | Query/Body |
|---|---|---|---|
| GET | `/leads` | List lead dengan filter dinamis | `?status=new&owner=Marcus&country=Singapore&q=Acme&limit=100` (default limit 100) |
| GET | `/leads/:id` | Get single lead by id | `:id` integer |
| PATCH | `/leads/:id` | Update lead (status/owner/notes) | Body: `{status?, owner?, notes?}` (hanya field non-undefined yang diupdate) |
| GET | `/leads/export` | Export semuanya / filtered ke CSV | Query sama dengan list (Content-Type: `text/csv`, filename `leads_export.csv`) |
| POST | `/leads/ingest` | Batch ingestion dari form website submissions | Body: `IngestPayload[]` (name/email/phone/company/country/message/submitted_at/form_id/form_name/page_url). Return `{action: 'created'\|'updated', lead_id, matched_on: 'phone'\|'email'\|'both'\|null}` |
| POST | `/leads/dedupe-candidates` | Jalankan dedup pipeline | Body: `{min_confidence?: 0.7, limit?: 50}`. Return array grup dengan preview. |
| POST | `/leads/extract-source` | Ekstrak source channel dari teks | Body: `{text: string, use_llm?: boolean}` |
| GET | `/leads/:id/extracted-source` | Ekstrak source dari notes lead tertentu | Ambil notes dari lead id lalu jalankan extractSource |

### Dashboard (`/dashboard`)
| Method | Path | Deskripsi | Return |
|---|---|---|---|
| GET | `/dashboard` | Aggregate counts untuk dashboard | `{ by_status: {new: 270, ..., closed_won: 276}, by_channel: {Website, Event, LinkedIn, Organic Search, Referral, Manual/Sales, Other} }` (sum by_status = 2049; by_channel pakai regex only untuk speed deterministic) |

## 4. Catatan tentang LLM (AI)

Secara **DEFAULT LLM dimock secara deterministic** di `extractSource()`:
- Tidak menggunakan OpenAI / API eksternal apapun.
- Mock LLM hanya berjalan jika regex return `Other` **DAN** text.length > 10 **DAN** `useLlm = true` (default true).
- Mock LLM heuristic: cek keyword (demo/form → Website, event/conference → Event, dll), fallback ke Other.
- **Tidak ada `Math.random()` di manapun** di mock LLM / dedup — semua output 100% reproducible, sehingga test dedup selalu pass.
- Jika ingin integrasi OpenAI sungguhan, `OPENAI_API_KEY` tersedia di `.env.example`. Implementasi actual API call dapat ditambahkan di `src/services/source-extract.ts` tanpa mengubah signature fungsi.

## 5. What's Next (Pengembangan Lebih Lanjut)

1. **Merge endpoint / auto-resolve**: Saat ini dedup hanya *menemukan kandidat*. Tambahkan `POST /leads/merge` yang menerima `{primary_id, secondary_ids[], strategy}` untuk merge field (pilih data terbaru / terlengkap / user diminta memilih).
2. **Pagination lead list**: Saat ini limit top-N. Tambahkan `?cursor=lastId` atau `?page=1&per_page=25` untuk large dataset.
3. **Authorization**: Tambahkan `@fastify/jwt` + middleware RBAC (role Sales hanya bisa edit lead miliknya; Admin bisa merge/dedup).
4. **Real OpenAI integration**: Ganti mock LLM di `source-extract.ts` dengan actual `gpt-4o-mini` untuk klasifikasi source yang lebih akurat pada catatan naratif panjang.
5. **Audit log**: Tambahkan table `lead_audit_logs(id, lead_id, changed_by_user, changed_fields_json, timestamp)` di `PATCH /leads/:id` dan merge.
6. **Webhook ingest**: Endpoint penerima form submission dari Typeform/Tally/HubSpot native.
7. **Dedupe service worker**: Jadwalkan weekly cron `npm run dedup` lalu kirim notifikasi Slack/Email berisi top N grup untuk direview Sales Ops.
8. **Unique constraint guard**: Tambahkan partial index / pre-check pada ingestion sebelum INSERT agar race condition tidak membuat duplikat jika 2 request bersamaan untuk email sama.
9. **Lead scoring ML**: Gunakan field `lead_score` + fitur (status_historical, response_time, source_channel) untuk train model XGBoost dan score otomatis per lead baru via webhook.
10. **Export Excel + PDF**: Tambahkan `exceljs` / `pdf-lib` untuk reporting Sales Ops.
