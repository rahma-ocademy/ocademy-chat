# ocademy chat

Follow-up otomatis dan template pesan untuk percakapan pelanggan, dengan integrasi OrderOnline dan Open API untuk aplikasi pihak ketiga.

Frontend dan backend dalam **satu aplikasi Next.js** (App Router). Data, autentikasi, dan isolasi antar bisnis memakai **Supabase** (Postgres + Auth + RLS).

## Stack

| Lapisan | Pilihan |
|---|---|
| Aplikasi | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Gaya | Tailwind CSS v4 + token gaya ocademy.id (DM Sans, navy `#293867`, tosca) |
| Data & auth | Supabase (Postgres, Auth, Row Level Security) |
| Validasi | zod |
| Test | vitest |

## Yang sudah ada (MVP tahap A + Followups)

- **Auth & multi-bisnis**: daftar/masuk (Supabase Auth), bisnis dibuat otomatis, semua tabel dilindungi RLS per bisnis.
- **Paket & kuota**: tabel `plans`/`subscriptions`/`usage_counters`, gating fitur (`can`) dan pemotongan kuota atomik (`consume_usage`), halaman Usage.
- **Followups**: daftar aturan + toggle aktif, wizard 4 langkah (pemicu → template & jeda → jadwal & aturan berhenti → ringkasan), template dengan pratinjau.
- **Mesin follow-up**: event masuk (idempoten) → jadwalkan job → batalkan job saat event berhenti (mis. `order.paid`) → worker mengirim job yang jatuh tempo (jam kirim, batas harian, variabel wajib terisi).
- **Open API untuk pihak ketiga** (`/api/v1`): `POST /events`, `GET|POST /followup-templates`, `GET|PATCH|DELETE /followup-templates/{id}`, `POST /followup-templates/{id}/preview`. Autentikasi API key ber-scope.
- **OrderOnline**: hubungkan lewat Open API Token, impor 11 template follow-up + 4 template pengiriman (aturan dibuat **nonaktif**), URL webhook per integrasi.

## Yang belum ada / perlu kamu tahu

- **Pengiriman WhatsApp belum terpasang.** Worker menaruh pesan ke tabel `outbox_messages` (status `queued`). Job ditandai `sent` artinya *sudah masuk antrean keluar*, bukan terkirim ke pelanggan. Driver kanal (WhatsApp Cloud API) adalah langkah berikutnya.
- **Belum pernah dijalankan terhadap Supabase atau OrderOnline sungguhan.** Yang sudah diverifikasi: typecheck, lint, 25 unit test (jadwal, render, kondisi, telepon, impor OrderOnline, webhook), build produksi, dan perilaku HTTP yang tidak butuh database (redirect auth, penolakan API tanpa kunci). Migrasi SQL baru divalidasi sintaksnya dengan parser Postgres, belum dieksekusi.
- **Partner API key OrderOnline** hanya diberikan OrderOnline kepada partner. Tanpa itu, tombol hubungkan menampilkan penjelasan, bukan error mentah.
- **Format payload webhook OrderOnline tidak terdokumentasi publik.** Pemetaan di `src/lib/orderonline/webhook.ts` adalah asumsi. Payload yang tidak dikenali tetap disimpan sebagai event `orderonline.unmapped` (kolom `raw`) supaya format aslinya bisa dilihat, lalu pemetaan disesuaikan.
- **Sinkron progres ke OrderOnline** (`PUT /submissions/:id/progress`) dimatikan; isi request-nya belum jelas. Aktifkan dengan `ORDERONLINE_SYNC_PROGRESS=true` hanya setelah dikonfirmasi.
- **Pesan ganda**: OrderOnline tidak punya API untuk mematikan auto-WA-nya. Karena itu aturan hasil impor nonaktif; matikan auto-WA di OrderOnline sebelum mengaktifkan aturan yang sama di sini.
- Belum ada: rate limiting API, penggantian paket dari UI, edit aturan (hanya buat/hapus/toggle), halaman log event, sub-menu Chat lainnya (Quick Replies, Labels, SLA, CSAT, dst.), inbox.

## Menjalankan lokal

Butuh Node **24.18.0** (`nvm use`).

```bash
npm ci
cp .env.example .env.local   # isi nilainya (lihat di bawah)
npm run dev                  # http://localhost:3000
```

### 1. Siapkan Supabase

1. Buat project di <https://supabase.com>.
2. Buka **SQL Editor**, tempel dan jalankan isi [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) (atau `supabase db push` bila memakai Supabase CLI).
3. **Project Settings → API**: salin `Project URL`, kunci `anon`/publishable, dan `service_role` ke `.env.local`.
4. **Authentication → Providers → Email**: untuk uji lokal cepat, matikan *Confirm email*. Bila dibiarkan aktif, bisnis dibuat otomatis saat login pertama setelah konfirmasi.

### 2. Env

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | dari Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **hanya server**, melewati RLS (webhook, worker, API key) |
| `APP_ENCRYPTION_KEY` | `openssl rand -base64 32`; mengenkripsi token OrderOnline (AES-256-GCM) |
| `CRON_SECRET` | melindungi `/api/cron/process-followups` |
| `ORDERONLINE_PARTNER_API_KEY` | dari OrderOnline (khusus partner) |
| `NEXT_PUBLIC_APP_URL` | URL publik, dipakai untuk menampilkan URL webhook |

### 3. Worker

Job jatuh tempo diproses dengan memanggil endpoint ini secara berkala (mis. tiap menit lewat cron platform):

```bash
curl -X POST http://localhost:3000/api/cron/process-followups -H "Authorization: Bearer $CRON_SECRET"
```

## Open API

Buat kunci di **Integrasi & API**. Semua respons error: `{ "error": { "code", "message", "details?" } }`.

```bash
# Kirim event (Idempotency-Key wajib)
curl -X POST $APP/api/v1/events \
  -H "Authorization: Bearer ock_live_…" -H "Idempotency-Key: order-INV-1-created" \
  -H "Content-Type: application/json" \
  -d '{"type":"order.created","contact":{"phone":"0812…","name":"Rani"},"data":{"order_id":"INV-1","total":"Rp149.000"}}'
```

| Scope | Izin |
|---|---|
| `events:write` | `POST /api/v1/events` |
| `templates:read` | `GET /api/v1/followup-templates`, `…/{id}`, `…/{id}/preview` |
| `templates:write` | `POST`, `PATCH`, `DELETE` — hanya template milik integrasi pemanggil |

Daftar template memakai paging `?page&per_page` dan mengembalikan `{ data, meta: { page, per_page, total, total_pages } }`.

## Struktur

```
src/
  proxy.ts                 sesi Supabase + redirect optimistis (pengganti middleware di Next 16)
  app/(auth)/              login, daftar
  app/(app)/               followups, templates, integrations, usage
  app/api/                 v1 (Open API), webhooks/orderonline, cron
  lib/auth.ts              Data Access Layer (pengguna + bisnis aktif)
  lib/followups/           variables, schedule, conditions (murni, diuji) + engine (server)
  lib/orderonline/         client, import, webhook mapper, sync
  lib/plans.ts, apikeys.ts, crypto.ts
supabase/migrations/       skema + RLS
```

Aturan yang dipegang kode: logika murni (jadwal, render, kondisi, pemetaan) dipisah dari I/O supaya bisa diuji; klien `service_role` hanya dipakai di kode server tepercaya; pengguna selalu lewat klien ber-RLS; rahasia (token OrderOnline) terenkripsi dan tidak pernah dikirim ke browser.

## Perintah

```bash
npm run dev         # server pengembangan
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
npm test            # vitest
npm run build
```

Riset dan keputusan desain: lihat repo riset terpisah (`riset-cekat/RISET.md`).
