const { getSQL } = require('../config/database');

const Memory = {
  async findByYear(year) {
    const sql = getSQL();
    return await sql`
      SELECT m.id, m.team_year, m.photo_url, m.caption, m.created_at, u.name as user_name
      FROM eb_memories m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.team_year = ${year}
      ORDER BY m.created_at DESC
    `;
  },

  async create({ team_year, user_id, photo_url, caption }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO eb_memories (team_year, user_id, photo_url, caption)
      VALUES (${team_year}, ${user_id}, ${photo_url}, ${caption || null})
      RETURNING *
    `;
    return rows[0];
  },

  async delete(id, user_id, is_admin = false) {
    const sql = getSQL();
    if (is_admin) {
      return await sql`DELETE FROM eb_memories WHERE id = ${id}`;
    }
    return await sql`DELETE FROM eb_memories WHERE id = ${id} AND user_id = ${user_id}`;
  }
};

module.exports = Memory;
