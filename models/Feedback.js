const { getSQL } = require('../config/database');

const Feedback = {
  async create({ user_id, name, email, message }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO feedback (user_id, name, email, message)
      VALUES (${user_id || null}, ${name || null}, ${email || null}, ${message})
      RETURNING *
    `;
    return rows[0];
  },

  async findAll() {
    const sql = getSQL();
    return await sql`
      SELECT f.*, u.name as user_name, u.email as user_email
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `;
  },

  async delete(id) {
    const sql = getSQL();
    return await sql`DELETE FROM feedback WHERE id = ${id}`;
  }
};

module.exports = Feedback;
