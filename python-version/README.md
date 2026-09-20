# Python FastAPI Lead Management System

Sistem manajemen lead (prospek pelanggan) berbasis REST API, dibangun menggunakan **Python 3.11+ + FastAPI 0.110 + SQLite + SQLAlchemy 2.0 + RapidFuzz**. Data di-seed dari file CSV (2049 baris) dengan fitur pencarian duplikat (dedupe), ekstraksi sumber lead, ingestion batch dari form website, dan export CSV.

## 1. Cara Menjalankan

### Persyaratan
- Python **3.11+** (venv direkomendasikan)
- pip v23+

### Langkah-langkah

```bash
# 1. Masuk ke direktori
cd python-version

# 2. (Opsional) Buat virtual environment
python3 -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows

# 3. Install semua dependensi
pip install -r requirements.txt

# 4. Opsional: copy .env.example ke .env dan edit jika perlu
cp .env.example .env
# Default: PORT=8000, DATABASE_URL=sqlite:///./leads.db, OPENAI_API_KEY=(kosong)

# 5. Inisialisasi DB & seed 2049 baris dari ../data/leads_seed.csv
python3 seed_db.py
# Output yang diharapkan:
#   Loaded and cleaned 2049 rows from CSV
#   Rows inserted: 2049
#   Status counts dicetak ke console (new=270, contacted=282, ..., TOTAL=2049)

# 6. Jalankan dev server (uvicorn auto-reload)
python3 -m uvicorn app.main:app --reload --port 8000
# Server berjalan di http://localhost:8000
# Dokumentasi Swagger UI: http://localhost:8000/docs
# Alternatif ReDoc UI: http://localhost:8000/redoc

# 7. Jalankan unit/integration test (pytest)
python3 -m pytest tests/ -v
# Expected: 6 test files | 45 Tests passed
#   - conftest.py          : fixtures (seed_rows, in-memory DB, TestClient)
#   - test_cleaner.py      : 23 tests
#   - test_dedup.py        : 3 tests (with full seed)
#   - test_ingest.py       : 2 tests
#   - test_leads_api.py    : 8 tests
#   - test_source_extract.py: 10 tests

# 8. Jalankan skrip dedup CLI untuk melihat top 30 grup duplikat
python3 run_dedup.py
```

## 2. Design Decisions (Keputusan Arsitektur)

### Framework & Stack
| Komponen | Pilihan | Alasan |
|---|---|---|
| **Web Framework** | **FastAPI 0.110** | Modern async-first, auto-generate OpenAPI docs, Pydantic v2 validation built-in, performa mendekati Node.js/Go untuk IO-bound. |
| **Bahasa** | **Python 3.11+** | Faster CPython, `tomllib` built-in, `typing` native. |
| **Database** | **SQLite + SQLAlchemy 2.0** | Zero-config single-file, SQLAlchemy 2.0 style dengan `Session(bind=engine)` + type-aware queries. `StaticPool` untuk in-memory SQLite test agar tidak hilang koneksi antar thread. |
| **Data Manipulasi** | **pandas 2.x** | Load CSV 2049 baris dengan type inference, drop kolom, rename kolom batch, apply normalizers vectorized (cepat & clean). |
| **String Similarity** | **rapidfuzz 3.x** | Implementasi Cython/Pure-C tercepat di ekosistem Python. `token_sort_ratio` untuk fullname fuzzy, `ratio` untuk company/email tokens. |
| **Validator** | **Pydantic v2** | Schema-first request body & query validation. Infer types otomatis, strict mode parsable. Digunakan di semua route schemas (`LeadBase`, `LeadUpdate`, `IngestPayload`, dll). |
| **API Docs** | **Built-in Swagger UI /docs + ReDoc /redoc** | FastAPI generate otomatis OpenAPI spec. Tidak perlu plugin eksternal. Interactive "Try it out" support. |
| **CORS** | **FastAPI CORSMiddleware** | `allow_origins=["*"]` untuk integrasi frontend local. |
| **Date Parsing** | **python-dateutil** | Parser fleksibel untuk mixed format date (ISO with T, YYYY-MM-DD, M/D/YYYY). |
| **Test Runner** | **pytest 8.x** | Fixture dependency injection, TestClient FastAPI with `get_db` override, in-memory SQLite isolate. |
| **HTTP Client (test)** | **httpx** | Digunakan oleh FastAPI TestClient, async/sync compatible. |

### Dedupe Pipeline Design
Dedup menjalankan 2 stage (sesuai best practice entity resolution):
1. **Stage 1 - Blocking** (reduce quadratic complexity):
   - Group by `phone_digits` (non-null, length >1)
   - Group by `email_local_part + first_initial`
   - Group by `normalized_company_tokens[:3] + country[:2]`
   - Union semua grup, generate pairs (dedupe via canonical `(min(id), max(id))` tuple key). Hasilnya **< 5000 pasangan** untuk 2049 lead (bukan ~4.2M pasangan O(n²)).
2. **Stage 2 - Scoring**:
   - Weighted: `(0.35 * rapidfuzz.token_sort_ratio(fullname_a, fullname_b) + 0.35 * ratio(company_tokens_a, company_tokens_b) + 0.3 * ratio(email_local_a, email_local_b)) / 100`
   - Jika `phone_digits` identik → boost confidence × 1.1 (clamp max 1.0).
   - **Union-Find (Disjoint Set Union / DSU) connected components** untuk merge grup jika ada transitive match (A≈B, B≈C → grup [A,B,C]).
   - Sort grup by `max(confidence)` DESC, lalu `avg(confidence)` DESC.

### Source Extraction Priority
Regex dijalankan dengan urutan prioritas deterministik (mirror logika Node):
1. **Event** (booth, QR, conference, SaaStr, expo...)
2. **Referral** (Referred by First Last)
3. **LinkedIn** (linkedin, DM inbound, commenting...)
4. **Organic Search** (google organic, TANPA "google ad")
5. **Manual/Sales** (Manual added, cold outreach, inbound call...)
6. **Website** (form, booked demo, pricing page, blog...)
7. **Other** + Mock LLM heuristic deterministik (jika text >10 char & use_llm=true). Tidak ada random, semua test reproducible.

### Data Normalization
- `normalize_lead_status`: lowercase + strip whitespace, `Closed Lost` → `closed_lost`, `Closed Won` → `closed_won`, unknown defaults → `new`.
- `normalize_phone_digits`: `re.sub(r'\D', '', raw)` → **hanya digits, tanpa tanda +**.
- `normalize_company_tokens`: lowercase + 10-pass loop strip trailing legal/industry suffix (Co/Ltd/Inc/Holdings/Pte/LLC/...) sampai konvergen. `INDUSTRY_PRESERVE={freight,logistics,trading}` di-enable jika sisa token ≤2.
- `parse_mixed_date`: `dateutil.parser.parse` with fallback, output ISO date string `YYYY-MM-DD`.
- `parse_full_name`: split whitespace, token[0] = first_name, sisanya join = last_name.

## 3. Daftar Endpoint

Base URL: `http://localhost:8000`

### Root
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/` | Health check: `{service: "python-lead-mgmt", port: 8000, docs: "/docs"}` |
| GET | `/docs` | Swagger UI Interactive (Try it out) |
| GET | `/redoc` | ReDoc UI |

### Leads (`/leads`)
| Method | Path | Deskripsi | Query/Body |
|---|---|---|---|
| GET | `/leads` | List lead dengan filter dinamis | `?status=new&owner=Marcus&country=Singapore&q=Acme&limit=100` (default limit 100) |
| GET | `/leads/export` | Export semuanya / filtered ke CSV | Query sama dengan list. Content-Type: `text/csv`, Content-Disposition attachment (`leads_export.csv`) |
| GET | `/leads/{lead_id}` | Get single lead by id | `{lead_id}` integer path |
| PATCH | `/leads/{lead_id}` | Update lead (status/owner/notes) | Body: `{status?, owner?, notes?}` (hanya field non-None yang diupdate via partial PATCH schema) |
| POST | `/leads/ingest` | Batch ingestion dari form website submissions | Body: `IngestPayload[]` (name/email/phone/company/country/message/submitted_at/form_id/form_name/page_url). Return `{action: 'created'|'updated', lead_id, matched_on: 'phone'|'email'|'both'|null}` |
| POST | `/leads/dedupe-candidates` | Jalankan dedup pipeline | Body: `{min_confidence?: 0.7, limit?: 50}`. Return array grup dengan preview. |
| POST | `/leads/extract-source` | Ekstrak source channel dari teks | Body: `{text: str, use_llm?: bool}` → `{channel: SourceChannel, detail: str}` |
| GET | `/leads/{lead_id}/extracted-source` | Ekstrak source dari notes lead tertentu | Ambil notes dari DB lalu jalankan extract_source |

### Dashboard (`/dashboard`)
| Method | Path | Deskripsi | Return |
|---|---|---|---|
| GET | `/dashboard` | Aggregate counts untuk dashboard | `{ by_status: {new: 270, contacted: 282, connected: 293, qualified: 321, opportunity: 291, closed_won: 276, closed_lost: 316}, by_channel: {Website: N, ..., Other: N} }` (sum by_status = 2049; by_channel regex-only) |

## 4. Test Instructions (Cara Menjalankan Test)

```bash
# Full verbose dengan line-length
python3 -m pytest tests/ -v --tb=short

# Hanya test tertentu
python3 -m pytest tests/test_dedup.py -v
python3 -m pytest tests/test_source_extract.py -k "event or linkedin" -v

# Coverage (opsional, jika install pytest-cov)
pip install pytest-cov
python3 -m pytest tests/ --cov=app --cov-report=term-missing
```

Test menjamin:
- **Cleaner**: status normalization 7 enum, phone digits, company token stripping 10-pass, date parsing 3 format, fullname parsing, full CSV 2049 rows count.
- **Leads CRUD**: list + filters + search q, detail 404, PATCH partial 3 fields, export CSV headers.
- **Ingest**: email existing → UPDATE count unchanged; phone unique → CREATE count+1.
- **Dedup**: candidate pairs < 5000 (NOT brute force), known dup ID 100234834+100234835 same group conf≥0.8, full seed runtime <30s.
- **Source Extract**: 10 kasus 7 enum + variations 100% akurasi.

## 5. Catatan tentang LLM (AI)

Secara **DEFAULT LLM dimock secara deterministic** di `extract_source()`:
- Tidak menggunakan OpenAI / API eksternal apapun. `OPENAI_API_KEY` default di `.env.example` dikosongkan.
- Mock LLM hanya berjalan jika regex return `Other` **DAN** len(text) > 10 **DAN** `use_llm=True` (default True).
- Mock LLM heuristic: keyword lookup table deterministic (demo/form→Website, event/conference→Event, dll), fallback → Other.
- **TIDAK ADA `random` di manapun** di mock LLM / dedup pipeline — semua output 100% reproducible.
- Jika ingin integrasi OpenAI sungguhan: uncomment & edit `app/services/source_extract.py` function `_mock_llm_extract()` ganti dengan actual `openai.ChatCompletion.create()` + prompt template. Signature output `{channel, detail}` tetap sama agar routes tidak berubah.

## 6. What's Next (Pengembangan Lebih Lanjut)

1. **Lead merge resolution**: Tambahkan `POST /leads/merge` menerima `{primary_id, secondary_ids[], strategy}` dengan strategy: `latest` (data terbaru), `richest` (field terlengkap), `manual` (user pilih per field).
2. **Pagination & Cursor**: Tambahkan `?page=2&per_page=25` dan `?cursor=last_id` untuk list leads >10k rows.
3. **Authentication RBAC**: Tambahkan `python-jose[cryptography]` JWT bearer + middleware roles (Sales / Sales Ops / Admin) — Sales hanya edit lead miliknya, Admin bisa merge.
4. **Real OpenAI GPT-4o-mini**: Source extraction akurasi lebih tinggi untuk notes naratif panjang. Tambahkan retry with exponential backoff `tenacity`.
5. **Audit trail**: Table `lead_audit_logs(id, lead_id, changed_by, changed_fields JSONB, timestamp UTC)`. Trigger di PATCH dan merge.
6. **Webhook ingest handler**: Endpoint native untuk Typeform / Tally / HubSpot form submissions (verifikasi signature HMAC).
7. **Scheduled dedup worker**: `APScheduler` weekly cron run dedup → generate PDF report → kirim email Sales Ops via `smtplib` / Sendgrid.
8. **Race condition guard**: Saat `POST /leads/ingest` bungkus SELECT+INSERT/UPDATE dalam transaction SERIALIZABLE / tambahkan `INSERT OR IGNORE` + `UPDATE` agar race condition 2 request email sama tidak buat 2 rows.
9. **Lead scoring ML**: `scikit-learn` / `xgboost` train model dari field status historis + source channel → predict conversion probability, tampilkan field `lead_score` di response.
10. **Excel + PDF report export**: `openpyxl` xlsx multi-sheet, `reportlab` PDF summary untuk Sales Ops weekly review.
