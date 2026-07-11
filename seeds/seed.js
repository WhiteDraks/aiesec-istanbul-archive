require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const EBTeam = require('../models/EBTeam');
const EBMember = require('../models/EBMember');

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI bulunamadı. .env dosyanızı kontrol edin.');
  process.exit(1);
}

const members2627 = [
  {
    name: 'Ahmet Yılmaz',
    role: 'Local Committee President',
    department: 'Presidency',
    school: 'Boğaziçi Üniversitesi',
    email: 'ahmet.yilmaz@aiesec.net',
    linkedin: 'https://linkedin.com/in/ahmetyilmaz',
    aiesecJourney: 'AIESEC yolculuğuna 2023 yılında Marketing departmanında başladı. Sonraki dönem VP of Marketing görevini üstlendi. 26.27 döneminde Local Committee President olarak takımı yönetti.',
    bio: 'Boğaziçi Üniversitesi İşletme bölümü öğrencisi. Liderlik, inovasyon ve kültürlerarası iş birliği konularında tutkulu.',
    order: 1,
    isPinToBottom: false,
  },
  {
    name: 'Zeynep Kaya',
    role: 'VP of Outgoing Global Talent',
    department: 'Outgoing Global Talent',
    school: 'İTÜ',
    email: 'zeynep.kaya@aiesec.net',
    linkedin: 'https://linkedin.com/in/zeynepkaya',
    aiesecJourney: 'Outgoing Global Talent departmanında Team Leader olarak başladı. Erasmus deneyiminin ardından VP pozisyonuna yükseldi.',
    bio: 'İTÜ Endüstri Mühendisliği öğrencisi. Uluslararası iş deneyimi kazanmak isteyen gençlere yol gösteriyor.',
    order: 2,
    isPinToBottom: false,
  },
  {
    name: 'Mehmet Demir',
    role: 'VP of Incoming Global Talent',
    department: 'Incoming Global Talent',
    school: 'ODTÜ',
    email: 'mehmet.demir@aiesec.net',
    linkedin: 'https://linkedin.com/in/mehmetdemir',
    aiesecJourney: 'ODTÜ\'de lisans eğitimi sırasında AIESEC\'e katıldı. Incoming Global Talent departmanında 2 yıl deneyim kazandı.',
    bio: 'ODTÜ Uluslararası İlişkiler öğrencisi. Yabancı pratisyenlerin Türkiye deneyimlerini unutulmaz kılmak için çalışıyor.',
    order: 3,
    isPinToBottom: false,
  },
  {
    name: 'Selin Arslan',
    role: 'VP of Marketing',
    department: 'Marketing',
    school: 'Bilkent Üniversitesi',
    email: 'selin.arslan@aiesec.net',
    linkedin: 'https://linkedin.com/in/selinarslann',
    aiesecJourney: 'Bilkent\'te grafik tasarım ve pazarlama alanında deneyim kazandı. AIESEC İstanbul\'un sosyal medya kimliğini baştan tasarladı.',
    bio: 'İletişim ve pazarlama konusunda yaratıcı çözümler üreten, brand storytelling\'e tutkulu bir lider.',
    order: 4,
    isPinToBottom: false,
  },
  {
    name: 'Can Öztürk',
    role: 'VP of Finance',
    department: 'Finance',
    school: 'Koç Üniversitesi',
    email: 'can.ozturk@aiesec.net',
    linkedin: 'https://linkedin.com/in/canozturk',
    aiesecJourney: 'Koç Üniversitesi Ekonomi öğrencisi olarak AIESEC\'in finansal operasyonlarını yönetiyor. Bütçe planlaması ve sponsorluk alanında uzmanlaştı.',
    bio: 'Finansal analiz ve stratejik planlama konularında deneyimli. Organizasyonun sürdürülebilirliğine önem veriyor.',
    order: 5,
    isPinToBottom: false,
  },
  {
    name: 'Ayşe Şahin',
    role: 'VP of Talent Management',
    department: 'Talent Management',
    school: 'Sabancı Üniversitesi',
    email: 'ayse.sahin@aiesec.net',
    linkedin: 'https://linkedin.com/in/aysesahin',
    aiesecJourney: 'Sabancı Üniversitesi\'nde psikoloji okuyan Ayşe, insan kaynakları ve liderlik geliştirme alanında 3 yıldır aktif.',
    bio: 'İnsanların potansiyelini keşfetmelerine yardımcı olmaktan ilham alan bir lider ve koç.',
    order: 6,
    isPinToBottom: false,
  },
  {
    name: 'Burak Çelik',
    role: 'VP of Outgoing Global Volunteer',
    department: 'Outgoing Global Volunteer',
    school: 'Hacettepe Üniversitesi',
    email: 'burak.celik@aiesec.net',
    linkedin: 'https://linkedin.com/in/burakcelik',
    aiesecJourney: 'Gönüllülük programlarına inanan Burak, yurt dışı gönüllülük deneyiminin ardından VP görevini üstlendi.',
    bio: 'Sosyal etki ve sürdürülebilir kalkınma konularında çalışmalar yürütüyor. Küresel vatandaşlık anlayışının savunucusu.',
    order: 7,
    isPinToBottom: false,
  },
  {
    name: 'Elif Kurnaz',
    role: 'VP of Incoming Global Volunteer',
    department: 'Incoming Global Volunteer',
    school: 'İstanbul Üniversitesi',
    email: 'elif.kurnaz@aiesec.net',
    linkedin: 'https://linkedin.com/in/elifkurnaz',
    aiesecJourney: 'AIESEC İstanbul\'da Incoming Global Volunteer departmanında Team Leader olarak başladı. Bu dönem VP pozisyonunu üstlenerek uluslararası gönüllü programlarını koordine ediyor.',
    bio: 'İstanbul Üniversitesi öğrencisi. Kültürlerarası köprüler kurmaya ve gelen gönüllülerin deneyimlerini zenginleştirmeye adanmış bir lider.',
    order: 999, // Always last
    isPinToBottom: true,
  },
];

async function seed() {
  try {
    console.log('🔌 MongoDB bağlanılıyor...');
    await mongoose.connect(MONGO_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
    console.log('✅ Bağlantı kuruldu.');

    // ── Clear existing data ────────────────────────────────────────────────
    console.log('\n🗑  Eski veriler temizleniyor...');
    await Promise.all([
      User.deleteMany({}),
      EBTeam.deleteMany({}),
      EBMember.deleteMany({}),
    ]);
    console.log('✅ Temizlendi.');

    // ── Create Admin User ──────────────────────────────────────────────────
    console.log('\n👤 Admin kullanıcı oluşturuluyor...');
    const admin = new User({
      name: 'AIESEC İstanbul Admin',
      email: 'admin@aiesec-istanbul.com',
      password: 'Admin1234!',
      role: 'admin',
      status: 'approved',
    });
    await admin.save();
    console.log('✅ Admin oluşturuldu: admin@aiesec-istanbul.com / Admin1234!');

    // ── Create 2026-2027 EB Team ───────────────────────────────────────────
    console.log('\n🏢 2026-2027 EB Takımı oluşturuluyor...');
    const team2627 = new EBTeam({
      year: '2026-2027',
      title: 'AIESEC İstanbul 26.27 EB',
      slug: '2026-2027',
      description:
        'AIESEC İstanbul 2026-2027 Executive Board dönemi, organizasyonun tarihindeki en dinamik dönemlerden birini temsil etmektedir. Bu dönemde uluslararası değişim programları, gönüllülük projeleri ve kurumsal ortaklıklar alanında önemli adımlar atıldı.',
      coverImage: '/images/default-cover.jpg',
      groupPhoto: null,
      isPublic: false,
      achievements: [
        'Outgoing Global Talent programında %40 büyüme sağlandı',
        'Yeni kurumsal ortaklık anlaşmaları imzalandı',
        '15+ ülkeden gönüllü ağırlama rekorı kırıldı',
        'Alumni ağı için dijital arşiv platformu hayata geçirildi',
      ],
      order: 100,
    });
    await team2627.save();
    console.log('✅ 2026-2027 takımı oluşturuldu.');

    // ── Create 2024-2025 EB Team (older, fewer details) ─────────────────────
    console.log('\n🏢 2024-2025 EB Takımı oluşturuluyor...');
    const team2425 = new EBTeam({
      year: '2024-2025',
      title: 'AIESEC İstanbul 24.25 EB',
      slug: '2024-2025',
      description:
        'AIESEC İstanbul 2024-2025 Executive Board dönemi, pandemi sonrası toparlanma sürecinde organizasyonu yeniden canlandıran güçlü bir kadroyla şekillendi.',
      coverImage: '/images/default-cover.jpg',
      isPublic: false,
      achievements: [
        'Pandemi sonrası ilk büyük uluslararası etkinlik düzenlendi',
        'Üye sayısı 2 katına çıkarıldı',
      ],
      order: 90,
    });
    await team2425.save();
    console.log('✅ 2024-2025 takımı oluşturuldu.');

    // ── Create 2022-2023 EB Team ────────────────────────────────────────────
    const team2223 = new EBTeam({
      year: '2022-2023',
      title: 'AIESEC İstanbul 22.23 EB',
      slug: '2022-2023',
      description:
        'Dijital dönüşüm ve hibrit çalışma modeliyle öne çıkan 2022-2023 Executive Board dönemi.',
      coverImage: '/images/default-cover.jpg',
      isPublic: false,
      order: 80,
    });
    await team2223.save();
    console.log('✅ 2022-2023 takımı oluşturuldu.');

    // ── Create Members for 2026-2027 ─────────────────────────────────────────
    console.log('\n👥 2026-2027 üyeleri oluşturuluyor...');
    const memberDocs = members2627.map(m => ({
      ...m,
      team: team2627._id,
      photo: '/images/default-avatar.svg',
    }));
    await EBMember.insertMany(memberDocs);
    console.log(`✅ ${memberDocs.length} üye oluşturuldu (Elif Kurnaz en sonda).`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🌱 Seed tamamlandı!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📋 Özet:');
    console.log(`  👤 Admin: admin@aiesec-istanbul.com / Admin1234!`);
    console.log(`  🏢 EB Takımları: 3 takım (2022-23, 2024-25, 2026-27)`);
    console.log(`  👥 Üyeler: ${memberDocs.length} üye (2026-27 dönemi)`);
    console.log('\n🚀 Uygulamayı başlatmak için: npm run dev');
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed hatası:', err);
    process.exit(1);
  }
}

seed();
