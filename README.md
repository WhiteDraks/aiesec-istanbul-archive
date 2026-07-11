# AIESEC İstanbul Alumni Archive

AIESEC İstanbul Executive Board arşiv web sitesi. Geçmiş EB dönemlerini, üyelerini, görevlerini ve hikayelerini sergiliyor.

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Environment Variables
`.env.example` dosyasını `.env` olarak kopyala:
```bash
cp .env.example .env
```

`.env` içeriği:
```env
POSTGRES_URL=postgres://user:password@host.neon.tech/dbname?sslmode=require
SESSION_SECRET=uzun-ve-gizli-bir-anahtar-buraya
PORT=3000
NODE_ENV=development
```

### 3. Veritabanı — Vercel Postgres (Neon)

**Vercel Dashboard üzerinden:**
1. [vercel.com](https://vercel.com) → Projen → **Storage** sekmesi
2. **Create Database** → **Postgres (Neon)** → Free tier seç
3. Oluşturunca `.env.local` sekmesindeki `POSTGRES_URL` değerini kopyala
4. `.env` dosyana yapıştır

**Veya Neon üzerinden doğrudan:**
1. [neon.tech](https://neon.tech) → Free hesap
2. New Project → Connection string (pooled) kopyala

### 4. Demo Verileri Yükle
```bash
npm run seed
```
Bu komut:
- Tüm tabloları oluşturur (users, eb_teams, eb_members, session)
- Admin hesabı: `admin@aiesec-istanbul.com` / `Admin1234!`
- 3 EB takımı (2022-23, 2024-25, 2026-27)
- 2026-27 için 8 demo üye (Elif Kurnaz en sonda)

### 5. Uygulamayı Başlat
```bash
npm run dev    # geliştirme (nodemon)
npm start      # production
```
→ http://localhost:3000

---

## 🏗 Proje Yapısı

```
├── server.js              # Express uygulama
├── vercel.json            # Vercel deployment config
├── config/
│   └── database.js        # Mongoose serverless bağlantı
├── models/
│   ├── User.js            # Kullanıcı modeli
│   ├── EBTeam.js          # EB takım modeli
│   └── EBMember.js        # EB üyesi modeli
├── routes/
│   ├── index.js           # Ana sayfa
│   ├── auth.js            # Kayıt/Giriş/Çıkış
│   ├── eb.js              # EB sayfaları
│   └── admin.js           # Admin paneli
├── middleware/
│   └── auth.js            # Auth middleware
├── views/                 # EJS şablonları
│   ├── layout/            # Header & Footer
│   ├── eb/                # EB sayfaları
│   ├── auth/              # Kayıt & Giriş
│   └── admin/             # Admin paneli
├── public/
│   ├── css/style.css      # Tüm CSS
│   ├── js/main.js         # Client-side JS
│   └── images/            # Görseller
└── seeds/seed.js          # Demo veriler
```

---

## 🌐 Vercel'e Deploy

### 1. GitHub'a Push
```bash
git init
git add .
git commit -m "feat: AIESEC İstanbul Alumni Archive ilk sürüm"
git remote add origin https://github.com/KULLANICI_ADI/aiesec-istanbul-archive.git
git push -u origin main
```

### 2. Vercel'e Bağlan
1. [vercel.com](https://vercel.com) → New Project
2. GitHub reposunu seç
3. **Environment Variables** ekle:
   - `POSTGRES_URL` → Neon connection string
   - `SESSION_SECRET` → Güçlü rastgele bir string
   - `NODE_ENV` → `production`
4. Deploy!

### 3. Vercel Postgres (Neon) Ekle
Vercel Dashboard → Projen → **Storage** → **Create Database** → **Postgres (Neon)** seç.
Oluşturunca `POSTGRES_URL` otomatik olarak projenin env variables'ına eklenir.

---

## 🔐 Kullanıcı Akışı

```
Kayıt Ol → Admin Onayı Bekle → Onay → EB Detaylarına Eriş
```

- **Herkes:** Ana sayfa, EB listesi (kart görseli + başlık)
- **Onaylı kullanıcılar:** EB detay sayfası, üye bilgileri
- **Admin:** Tüm içerik + kullanıcı yönetimi

## 📦 Tech Stack

- **Backend:** Node.js + Express
- **Şablonlama:** EJS
- **Veritabanı:** Vercel Postgres (Neon) — serverless SQL
- **Auth:** express-session + connect-pg-simple
- **Şifreleme:** bcryptjs
- **Deploy:** Vercel (serverless)

---

*AIESEC İstanbul Alumni Archive — Liderlik mirasını yaşatmak için* ❤️
