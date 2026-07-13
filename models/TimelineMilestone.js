const { getSQL } = require('../config/database');

const TimelineMilestone = {
  async findAll() {
    const sql = getSQL();
    return await sql`
      SELECT * FROM timeline_milestones ORDER BY year ASC, created_at ASC
    `;
  },

  async findById(id) {
    const sql = getSQL();
    const rows = await sql`
      SELECT * FROM timeline_milestones WHERE id = ${id} LIMIT 1
    `;
    return rows[0] || null;
  },

  async create({ year, title, description, image_url }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO timeline_milestones (year, title, description, image_url)
      VALUES (${year}, ${title}, ${description}, ${image_url})
      RETURNING *
    `;
    return rows[0];
  },

  async update(id, { year, title, description, image_url }) {
    const sql = getSQL();
    const rows = await sql`
      UPDATE timeline_milestones
      SET year = ${year},
          title = ${title},
          description = ${description},
          image_url = ${image_url}
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0];
  },

  async delete(id) {
    const sql = getSQL();
    await sql`
      DELETE FROM timeline_milestones WHERE id = ${id}
    `;
    return true;
  }
};

module.exports = TimelineMilestone;
