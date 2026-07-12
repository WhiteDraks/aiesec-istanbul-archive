const { getSQL } = require('../config/database');
const { Resend } = require('resend');

async function sendWeeklyDigest(customSubject = null, customIntro = null, extraTitle = null, extraContent = null, targetYears = null) {
  const sql = getSQL();
  
  // 1. Fetch site settings to get custom sender address
  const settingsRows = await sql`SELECT key, value FROM site_settings`;
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });
  const emailFrom = settings.email_from || 'AIESEC Alumni <onboarding@resend.dev>';
  
  // Check if Resend API key is present
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY environment variable is not defined. Digest sending skipped.');
    return { success: false, reason: 'API key missing' };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  // 2. Fetch new content in the last 7 days
  const newJobs = await sql`
    SELECT * FROM jobs 
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
  `;

  const newMemories = await sql`
    SELECT m.*, u.name as user_name, u.photo as user_photo
    FROM eb_memories m
    JOIN users u ON m.user_id = u.id
    WHERE m.created_at > NOW() - INTERVAL '7 days'
    ORDER BY m.created_at DESC
  `;

  const newAlumni = await sql`
    SELECT id, name, photo, eb_year
    FROM users
    WHERE status = 'approved' AND approved_at > NOW() - INTERVAL '7 days'
    ORDER BY approved_at DESC
  `;

  // If no new content AND no custom intro message, do not send email
  if (newJobs.length === 0 && newMemories.length === 0 && newAlumni.length === 0 && !customIntro) {
    console.log('No new content in the last 7 days and no custom announcement. Digest email skipped.');
    return { success: true, sent: 0, reason: 'No new content' };
  }

  // 3. Fetch approved user emails (either all approved users or only users matching targetYears)
  let users = [];
  if (targetYears && Array.isArray(targetYears) && targetYears.length > 0) {
    users = await sql`
      SELECT DISTINCT email, name 
      FROM users u
      WHERE status = 'approved'
        AND EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(
            CASE WHEN u.roles_history IS NULL OR u.roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE u.roles_history END
          ) AS role_entry
          WHERE role_entry->>'year' IN ${sql(targetYears)}
        )
    `;
  } else {
    users = await sql`SELECT email, name FROM users WHERE status = 'approved'`;
  }

  if (users.length === 0) return { success: true, sent: 0, reason: 'No matching approved users found' };

  // 4. Construct beautiful HTML email template
  let htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #090d16; color: #f3f4f6; padding: 2rem; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <div style="text-align: center; border-bottom: 2px solid #037ef3; padding-bottom: 1.5rem; margin-bottom: 2rem;">
        <h1 style="color: #037ef3; margin: 0; font-size: 1.8rem; letter-spacing: 1px;">AIESEC İstanbul</h1>
        <p style="color: #9ca3af; margin: 0.5rem 0 0 0; font-size: 1rem;">Haftalık Mezunlar Bülteni 📰</p>
      </div>
  `;

  if (customIntro && customIntro.trim()) {
    htmlContent += `
      <div style="margin-bottom: 2rem; padding: 1.25rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-size: 0.95rem; line-height: 1.6; color: #f3f4f6; white-space: pre-wrap;">${customIntro}</div>
    `;
  }

  if (newAlumni.length > 0) {
    htmlContent += `
      <div style="margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.2rem; border-left: 4px solid #037ef3; padding-left: 0.5rem; margin-bottom: 1rem;">👥 Yeni Katılan Mezunlarımız</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;">
    `;
    newAlumni.forEach(al => {
      htmlContent += `
        <div style="background-color: #111827; padding: 0.75rem; border-radius: 8px; text-align: center; border: 1px solid #1f2937;">
          <h4 style="margin: 0.5rem 0 0.25rem 0; color: #fff; font-size: 0.9rem;">${al.name}</h4>
          <span style="font-size: 0.75rem; color: #037ef3;">EB ${al.eb_year || ''}</span>
        </div>
      `;
    });
    htmlContent += `</div></div>`;
  }

  if (newJobs.length > 0) {
    htmlContent += `
      <div style="margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.2rem; border-left: 4px solid #10b981; padding-left: 0.5rem; margin-bottom: 1rem;">💼 Yeni İş & Staj İlanları</h2>
    `;
    newJobs.forEach(job => {
      htmlContent += `
        <div style="background-color: #111827; padding: 1rem; border-radius: 8px; border: 1px solid #1f2937; margin-bottom: 0.75rem;">
          <h3 style="margin: 0 0 0.25rem 0; color: #fff; font-size: 1.05rem;">${job.title}</h3>
          <h4 style="margin: 0 0 0.5rem 0; color: #10b981; font-size: 0.9rem;">${job.company}</h4>
          <p style="margin: 0; color: #9ca3af; font-size: 0.85rem; line-height: 1.4;">${job.description.substring(0, 120)}...</p>
        </div>
      `;
    });
    htmlContent += `</div>`;
  }

  if (newMemories.length > 0) {
    htmlContent += `
      <div style="margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.2rem; border-left: 4px solid #f59e0b; padding-left: 0.5rem; margin-bottom: 1rem;">📸 Yeni Dönem Anıları</h2>
    `;
    newMemories.forEach(mem => {
      htmlContent += `
        <div style="background-color: #111827; padding: 1rem; border-radius: 8px; border: 1px solid #1f2937; margin-bottom: 0.75rem;">
          <p style="margin: 0 0 0.5rem 0; color: #f3f4f6; font-size: 0.9rem; font-style: italic;">"${mem.caption || ''}"</p>
          <span style="font-size: 0.75rem; color: #9ca3af;">— ${mem.user_name} (${mem.team_year} Dönemi)</span>
        </div>
      `;
    });
    htmlContent += `</div>`;
  }

  // Extra custom section from admin
  if (extraTitle && extraTitle.trim() || extraContent && extraContent.trim()) {
    htmlContent += `
      <div style="margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.2rem; border-left: 4px solid #a78bfa; padding-left: 0.5rem; margin-bottom: 1rem;">${extraTitle ? extraTitle.trim() : '📌 Editörden'}</h2>
        <div style="background-color: #111827; padding: 1.25rem; border-radius: 8px; border: 1px solid #1f2937; font-size: 0.9rem; line-height: 1.7; color: #f3f4f6; white-space: pre-wrap;">${extraContent ? extraContent.trim() : ''}</div>
      </div>
    `;
  }

  htmlContent += `
      <div style="text-align: center; border-top: 1px solid #1f2937; padding-top: 1.5rem; margin-top: 2rem; font-size: 0.8rem; color: #6b7280;">
        <p>AIESEC İstanbul Mezunlar Arşivi topluluk bültenidir.</p>
        <p style="margin: 0.25rem 0 0 0;">Yeni gelişmeleri kaçırmamak için <a href="https://aiesec-istanbul-archive.vercel.app" style="color: #037ef3; text-decoration: none;">Platformu Ziyaret Edin</a>.</p>
      </div>
    </div>
  `;

  // 5. Send digest emails to users in a batch loop
  let sentCount = 0;
  for (const u of users) {
    try {
      await resend.emails.send({
        from: emailFrom,
        to: u.email,
        subject: customSubject || 'AIESEC İstanbul Mezunlar Portalı - Haftalık Özet 📰',
        html: htmlContent
      });
      sentCount++;
    } catch (sendErr) {
      console.error(`Failed to send digest email to ${u.email}:`, sendErr);
    }
  }

  return { success: true, sent: sentCount, reason: 'Digest processed' };
}

module.exports = { sendWeeklyDigest };
