const { getSQL } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
  async findByEmail(email) {
    const sql = getSQL();
    const { rows } = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1
    `;
    return rows[0] || null;
  },

  async findById(id) {
    const sql = getSQL();
    const { rows } = await sql`
      SELECT id, name, email, role, status, school, eb_year, approved_at, created_at
      FROM users WHERE id = ${id} LIMIT 1
    `;
    return rows[0] || null;
  },

  async create({ name, email, password, role = 'user', status = 'pending', school = '', eb_year = '' }) {
    const sql = getSQL();
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);
    const { rows } = await sql`
      INSERT INTO users (name, email, password, role, status, school, eb_year)
      VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${hashed}, ${role}, ${status}, ${school}, ${eb_year})
      RETURNING id, name, email, role, status, school, eb_year, created_at
    `;
    return rows[0];
  },

  async comparePassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
  },

  async updateStatus(id, status, approvedBy = null) {
    const sql = getSQL();
    const { rows } = await sql`
      UPDATE users
      SET status = ${status},
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
    const { rows } = await sql`
      SELECT id, name, email, role, status, school, eb_year, approved_at, created_at, updated_at
      FROM users
      WHERE role = 'user' AND status = ${status}
      ORDER BY created_at DESC
    `;
    return rows;
  },

  async countByRole(role = 'user') {
    const sql = getSQL();
    const { rows } = await sql`SELECT COUNT(*) AS total FROM users WHERE role = ${role}`;
    return parseInt(rows[0].total, 10);
  },
};

module.exports = User;
