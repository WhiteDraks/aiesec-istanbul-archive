const { getSQL } = require('../config/database');

async function getSystemContext() {
  const sql = getSQL();

  try {
    // 1. Fetch Timeline Milestones
    const milestones = await sql`
      SELECT year, title, description 
      FROM timeline_milestones 
      ORDER BY year ASC
    `;

    // 2. Fetch Heritage Documents
    const documents = await sql`
      SELECT title, category, year, description 
      FROM heritage_documents 
      ORDER BY year DESC, title ASC
    `;

    // 3. Fetch EB Teams meta
    const ebTeams = await sql`
      SELECT year, title, description, achievements 
      FROM eb_teams 
      ORDER BY year DESC
    `;

    // 4. Fetch Approved Users and their roles history
    const users = await sql`
      SELECT name, sector, school, workplaces, roles_history, is_mentor, is_mentee, mentorship_details, aiesec_journey
      FROM users
      WHERE status = 'approved'
      ORDER BY name ASC
    `;

    // Compile Milestone Context
    let milestoneText = milestones.map(m => `* Yıl: ${m.year} - ${m.title}: ${m.description}`).join('\n');

    // Compile Document Context
    const categoryLabels = {
      strategy: 'Strateji/Planlama',
      guide: 'Rehber/Eğitim',
      report: 'Rapor/Çıktı',
      memory: 'Anı/Fotoğraf',
      other: 'Diğer'
    };
    let documentText = documents.map(d => `* [${categoryLabels[d.category] || d.category}] ${d.title} (${d.year || 'Bilinmeyen Yıl'}): ${d.description || 'Açıklama yok'}`).join('\n');

    // Compile EB Team Context
    let ebTeamsText = ebTeams.map(t => {
      const ach = t.achievements && Array.isArray(t.achievements) ? t.achievements.map(a => `  - ${a}`).join('\n') : '  - Belirtilmemiş';
      return `* Dönem: ${t.year}\n  Başlık: ${t.title}\n  Açıklama: ${t.description || 'Girilmemiş'}\n  Başarılar:\n${ach}`;
    }).join('\n\n');

    // Compile Alumni User Context
    let usersText = users.map(u => {
      let roles = '';
      if (u.roles_history && Array.isArray(u.roles_history)) {
        roles = u.roles_history.map(r => `${r.year}: ${r.role}`).join(', ');
      }
      let mentorStatus = [];
      if (u.is_mentor) mentorStatus.push('Mentör');
      if (u.is_mentee) mentorStatus.push('Menti');
      const mStr = mentorStatus.length > 0 ? ` [${mentorStatus.join('/')}]` : '';

      return `* ${u.name}${mStr}\n  - Roller: ${roles || 'Girilmemiş'}\n  - Sektör/İşyeri: ${u.sector || 'Belirtilmemiş'} / ${u.workplaces || 'Belirtilmemiş'}\n  - Mentörlük Bilgisi: ${u.mentorship_details || 'Detay yok'}\n  - AIESEC Hikayesi: ${u.aiesec_journey ? u.aiesec_journey.substring(0, 150) + '...' : 'Girilmemiş'}`;
    }).join('\n\n');

    // Combine everything into a coherent context
    const fullContext = `
AIESEC İSTANBUL ALUMNI ARCHIVE BİLGİ TABANI

AIESEC İstanbul, 1954 yılında kurulmuş olan Türkiye'nin en köklü ve ilk AIESEC yerel kuruludur (Local Committee - LC). Bu arşiv platformu, geçmiş dönemlerin hatıralarını, Executive Board (EB) üyelerini, tarihi belgeleri ve zaman tünelini barındırır.

---
ZAMAN TÜNELİ DÖNÜM NOKTALARI (TIMELINE):
${milestoneText || 'Kayıt bulunmuyor.'}

---
TARİHİ BELGE & YAYIN ARŞİVİ (HERITAGE DRIVE):
${documentText || 'Kayıt bulunmuyor.'}

---
EXECUTIVE BOARD (EB) DÖNEMLERİ:
${ebTeamsText || 'Kayıt bulunmuyor.'}

---
KAYITLI VE ONAYLI ALUMNI ÜYELERİ:
${usersText || 'Kayıt bulunmuyor.'}
`;

    return fullContext;
  } catch (err) {
    console.error('Error generating AI context:', err);
    return 'AIESEC İstanbul Alumni Archive Bilgi Tabanı yüklenemedi. Sadece genel AIESEC İstanbul bilgisiyle cevap ver.';
  }
}

module.exports = { getSystemContext };
