const writeXlsx = require('write-excel-file/node');
const { getSQL } = require('../config/database');
const { sendMailHelper } = require('./email');
const { esc } = require('./escape');

const H = (v) => ({
  value: String(v),
  fontWeight: 'bold',
  backgroundColor: '#0a2540',
  color: '#ffffff'
});

const C = (v) => ({
  value: v === undefined || v === null || v === '' ? '-' : String(v),
  type: String
});

/**
 * Onaylı üyelerin güncel verilerini derleyip:
 * 1) Excel (.xlsx) eki
 * 2) CSV (.csv - UTF-8 BOM) eki
 * 3) Resmi döküman biçiminde HTML e-posta tablosu
 * olarak hazırlar ve lcpist@gmail.com ile admin hesaplarına gönderir.
 */
async function sendApprovedListNotification({ reason = 'Onaylı üye listesi güncellendi' } = {}) {
  try {
    const sql = getSQL();

    // 1. Tüm onaylı üyeleri çek
    const users = await sql`
      SELECT id, name, email, school, department, eb_year, roles_history, aiesec_journey, approved_at, created_at
      FROM users
      WHERE status = 'approved'
      ORDER BY 
        COALESCE(NULLIF(eb_year, ''), '00.00') DESC,
        name ASC
    `;

    if (!users || users.length === 0) {
      console.log('Onaylı üye bulunamadı, bildirim gönderilmedi.');
      return { success: false, message: 'Onaylı üye bulunamadı.' };
    }

    // 2. Üye verilerini standartlaştır
    const members = users.map((u, i) => {
      const name = (u.name || 'İsimsiz').trim();

      // Dönem bilgisi: eb_year veya roles_history içindeki yıllar
      const rolesList = Array.isArray(u.roles_history) ? u.roles_history.filter(r => r && (r.year || r.role)) : [];
      const rolesYears = [...new Set(rolesList.map(r => r.year).filter(Boolean))];
      let year = (u.eb_year || '').trim();
      if (!year && rolesYears.length > 0) {
        year = rolesYears.join(', ');
      } else if (year && rolesYears.length > 0 && !rolesYears.includes(year)) {
        year = `${year} (${rolesYears.join(', ')})`;
      }
      if (!year) year = '-';

      // Pozisyonlar / Görevler
      let positions = '';
      if (rolesList.length > 0) {
        positions = rolesList.map(r => `${r.year ? r.year + ' - ' : ''}${r.role || 'Üye'}`).join('; ');
      }
      if (!positions && u.aiesec_journey) {
        positions = u.aiesec_journey.trim();
      }
      if (!positions) positions = 'Üye';

      const email = u.email && !u.email.endsWith('@import.invalid') ? u.email : '-';
      const school = [u.school, u.department].filter(Boolean).join(' - ') || '-';
      const approvedAt = u.approved_at ? new Date(u.approved_at).toLocaleDateString('tr-TR') : '-';

      return {
        index: i + 1,
        name,
        year,
        positions,
        email,
        school,
        approvedAt
      };
    });

    // 3. Excel (.xlsx) Dökümanı Üret
    const excelHeader = [H('Sıra'), H('Adı Soyadı'), H('Dönemi'), H('Pozisyonları / Görevleri'), H('E-posta'), H('Okul / Bölüm'), H('Onay Tarihi')];
    const excelData = [
      excelHeader,
      ...members.map(m => [
        C(m.index),
        C(m.name),
        C(m.year),
        C(m.positions),
        C(m.email),
        C(m.school),
        C(m.approvedAt)
      ])
    ];

    const excelColumns = [
      { width: 8 },
      { width: 28 },
      { width: 16 },
      { width: 45 },
      { width: 30 },
      { width: 28 },
      { width: 15 }
    ];

    let xlsxBuffer = null;
    try {
      xlsxBuffer = await writeXlsx([{
        data: excelData,
        sheet: 'Onaylı Üyeler',
        columns: excelColumns,
        stickyRowsCount: 1
      }]).toBuffer();
    } catch (excelErr) {
      console.error('Excel belgesi oluşturulurken hata:', excelErr.message);
    }

    // 4. CSV (.csv - UTF-8 BOM) Dökümanı Üret (Tüm cihazlarda ve Excel'de doğrudan açılabilir)
    const csvRows = [
      '\uFEFF"Sıra","Adı Soyadı","Dönemi","Pozisyonları / Görevleri","E-posta","Okul / Bölüm","Onay Tarihi"',
      ...members.map(m =>
        `"${m.index}","${m.name.replace(/"/g, '""')}","${m.year.replace(/"/g, '""')}","${m.positions.replace(/"/g, '""')}","${m.email.replace(/"/g, '""')}","${m.school.replace(/"/g, '""')}","${m.approvedAt}"`
      )
    ];
    const csvBuffer = Buffer.from(csvRows.join('\r\n'), 'utf-8');

    // 5. Dosya Ekleri
    const dateStamp = new Date().toISOString().slice(0, 10);
    const attachments = [];
    if (xlsxBuffer) {
      attachments.push({
        filename: `onayli-uyeler-listesi-${dateStamp}.xlsx`,
        content: xlsxBuffer
      });
    }
    if (csvBuffer) {
      attachments.push({
        filename: `onayli-uyeler-listesi-${dateStamp}.csv`,
        content: csvBuffer
      });
    }

    // 6. E-posta İçi Resmi Döküman HTML Tasarımı
    const nowStr = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const tableRowsHtml = members.map(m => `
      <tr style="background-color: ${m.index % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600; text-align: center;">${m.index}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #0f172a;">${esc(m.name)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
          <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 700; white-space: nowrap;">${esc(m.year)}</span>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; line-height: 1.4;">${esc(m.positions)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">${esc(m.email)}</td>
      </tr>
    `).join('');

    const htmlDocument = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Onaylı Üyeler Listesi</title>
      </head>
      <body style="margin: 0; padding: 20px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 800px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                
                <!-- Üst Başlık Şeridi -->
                <tr>
                  <td style="background-color: #037ef3; height: 6px;"></td>
                </tr>

                <!-- Döküman Başlığı -->
                <tr>
                  <td style="background-color: #0a2540; padding: 28px 32px; color: #ffffff;">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #60a5fa; margin-bottom: 6px;">
                      İSTANBUL ALUMNI ARCHIVE
                    </div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                      📋 GÜNCEL ONAYLI ÜYELER RESMİ LİSTESİ
                    </h1>
                    <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">
                      Bu belge, sistemde onaylı üye listesinde gerçekleştirilen güncellemeler sonrasında otomatik olarak üretilmiştir.
                    </p>
                  </td>
                </tr>

                <!-- Bilgi / Özet Paneli -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 16px 32px; border-bottom: 1px solid #e2e8f0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 4px 8px 4px 0; vertical-align: top; width: 40%;">
                          <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; display: block;">İşlem / Tetikleyici</span>
                          <span style="font-size: 13px; font-weight: 700; color: #037ef3;">${esc(reason)}</span>
                        </td>
                        <td style="padding: 4px 8px; vertical-align: top; width: 30%;">
                          <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; display: block;">Toplam Onaylı Üye</span>
                          <span style="font-size: 14px; font-weight: 700; color: #0f172a;">${members.length} Kişi</span>
                        </td>
                        <td style="padding: 4px 0 4px 8px; vertical-align: top; width: 30%;">
                          <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; display: block;">Rapor Tarihi</span>
                          <span style="font-size: 12px; font-weight: 600; color: #334155;">${nowStr}</span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="3" style="padding-top: 10px;">
                          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #1e40af;">
                            📎 <strong>Ekli Belgeler:</strong> Bu e-postaya güncel <strong>.xlsx (Excel)</strong> ve <strong>.csv</strong> dökümanları eklenmiştir.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Tablo İçeriği -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <div style="overflow-x: auto;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; text-align: left;">
                        <thead>
                          <tr style="background-color: #0a2540; color: #ffffff;">
                            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-top-left-radius: 6px; text-align: center; width: 35px;">#</th>
                            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Adı Soyadı</th>
                            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 110px;">Dönemi</th>
                            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Pozisyonları / Görevleri</th>
                            <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-top-right-radius: 6px;">E-posta</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${tableRowsHtml}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- Alt Bilgi / Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                      © ${new Date().getFullYear()} İstanbul Alumni Archive • Güvenli Yönetici Bildirim Sistemi
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 7. Alıcıları Belirle (lcpist@gmail.com ve tüm kayıtlı adminler)
    let recipients = ['lcpist@gmail.com'];
    try {
      const adminRows = await sql`SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL`;
      const adminEmails = adminRows.map(r => String(r.email).trim().toLowerCase()).filter(Boolean);
      recipients = [...new Set([...recipients, ...adminEmails])];
    } catch (e) {
      console.error('Admin e-postaları alınamadı:', e.message);
    }

    const subject = `📋 Güncel Onaylı Üye Listesi Dökümanı (${members.length} Üye) - ${dateStamp}`;

    // Her alıcıya e-posta gönder
    await Promise.allSettled(
      recipients.map(to => sendMailHelper({ to, subject, html: htmlDocument, attachments }))
    );

    console.log(`✅ Onaylı üye listesi (${members.length} üye) başarıyla ${recipients.join(', ')} adreslerine iletildi.`);
    return { success: true, count: members.length, recipients };
  } catch (err) {
    console.error('sendApprovedListNotification genel hata:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendApprovedListNotification,
};
