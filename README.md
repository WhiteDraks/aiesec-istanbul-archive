# AIESEC İstanbul Alumni Archive

AIESEC İstanbul Executive Board arşiv web sitesi. Geçmiş EB dönemlerini, üyelerini, görevlerini ve hikayelerini sergiliyor.

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Environment Variables
`.env.example` dosyasını `.env` olarak kopyala ve doldur:
```bash
cp .env.example .env
```

`.env` içeriği:
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/aiesec-istanbul
SESSION_SECRET=uzun-ve-gizli-bir-anahtar-buraya
PORT=3000
NODE_ENV=development
```

### 3. MongoDB Atlas Kurulumu
1. [MongoDB Atlas](https://cloud.mongodb.com) üzerinde ücretsiz hesap aç
2. Yeni bir **Free Cluster** oluştur
3. **Database Access** > Yeni kullanıcı ekle
4. **Network Access** > `0.0.0.0/0` ekle (Vercel için)
5. **Connect** > "Connect your application" seçeneğiyle connection string al

### 4. Demo Verileri Yükle
```bash
npm run seed
```
Bu komut:
- Admin hesabı oluşturur: `admin@aiesec-istanbul.com` / `Admin1234!`
- 3 EB takımı ekler (2022-23, 2024-25, 2026-27)
- 2026-27 için 8 demo üye ekler (Elif Kurnaz en sonda)

### 5. Uygulamayı Başlat
```bash
npm run dev    # geliştirme (nodemon ile)
# veya
npm start      # production
```

Uygulama: http://localhost:3000

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
   - `MONGODB_URI` → Atlas connection string
   - `SESSION_SECRET` → Güçlü rastgele bir string
   - `NODE_ENV` → `production`
4. Deploy!

### 3. MongoDB Atlas Network Access
Vercel'in IP'lerini whitelist etmek yerine `0.0.0.0/0` (tüm IP) izni ver.

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
- **Veritabanı:** MongoDB + Mongoose
- **Auth:** express-session + connect-mongo
- **Şifreleme:** bcryptjs
- **Deploy:** Vercel (serverless)

---

*AIESEC İstanbul Alumni Archive — Liderlik mirasını yaşatmak için* ❤️
