# AIESEC İstanbul Alumni Archive

AIESEC İstanbul mezunlarının (Alumni) geçmiş dönem yürütme kurullarını (Executive Board), mezunların nerede çalıştıklarını ve AIESEC geçmişlerini görebilecekleri, birbirleriyle etkileşimde bulunabilecekleri kapsamlı bir arşiv ve ağ uygulaması.

## 🚀 Teknolojiler (Tech Stack)
*   **Backend:** Node.js, Express.js
*   **Frontend:** Vanilla JS, HTML, CSS (EJS Template Engine)
*   **Veritabanı:** PostgreSQL (Neon Serverless Postgres)
*   **Dosya Depolama:** Vercel Blob (Fotoğraf ve galeri yüklemeleri için)
*   **E-posta Servisi:** Resend (Onaylanan kullanıcılara otomatik e-posta gönderimi)
*   **Oturum Yönetimi:** `express-session` & `connect-pg-simple`
*   **Deploy (Sunucu):** Vercel Serverless Functions

## 🌟 Özellikler
1.  **Gelişmiş Profil Yönetimi:** Mezunlar kendi hesaplarını oluşturup fotoğraf, güncel iş yeri, sektör, LinkedIn adresi ve geçmişte aldıkları AIESEC rollerini (Çoklu Rol Desteği: 26.27 LCP, 25.26 LCVP vb.) ekleyebilirler.
2.  **EB (Executive Board) Takımları:** Geçmiş dönem yürütme kurullarının listesi.
    *   Yönetim panelinden EB takımlarının isimleri, açıklamaları ve **Dönem Başarıları** eklenebilir.
    *   **EB Galerisi:** Her döneme ait grup veya anı fotoğrafları çoklu olarak eklenebilir.
    *   Eğer EB takımı listesindeki bir kişi sisteme onaylı üye olarak kaydolmuşsa, sistem otomatik olarak o kişinin kendi yüklediği güncel profil fotoğrafını takımdaki yerine çeker.
3.  **Alumni Rehberi (Dizin):** Sadece "Admin" tarafından onaylanmış üyeler diğer mezunları görebilir. Bu sayede AIESEC ağı korunur.
    *   Kişiler güncel çalıştıkları "Sektör" bilgisine göre (Örn: Finans, Teknoloji, Pazarlama) filtrelenebilir.
4.  **Admin Paneli:**
    *   Yeni kayıt olan üyeleri onaylama, reddetme, tekrar beklemeye alma işlemleri.
    *   Onaylanan üyelere otomatik **Hoş Geldin & Onay e-postası** gönderimi (Resend API).
    *   EB takımlarını, dönem başarılarını ve EB galerisini yönetme paneli.
5.  **KVKK ve Veri Güvenliği:** Kayıt esnasında Türkiye normlarına uygun zorunlu KVKK metni onayı. Şifreler `bcrypt` ile hashlenerek veritabanında tutulur.

## ⚙️ Kurulum ve Geliştirme Ortamı

Yerel makinenizde çalıştırmak veya başka bir AI asistanına projeyi devretmek için:

1.  Repoyu klonlayın ve klasöre gidin:
    ```bash
    git clone https://github.com/WhiteDraks/aiesec-istanbul-archive.git
    cd aiesec-istanbul-archive
    ```

2.  Gereksinimleri yükleyin:
    ```bash
    npm install
    ```

3.  `.env` dosyasını oluşturun ve aşağıdaki değişkenleri tanımlayın:
    ```ini
    # Veritabanı
    DATABASE_URL="postgresql://kullanici:sifre@host/veritabani?sslmode=require"
    
    # Session (Herhangi gizli bir kelime olabilir)
    SESSION_SECRET="super-gizli-aiesec-sifre"

    # Vercel Blob (Fotoğraflar için)
    BLOB_READ_WRITE_TOKEN="vercel_blob_rw_12345abcde..."

    # Resend API (Otomatik Mail için)
    RESEND_API_KEY="re_12345abcde..."
    ```

4.  Projeyi ayağa kaldırın:
    ```bash
    npm run dev
    ```

5.  Proje `http://localhost:3000` adresinde çalışacaktır. Veritabanı tabloları sunucu ilk çalıştığında otomatik olarak yaratılır.

## 🤖 Gelecek Geliştirmeler İçin AI Notları
*   Sistem **Vercel** ortamında çalışmak üzere tasarlandığı için dosya okuma/yazma (örn: `fs.writeFileSync`) işlemleri kalıcı değildir. Dosya yüklemeleri tamamen `multer` (memoryStorage) ile alınıp, `utils/blob.js` aracılığıyla `@vercel/blob` üzerine pushlanmaktadır.
*   Admin rotaları `/admin` üzerinden yönetilmekte ve `isAdmin` middleware'i ile korunmaktadır.
*   Tasarımlarda ve renk paletlerinde AIESEC'in global Blue (#037ef3) rengi kullanılmıştır. CSS yapılandırması `public/css/style.css` içerisinde native değişkenler (var(--primary)) ile kurgulanmıştır, Tailwind kullanılmamıştır.
