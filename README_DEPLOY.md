# Deploy QC App ke Cloudflare Pages + Supabase

## Struktur Final

- `index.html` - frontend static
- `styles.css` - desain aplikasi
- `app.js` - workflow QC + Supabase client
- `config.js` - konfigurasi Supabase untuk browser
- `config.example.js` - contoh konfigurasi
- `.env.example` - referensi environment variable
- `supabase/schema.sql` - tabel, RLS policy, dan Storage bucket

`server.mjs` dan `database.json` sudah tidak dipakai.

## 1. Setup Supabase

1. Buka [Supabase](https://supabase.com), buat project gratis.
2. Masuk ke `SQL Editor`.
3. Copy isi `supabase/schema.sql`.
4. Klik `Run`.
5. Masuk ke `Authentication > Providers > Email`.
6. Untuk login username sederhana, matikan `Confirm email`.
   Aplikasi mempertahankan UI `Nama Akun`; di belakang layar nama akun dikonversi menjadi email internal seperti `qc-shift-1@cvputrafarma-qc.local`.
7. Masuk ke `Project Settings > API`.
8. Copy `Project URL` dan `anon public key`.

Supabase Auth menyimpan session di browser secara otomatis. Supabase JS client default-nya memang menyimpan session di local storage dan auto-refresh token.

## 2. Isi Konfigurasi

Edit `config.js`:

```js
window.SUPABASE_CONFIG = {
  url: "https://PROJECT_REF.supabase.co",
  anonKey: "PASTE_ANON_PUBLIC_KEY",
  storageBucket: "qc-attachments",
};
```

Jangan gunakan `service_role key` di frontend.

## 3. Deploy ke Cloudflare Pages

1. Upload project ini ke GitHub.
2. Buka Cloudflare Dashboard.
3. Masuk ke `Workers & Pages`.
4. Pilih `Create application > Pages > Connect to Git`.
5. Pilih repository.
6. Build command: kosongkan, atau isi `exit 0`.
7. Build output directory: `/` atau root project.
8. Deploy.

Cloudflare Pages mendukung static site tanpa build command. Dokumentasi Cloudflare juga menyebut build command bisa dikosongkan untuk project tanpa framework.

## 4. Cara Pakai

1. Buka URL Cloudflare Pages.
2. Klik `Daftar Baru`.
3. Buat nama akun dan password.
4. Login.
5. Input laporan, upload foto/dokumen, QC review, ACC/revisi seperti workflow sebelumnya.

## Catatan Gratis

Arsitektur ini memakai:

- Cloudflare Pages free untuk hosting static
- Supabase free untuk Auth, Database PostgreSQL, dan Storage

Jika file foto/dokumen makin besar, pantau limit storage Supabase.
