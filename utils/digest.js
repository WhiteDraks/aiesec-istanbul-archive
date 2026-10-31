const { getSQL } = require('../config/database');
const { esc, SITE_URL } = require('./escape');
const { sendMailHelper } = require('./email');

/**
 * Send the weekly digest newsletter.
 *
 * @param {string|null} customSubject   - Email subject line
 * @param {string|null} customIntro     - Intro paragraph shown at the top
 * @param {string|null} extraTitle      - Optional extra section title
 * @param {string|null} extraContent    - Optional extra section body
 * @param {string[]|null} targetYears   - Limit recipients to these EB years (null = all approved)
 * @param {object} contentFlags         - Which auto-sections to include
 *   @param {boolean} contentFlags.includeAlumni   - Include new alumni (last 7 days)
 *   @param {boolean} contentFlags.includeJobs     - Include new job listings (last 7 days)
 *   @param {boolean} contentFlags.includeMemories - Include new EB memories (last 7 days)
 */
async function sendWeeklyDigest(
  customSubject   = null,
  customIntro     = null,
  extraTitle      = null,
  extraContent    = null,
  targetYears     = null,
  contentFlags    = {}
) {
  const sql = getSQL();

  // Destructure flags with defaults (all true if not specified)
  const {
    includeAlumni   = true,
    includeJobs     = true,
    includeMemories = true,
  } = contentFlags;

  // 1. Fetch site settings
  const settingsRows = await sql`SELECT key, value FROM site_settings`;
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  // SMTP veya Resend kurulu mu kontrol et
  const hasSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  const hasResend = process.env.RESEND_API_KEY;
  if (!hasSMTP && !hasResend) {
    console.warn('⚠️ No mail sending provider (SMTP or Resend) is configured. Digest sending skipped.');
    return { success: false, reason: 'Mail provider missing' };
  }

  // 2. Fetch requested auto-content sections (last 7 days)
  const newJobs = includeJobs ? await sql`
    SELECT * FROM jobs
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
  ` : [];

  const newMemories = includeMemories ? await sql`
    SELECT m.*, u.name as user_name
    FROM eb_memories m
    JOIN users u ON m.user_id = u.id
    WHERE m.created_at > NOW() - INTERVAL '7 days'
    ORDER BY m.created_at DESC
  ` : [];

  const newAlumni = includeAlumni ? await sql`
    SELECT id, name, photo, eb_year
    FROM users
    WHERE status = 'approved' AND approved_at > NOW() - INTERVAL '7 days'
    ORDER BY approved_at DESC
  ` : [];

  // 3. Guard: skip if nothing to send
  const hasAutoContent = newJobs.length > 0 || newMemories.length > 0 || newAlumni.length > 0;
  const hasCustomContent = (customIntro && customIntro.trim()) ||
                           (extraTitle   && extraTitle.trim())   ||
                           (extraContent && extraContent.trim());

  if (!hasAutoContent && !hasCustomContent) {
    console.log('No content to send (auto sections empty and no custom message). Digest skipped.');
    return { success: true, sent: 0, reason: 'No content' };
  }

  // 4. Fetch recipients
  let users = [];
  if (targetYears && Array.isArray(targetYears) && targetYears.length > 0) {
    // Use safe parameterized query — Neon supports plain .query(sql, params)
    // Placeholders reused: $1..$N for eb_year IN, same $1..$N for roles_history match
    const placeholders = targetYears.map((_, i) => `$${i + 1}`).join(', ');
    const queryText = `
      SELECT DISTINCT email, name
      FROM users u
      WHERE status = 'approved'
        AND (
          u.eb_year IN (${placeholders})
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN u.roles_history IS NULL OR u.roles_history = 'null'::jsonb
                THEN '[]'::jsonb
                ELSE u.roles_history
              END
            ) AS role_entry
            WHERE role_entry->>'year' IN (${placeholders})
          )
        )
    `;
    const result = await sql.query(queryText, targetYears);
    // Neon .query() returns { rows: [...] }
    users = result.rows || result;
  } else {
    users = await sql`SELECT email, name FROM users WHERE status = 'approved'`;
  }

  if (users.length === 0) {
    return { success: true, sent: 0, reason: 'No matching approved users found' };
  }

  // 5. Build HTML email
  let htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #090d16; color: #f3f4f6; padding: 2rem; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
      <div style="text-align: center; border-bottom: 2px solid #037ef3; padding-bottom: 1.5rem; margin-bottom: 2rem;">
        <h1 style="color: #037ef3; margin: 0; font-size: 1.8rem; letter-spacing: 1px;">AIESEC İstanbul</h1>
        <p style="color: #9ca3af; margin: 0.5rem 0 0 0; font-size: 1rem;">Alumni Gündemi 📰</p>
      </div>
  `;

  if (customIntro && customIntro.trim()) {
    htmlContent += `
      <div style="margin-bottom: 2rem; padding: 1.25rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-size: 0.95rem; line-height: 1.6; color: #f3f4f6; white-space: pre-wrap;">${esc(customIntro)}</div>
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
          <h4 style="margin: 0.5rem 0 0.25rem 0; color: #fff; font-size: 0.9rem;">${esc(al.name)}</h4>
          <span style="font-size: 0.75rem; color: #037ef3;">EB ${esc(al.eb_year || '')}</span>
        </div>
      `;
    });
    htmlContent += `</div></div>`;
  }

  if (newJobs.length > 0) {
    htmlContent += `
      <div style="margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.2rem; border-left: 4px solid #10b981; padding-left: 0.5rem; margin-bottom: 1rem;">💼 Yeni İş &amp; Staj İlanları</h2>
    `;
    newJobs.forEach(job => {
      const desc = job.description || '';
      htmlContent += `
        <div style="background-color: #111827; padding: 1rem; border-radius: 8px; border: 1px solid #1f2937; margin-bottom: 0.75rem;">
          <h3 style="margin: 0 0 0.25rem 0; color: #fff; font-size: 1.05rem;">${esc(job.title)}</h3>
          <h4 style="margin: 0 0 0.5rem 0; color: #10b981; font-size: 0.9rem;">${esc(job.company)}</h4>
          <p style="margin: 0; color: #9ca3af; font-size: 0.85rem; line-height: 1.4;">${esc(desc.substring(0, 120))}${desc.length > 120 ? '...' : ''}</p>
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
          <p style="margin: 0 0 0.5rem 0; color: #f3f4f6; font-size: 0.9rem; font-style: italic;">"${esc(mem.caption || '')}"</p>
          <span style="font-size: 0.75rem; color: #9ca3af;">— ${esc(mem.user_name)} (${esc(mem.team_year)} Dönemi)</span>
        </div>
      `;
    });
    htmlContent += `</div>`;
  }

  if ((extraTitle && extraTitle.trim()) || (extraContent && extraContent.trim())) {
    htmlContent += `
      <div style="margin-bottom: 2rem;">
        <h2 style="color: #fff; font-size: 1.2rem; border-left: 4px solid #a78bfa; padding-left: 0.5rem; margin-bottom: 1rem;">${extraTitle ? esc(extraTitle.trim()) : '📌 Editörden'}</h2>
        <div style="background-color: #111827; padding: 1.25rem; border-radius: 8px; border: 1px solid #1f2937; font-size: 0.9rem; line-height: 1.7; color: #f3f4f6; white-space: pre-wrap;">${extraContent ? esc(extraContent.trim()) : ''}</div>
      </div>
    `;
  }

  htmlContent += `
      <div style="text-align: center; border-top: 1px solid #1f2937; padding-top: 1.5rem; margin-top: 2rem; font-size: 0.8rem; color: #6b7280;">
        <p>AIESEC İstanbul Mezunlar Arşivi topluluk bültenidir.</p>
        <p style="margin: 0.25rem 0 0 0;">Yeni gelişmeleri kaçırmamak için <a href="${SITE_URL}" style="color: #037ef3; text-decoration: none;">Platformu Ziyaret Edin</a>.</p>
      </div>
    </div>
  `;

  // 6. Send to each recipient
  let sentCount = 0;
  for (const u of users) {
    if (!u.email) continue;
    const recipientEmail = u.email.trim().toLowerCase();
    try {
      const isSent = await sendMailHelper({
        to: recipientEmail,
        subject: customSubject || 'Alumni Gündemi 📰',
        html: htmlContent
      });
      if (isSent) sentCount++;
    } catch (sendErr) {
      console.error(`Failed to send digest email to ${recipientEmail}:`, sendErr.message || sendErr);
    }
  }

  return { success: true, sent: sentCount, reason: 'Digest processed' };
}

module.exports = { sendWeeklyDigest };
