const { getSQL } = require('../config/database');
const bcrypt = require('bcryptjs');

// Note: @neondatabase/serverless tagged template literals return rows directly (not {rows})
const User = {
  async findByEmail(email) {
    const sql = getSQL();
    const rows = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1
    `;
    return rows[0] || null;
  },

  async findByEmailWithPassword(email) {
    const sql = getSQL();
    const rows = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1
    `;
    return rows[0] || null;
  },

  async findById(id) {
    const sql = getSQL();
    const rows = await sql`
      SELECT id, name, email, role, status, school, eb_year, approved_at, created_at,
             photo, department, linkedin, workplaces, sector, phone, show_phone, aiesec_journey, roles_history,
             city, country, is_mentor, is_mentee, mentorship_details
      FROM users WHERE id = ${id} LIMIT 1
    `;
    return rows[0] || null;
  },

  async updateProfile(id, profileData) {
    const sql = getSQL();
    const rows = await sql`
      UPDATE users
      SET 
        name = ${profileData.name},
        school = ${profileData.school || null},
        department = ${profileData.department || null},
        eb_year = ${profileData.eb_year || null},
        roles_history = ${JSON.stringify(profileData.roles_history || [])}::jsonb,
        linkedin = ${profileData.linkedin || null},
        workplaces = ${profileData.workplaces || null},
        sector = ${profileData.sector || null},
        phone = ${profileData.phone || null},
        show_phone = ${profileData.show_phone || false},
        aiesec_journey = ${profileData.aiesec_journey || null},
        photo = COALESCE(${profileData.photo || null}, photo),
        city = ${profileData.city || null},
        country = ${profileData.country || null},
        is_mentor = ${profileData.is_mentor || false},
        is_mentee = ${profileData.is_mentee || false},
        mentorship_details = ${profileData.mentorship_details || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0];
  },

  async findAllApprovedWithSector(sector = null) {
    const sql = getSQL();
    if (sector) {
      return await sql`
        SELECT id, name, email, school, department, eb_year, roles_history, photo, linkedin, workplaces, sector, aiesec_journey, city, country, is_mentor, is_mentee, mentorship_details, phone, show_phone
        FROM users
        WHERE status = 'approved' AND sector = ${sector}
        ORDER BY name ASC
      `;
    }
    return await sql`
      SELECT id, name, email, school, department, eb_year, roles_history, photo, linkedin, workplaces, sector, aiesec_journey, city, country, is_mentor, is_mentee, mentorship_details, phone, show_phone
      FROM users
      WHERE status = 'approved'
      ORDER BY name ASC
    `;
  },

  async searchApproved({ query, sector, city, country, is_mentor }) {
    const sql = getSQL();
    const q = query ? `%${query.trim()}%` : null;
    const sect = sector ? sector.trim() : null;
    const c = city ? city.trim() : null;
    const co = country ? country.trim() : null;
    const mentorOnly = is_mentor === 'true';

    // Query filters (searches name, workplaces, department, school, and AIESEC roles history)
    return await sql`
      SELECT id, name, email, school, department, eb_year, roles_history, photo, linkedin, workplaces, sector, aiesec_journey, city, country, is_mentor, is_mentee, mentorship_details, phone, show_phone
      FROM users
      WHERE status = 'approved'
        AND (${q}::text IS NULL OR 
             name ILIKE ${q} OR 
             workplaces ILIKE ${q} OR 
             department ILIKE ${q} OR 
             school ILIKE ${q} OR
             roles_history::text ILIKE ${q})
        AND (${sect}::text IS NULL OR sector = ${sect})
        AND (${c}::text IS NULL OR city = ${c})
        AND (${co}::text IS NULL OR country = ${co})
        AND (${mentorOnly}::boolean = FALSE OR is_mentor = TRUE)
      ORDER BY name ASC
    `;
  },

  async create({ name, email, password, role = 'user', status = 'pending', school = '', eb_year = '', eb_role = '' }) {
    const sql = getSQL();
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);
    // Kayıt sırasında girilen EB dönemi, kullanıcıyı otomatik olarak o dönemin
    // EB takımına ekler (EB üyeliği roles_history üzerinden türetiliyor, bkz. routes/eb.js).
    const roles_history = eb_year ? [{ year: eb_year, role: eb_role || '' }] : [];
    const rows = await sql`
      INSERT INTO users (name, email, password, role, status, school, eb_year, roles_history)
      VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${hashed}, ${role}, ${status}, ${school || null}, ${eb_year || null}, ${JSON.stringify(roles_history)}::jsonb)
      RETURNING id, name, email, role, status, school, eb_year, roles_history, created_at
    `;
    return rows[0];
  },

  async comparePassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
  },

  async updateStatus(id, status, approvedBy = null) {
    const sql = getSQL();
    const rows = await sql`
      UPDATE users
      SET status      = ${status},
          approved_at = ${status === 'approved' ? new Date() : null},
          approved_by = ${approvedBy},
          updated_at  = NOW()
      WHERE id = ${id}
      RETURNING id, name, email, role, status
    `;
    return rows[0];
  },

  async delete(id) {
    const sql = getSQL();
    await sql`DELETE FROM users WHERE id = ${id}`;
  },

  async findAllByStatus(status) {
    const sql = getSQL();
    const rows = await sql`
      SELECT id, name, email, role, status, school, eb_year, approved_at, created_at, updated_at
      FROM users
      WHERE role = 'user' AND status = ${status}
      ORDER BY created_at DESC
    `;
    return rows;
  },

  async countByRole(role = 'user') {
    const sql = getSQL();
    const rows = await sql`SELECT COUNT(*) AS total FROM users WHERE role = ${role}`;
    return parseInt(rows[0].total, 10);
  },
};

module.exports = User;
