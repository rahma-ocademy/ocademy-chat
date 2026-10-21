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

- **Inbox Chat** (`/chat`): tab Assigned / Unassigned / Resolved dengan jumlah, filter agen (Semua/Saya/agen), cari nama/nomor, filter inbox & label, toggle belum dibaca; panel percakapan (riwayat, balas, **catatan internal**), panel detail (kontak, assign, label, selesai/buka lagi); onboarding saat kosong; pembaruan **realtime** (Supabase Realtime, jatuh ke polling bila tidak tersedia). Membalas percakapan yang belum di-assign otomatis mengambilnya; pesan masuk membuka lagi percakapan yang selesai.
- **Platform terhubung** (`/connected-platforms`, pola "Connected Platforms" Cekat): daftar inbox + panel pengaturan per inbox (nama, aktif, **AI agent**, **agen yang menangani**), pilih platform saat membuat inbox.
  - **WhatsApp Coexistence**: nomor WhatsApp Business App yang sudah ada tetap dipakai di HP; chat masuk ke inbox, balasan dari HP ikut tercatat ("via HP"), kontak & riwayat diminta sinkron. Cekat tidak menawarkan ini (nomor harus dimigrasi penuh).
  - **WhatsApp WABA (Cloud API)**: lewat Meta Embedded Signup (+ PIN 2 langkah), atau manual dengan token System User (untuk nomor uji Meta).
  - Webhook `/api/webhooks/whatsapp` (verifikasi tanda tangan, idempoten per `wamid`), status kirim (terkirim/dibaca/gagal + alasan), balasan agen dikirim langsung lewat Cloud API.
  - **Web Live Chat** + **widget publik** (`/w/{key}`): pelanggan bisa chat tanpa login (token acak di browser; database hanya menyimpan hash-nya).
  - Balasan pelanggan **menghentikan follow-up** yang menunggu untuk nomornya (aturan *stop on reply*).
- **Pengguna** (`/settings/users`): anggota aktif / undangan pending / nonaktif / seat terpakai; undang dengan peran (Admin/Agen) + izin global (Pengguna, Usage & paket, Keamanan: tanpa akses / lihat / kelola); link undangan 7 hari dengan jeda kirim ulang; ubah izin; nonaktifkan (percakapannya dilepas). Halaman terima undangan `/invite/{token}` (email harus cocok) dan pemilih bisnis bila tergabung di beberapa bisnis.
- **AI agent** (`/ai-agents`): perilaku (sambutan, preset gaya, cara komunikasi, alur, aturan, instruksi bersyarat), pengetahuan (teks & tanya-jawab), routing (alihkan ke manusia, label otomatis), konfigurasi (batas riwayat/konteks, kreativitas, jeda, batas pesan, zona waktu). **Hanya konfigurasi** — belum ada LLM yang membalas.
- **Onboarding 4 langkah** di Inbox kosong (sama dengan Cekat): buat AI agent → hubungkan platform → undang agen → hubungkan AI agent ke inbox.
- **Auth & multi-bisnis**: daftar/masuk (Supabase Auth), bisnis dibuat otomatis, semua tabel dilindungi RLS per bisnis.
- **Paket & kuota**: tabel `plans`/`subscriptions`/`usage_counters`, gating fitur (`can`) dan pemotongan kuota atomik (`consume_usage`), halaman Usage.
- **Followups**: daftar aturan + toggle aktif, wizard 4 langkah (pemicu → template & jeda → jadwal & aturan berhenti → ringkasan), template dengan pratinjau.
- **Mesin follow-up**: event masuk (idempoten) → jadwalkan job → batalkan job saat event berhenti (mis. `order.paid`) → worker mengirim job yang jatuh tempo (jam kirim, batas harian, variabel wajib terisi). Bila ada inbox WhatsApp terhubung, pesan dikirim lewat Cloud API (template Meta bila `wa_template_name` diisi) dan muncul di percakapan kontak; bila tidak, masuk `outbox_messages` seperti sebelumnya.
- **Open API untuk pihak ketiga** (`/api/v1`): `POST /events`, `GET|POST /followup-templates`, `GET|PATCH|DELETE /followup-templates/{id}`, `POST /followup-templates/{id}/preview`. Autentikasi API key ber-scope.
- **OrderOnline**: hubungkan lewat Open API Token, impor 11 template follow-up + 4 template pengiriman (aturan dibuat **nonaktif**), URL webhook per integrasi.

## Yang belum ada / perlu kamu tahu

- **WhatsApp belum diuji ke Meta sungguhan.** Kode mengikuti dokumentasi Meta (Embedded Signup, `subscribed_apps`, `register`, `smb_app_data`, webhook `messages` / `smb_message_echoes`), tapi belum dijalankan dengan Meta App, nomor, atau webhook asli. Payload webhook diuji dengan contoh buatan sendiri.
- **Jendela 24 jam WhatsApp**: di luar 24 jam sejak pesan terakhir pelanggan, Meta hanya menerima template yang disetujui. Balasan agen di luar jendela gagal dengan alasan yang jelas; follow-up butuh `wa_template_name` + `wa_param_map` (`{"1":"customer_name"}`) di template.
- **Coexistence**: riwayat chat & kontak hasil sinkron disimpan mentah di `channel_webhook_events` (belum diimpor ke percakapan). Syarat dan batasan Coexistence (versi app, negara, fitur yang tidak ikut) ditentukan Meta — cek dokumentasi Meta sebelum dipakai produksi.
- **Undangan tidak dikirim lewat email**: link undangan ditampilkan sekali untuk disalin dan dikirim manual (Cekat mengirim email).
- **AI agent belum menjawab** (tidak ada LLM/RAG). Tab Followups, Integrations, Orchestration, Evaluation Cekat belum dibuat; sumber pengetahuan Website/File/Product belum ada.
- **Belum saya jalankan terhadap Supabase atau OrderOnline sungguhan.** Yang sudah diverifikasi: typecheck, lint, unit test (jadwal, render, kondisi, telepon, impor OrderOnline, webhook OrderOnline & WhatsApp, filter inbox, izin & undangan, konfigurasi AI), build produksi. Ketiga migrasi dijalankan di **PGlite** (Postgres WASM) dengan stub skema `auth` Supabase, plus uji RLS/constraint `0003` (lihat bagian Verifikasi) — bukan Supabase asli.
- **Partner API key OrderOnline** hanya diberikan OrderOnline kepada partner. Tanpa itu, tombol hubungkan menampilkan penjelasan, bukan error mentah.
- **Format payload webhook OrderOnline tidak terdokumentasi publik.** Pemetaan di `src/lib/orderonline/webhook.ts` adalah asumsi. Payload yang tidak dikenali tetap disimpan sebagai event `orderonline.unmapped` (kolom `raw`) supaya format aslinya bisa dilihat, lalu pemetaan disesuaikan.
- **Sinkron progres ke OrderOnline** (`PUT /submissions/:id/progress`) dimatikan; isi request-nya belum jelas. Aktifkan dengan `ORDERONLINE_SYNC_PROGRESS=true` hanya setelah dikonfirmasi.
- **Pesan ganda**: OrderOnline tidak punya API untuk mematikan auto-WA-nya. Karena itu aturan hasil impor nonaktif; matikan auto-WA di OrderOnline sebelum mengaktifkan aturan yang sama di sini.
- **Widget livechat belum punya rate limiting.** Pasang pembatas di depan (CDN/edge) sebelum link widget dibagikan luas.
- Inbox belum punya: pilih-banyak/bulk edit, mulai chat baru dari agen, WhatsApp group, snooze, saved view, kirim lampiran/media (media masuk tampil sebagai label, mis. "[Gambar] caption"), indikator mengetik. Area percakapan Cekat tidak bisa diamati saat riset (akun kosong), jadi bagian ini dirancang dari endpoint & feature flag Cekat ditambah praktik umum — lihat `RISET.md` §5c.
- Belum ada: rate limiting API, penggantian paket dari UI, edit aturan (hanya buat/hapus/toggle), halaman log event, sub-menu Chat lainnya (Quick Replies, Labels sebagai halaman, SLA, CSAT, dst.), divisi/tim, auto-assign ke agen inbox, platform Instagram/Messenger/TikTok/Telegram/Email.
- **Paket Free tidak termasuk WhatsApp** (`plans.limits.waba_count = 0`). Untuk uji: `update subscriptions set plan_id = 'plan_1' where business_id = '…';`

## Menjalankan lokal

Butuh Node **24.18.0** (`nvm use`).

```bash
npm ci
cp .env.example .env.local   # isi nilainya (lihat di bawah)
npm run dev                  # http://localhost:3000
```

### 1. Siapkan Supabase

1. Buat project di <https://supabase.com>.
2. Buka **SQL Editor**, jalankan berurutan [`0001_init.sql`](supabase/migrations/0001_init.sql), [`0002_inbox.sql`](supabase/migrations/0002_inbox.sql), lalu [`0003_platforms_team_ai.sql`](supabase/migrations/0003_platforms_team_ai.sql) (atau `supabase db push` bila memakai Supabase CLI). `0002` juga menambahkan tabel `messages` dan `conversations` ke publikasi Realtime.
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
| `NEXT_PUBLIC_APP_URL` | URL publik, dipakai untuk URL webhook dan link undangan |
| `META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID` | Meta App untuk WhatsApp Embedded Signup; App Secret juga memverifikasi webhook |
| `WHATSAPP_VERIFY_TOKEN` | string bebas, sama dengan *Verify token* webhook di Meta App |
| `META_GRAPH_VERSION`, `WHATSAPP_TEMPLATE_LANGUAGE` | opsional (default `v23.0`, `id`) |

### 3. Coba Inbox ujung ke ujung

1. Masuk → **Platform terhubung** → **+ Inbox baru** → **Web Live Chat** → pilih inbox → **Buka widget uji** (tab baru).
2. Di widget, kirim pesan sebagai pelanggan (isi nomor WhatsApp bila ingin menguji penghentian follow-up).
3. Kembali ke **Inbox**: percakapan muncul di tab *Unassigned*; buka, balas, beri label, tandai selesai. Balasan muncul di widget (polling 3 detik).

### 4. Hubungkan WhatsApp

1. Buat Meta App (tipe Business) dengan produk **WhatsApp** dan **Facebook Login for Business**; buat konfigurasi *WhatsApp Embedded Signup* → isi `META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID`. Domain aplikasi harus terdaftar di pengaturan Login (Embedded Signup butuh HTTPS).
2. Meta App → WhatsApp → **Configuration** → Webhook: URL `https://DOMAIN/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`. Langganan field `messages`; untuk Coexistence juga `smb_message_echoes`, `history`, `smb_app_state_sync`.
3. Di aplikasi: **Platform terhubung → + Inbox baru → WhatsApp Business App (Coexistence)** atau **WABA**.

URL yang diisi di Meta App (ganti `DOMAIN` dengan domain HTTPS aplikasi, mis. `ocademy-chat.vercel.app`):

| Pengaturan Meta App | Nilai |
|---|---|
| App settings → Basic → App Domains | `DOMAIN` |
| App settings → Basic → Privacy Policy URL | `https://DOMAIN/privacy` |
| App settings → Basic → User data deletion (Data Deletion Instructions URL) | `https://DOMAIN/privacy#hapus-data` |
| Facebook Login for Business → Settings → Valid OAuth Redirect URIs | `https://DOMAIN/auth/meta/callback` |
| Facebook Login for Business → Settings → Allowed Domains for the JavaScript SDK | `https://DOMAIN` |
| WhatsApp → Configuration → Callback URL (webhook) | `https://DOMAIN/api/webhooks/whatsapp` |

Embedded Signup memakai popup JS SDK, jadi `code` ditukar tanpa `redirect_uri`; `/auth/meta/callback` adalah cadangan bila Meta mengarahkan ke redirect URI.
   Tanpa Embedded Signup, WABA bisa dihubungkan manual (Phone number ID, WABA ID, token System User) — cocok untuk nomor uji dari Meta App Dashboard.

### 5. Worker

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
  app/(app)/               chat (inbox), connected-platforms, ai-agents, settings/users, followups, templates, integrations, usage
  app/w/[key]/             widget livechat publik
  app/invite/[token]/      terima undangan tim
  app/api/                 v1 (Open API), public/livechat, webhooks/orderonline, webhooks/whatsapp, cron
  lib/auth.ts              Data Access Layer (pengguna + bisnis aktif)
  lib/followups/           variables, schedule, conditions (murni, diuji) + engine (server)
  lib/inbox/               filters (murni, diuji) + queries (server)
  lib/orderonline/         client, import, webhook mapper, sync
  lib/whatsapp/            webhook (parser murni, diuji), graph (Cloud API), channel (simpan/kirim), connect
  lib/team/                permissions & invites (murni, diuji), seats
  lib/ai/config.ts         skema konfigurasi AI agent (murni, diuji)
  lib/plans.ts, apikeys.ts, crypto.ts
supabase/migrations/       skema + RLS
```

Aturan yang dipegang kode: kolom koneksi WhatsApp (`wa_phone_number_id`, mode, tipe `whatsapp`) tidak bisa ditulis dari browser (grant kolom + RLS) — hanya server setelah verifikasi ke Meta; pengaturan inbox & AI agent hanya owner/admin (RLS `is_admin`); anggota nonaktif kehilangan akses lewat `is_member`; logika murni (jadwal, render, kondisi, pemetaan) dipisah dari I/O supaya bisa diuji; klien `service_role` hanya dipakai di kode server tepercaya; pengguna selalu lewat klien ber-RLS; rahasia (token OrderOnline) terenkripsi dan tidak pernah dikirim ke browser.

## Perintah

```bash
npm run dev         # server pengembangan
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
npm test            # vitest
npm run build
```

Riset dan keputusan desain: lihat repo riset terpisah (`riset-cekat/RISET.md`).
