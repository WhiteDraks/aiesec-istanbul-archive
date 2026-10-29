#!/usr/bin/env node
/**
 * restore-aiesec.js
 * Restores AIESEC text in pages that are ONLY visible to logged-in users.
 * Guest-visible pages (index, auth/*, eb/index, layout header/footer) stay unchanged.
 */

const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '../views');

// Files that are ONLY visible to logged-in users → restore AIESEC
const RESTORE_MAP = [
  // admin pages
  {
    file: 'admin/archive.ejs',
    replacements: [
      ['Alumni Archive Geçmiş Belgeleri ve Klasörleri', 'AIESEC İstanbul Geçmiş Belgeleri ve Klasörleri'],
    ]
  },
  {
    file: 'admin/panel.ejs',
    replacements: [
      ['Alumni Archive Yönetimi', 'AIESEC İstanbul Alumni Archive Yönetimi'],
      ['Alumni Archive Portalı - Haftalık Özet', 'AIESEC İstanbul Mezunlar Portalı - Haftalık Özet'],
    ]
  },
  {
    file: 'admin/timeline.ejs',
    replacements: [
      ['Alumni Archive Tarih Şeridi', 'AIESEC İstanbul Tarih Şeridi'],
    ]
  },
  {
    file: 'admin/user-edit.ejs',
    replacements: [
      ['Topluluk Kariyeri', 'AIESEC Kariyeri'],
      ['Geçmiş EB ve diğer topluluk görevlerini', 'Geçmiş EB ve diğer AIESEC görevlerini'],
      ['Topluluk Yolculuğu (Roller, Deneyimler)', 'AIESEC Yolculuğu (Roller, Deneyimler)'],
    ]
  },
  {
    file: 'admin/settings.ejs',
    replacements: [
      ['placeholder="Alumni"', 'placeholder="AIESEC"'],
      ["resetField('site_logo_text', 'Alumni')", "resetField('site_logo_text', 'AIESEC')"],
      ["'Alumni Archive <onboarding@resend.dev>'", "'AIESEC Alumni <onboarding@resend.dev>'"],
      ['Alumni Archive platformu', 'AIESEC Alumni platformu'],
    ]
  },
  // alumni pages (only logged-in approved users)
  {
    file: 'alumni/index.ejs',
    replacements: [
      ['Alumni mezunlarıyla bağlantı kurun', 'AIESEC İstanbul mezunlarıyla bağlantı kurun'],
      ['Topluluk Rolü Ara', 'AIESEC Rolü Ara'],
    ]
  },
  {
    file: 'alumni/detail.ejs',
    replacements: [
      ['Topluluk Kariyeri', 'AIESEC Kariyeri'],
      ['Topluluk Yolculuğu', 'AIESEC Yolculuğu'],
    ]
  },
  // archive page
  {
    file: 'archive/index.ejs',
    replacements: [
      ["topluluğun bültenlerini", "AIESEC İstanbul'un bültenlerini"],
    ]
  },
  // eb detail (only for logged-in approved users)
  {
    file: 'eb/detail.ejs',
    replacements: [
      ['topluluğu yöneten liderler', 'AIESEC İstanbul\'u yöneten liderler'],
      ['Topluluk Görevleri', 'AIESEC Görevleri'],
      ['Topluluk Yolculuğu', 'AIESEC Yolculuğu'],
    ]
  },
  // events, jobs, timeline pages
  {
    file: 'events/index.ejs',
    replacements: [
      ['topluluğun etkinlikleri', 'AIESEC İstanbul\'un etkinlikleri'],
      ['İstanbul Alumni Archive etkinlik', 'AIESEC İstanbul etkinlik'],
      ['topluluğa katılın', 'AIESEC\'e katılın'],
    ]
  },
  {
    file: 'jobs/index.ejs',
    replacements: [
      ['topluluğun kariyer', 'AIESEC İstanbul\'un kariyer'],
      ['Alumni Archive üyeleri', 'AIESEC İstanbul üyeleri'],
    ]
  },
  {
    file: 'timeline/index.ejs',
    replacements: [
      ['Alumni Archive\'nin 70 yıllık mirası', 'AIESEC İstanbul\'un 70 yıllık mirası'],
      ['İstanbul Alumni Archive Tarih', 'AIESEC İstanbul Tarih'],
    ]
  },
  // profile (only logged-in users)
  {
    file: 'profile/index.ejs',
    replacements: [
      ['topluluk geçmişinizi', 'AIESEC geçmişinizi'],
      ['topluluk ağında', 'AIESEC ağında'],
      ['Topluluk Kariyeri', 'AIESEC Kariyeri'],
      ['Geçmiş EB ve diğer topluluk görevlerinizi', 'Geçmiş EB ve diğer AIESEC görevlerinizi'],
      ['Topluluk Yolculuğunuz (Roller, Deneyimler)', 'AIESEC Yolculuğunuz (Roller, Deneyimler)'],
      ['topluluktaki görevlerinizden', 'AIESEC içerisindeki görevlerinizden'],
    ]
  },
  // AI assistant (only logged-in approved users)
  {
    file: 'ai/index.ejs',
    replacements: [
      ["Alumni Archive'nin 70 yıllık mirası", "AIESEC İstanbul'un 70 yıllık mirası"],
      ['Alumni Archive platformunun yapay zeka', 'AIESEC İstanbul Alumni platformunun yapay zeka'],
      ["sendSuggestion('LC ne zaman kuruldu?')", "sendSuggestion('AIESEC İstanbul ne zaman kuruldu?')"],
    ]
  },
];

let totalRestored = 0;

for (const entry of RESTORE_MAP) {
  const filePath = path.join(VIEWS_DIR, entry.file);
  if (!fs.existsSync(filePath)) {
    console.log(`⏭  Atlandı (bulunamadı): ${entry.file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  for (const [from, to] of entry.replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed++;
    }
  }

  if (changed > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${entry.file}: ${changed} adet geri yüklendi`);
    totalRestored += changed;
  } else {
    console.log(`ℹ️  ${entry.file}: değiştirilecek eşleşme bulunamadı`);
  }
}

console.log(`\nToplam ${totalRestored} AIESEC ibaresi giriş gerektiren sayfalara geri yüklendi.`);
