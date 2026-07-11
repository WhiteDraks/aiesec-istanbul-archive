const { getSQL } = require('../config/database');

const Job = {
  async create({ user_id, title, company, location, type, description, link }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO jobs (user_id, title, company, location, type, description, link)
      VALUES (${user_id}, ${title.trim()}, ${company.trim()}, ${location ? location.trim() : null}, ${type.trim()}, ${description.trim()}, ${link ? link.trim() : null})
      RETURNING *
    `;
    return rows[0];
  },

  async findAll() {
    const sql = getSQL();
    return await sql`
      SELECT j.*, u.name as user_name, u.photo as user_photo
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      ORDER BY j.created_at DESC
    `;
  },

  async delete(id, user_id, user_role) {
    const sql = getSQL();
    if (user_role === 'admin') {
      return await sql`DELETE FROM jobs WHERE id = ${id}`;
    } else {
      return await sql`DELETE FROM jobs WHERE id = ${id} AND user_id = ${user_id}`;
    }
  }
};

module.exports = Job;
