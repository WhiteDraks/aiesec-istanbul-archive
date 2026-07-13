const { getSQL } = require('../config/database');

const HeritageDocument = {
  async findAll(filters = {}) {
    const sql = getSQL();
    const { category, search, year } = filters;

    // Direct SQL builder approach
    let query = sql`
      SELECT hd.*, u.name as uploader_name 
      FROM heritage_documents hd
      LEFT JOIN users u ON hd.uploaded_by = u.id
      WHERE 1=1
    `;

    if (category) {
      query = sql`${query} AND hd.category = ${category}`;
    }

    if (year) {
      query = sql`${query} AND hd.year = ${year}`;
    }

    if (search) {
      const searchPattern = `%${search}%`;
      query = sql`${query} AND (hd.title ILIKE ${searchPattern} OR hd.description ILIKE ${searchPattern})`;
    }

    query = sql`${query} ORDER BY hd.year DESC, hd.created_at DESC`;

    return await query;
  },

  async findById(id) {
    const sql = getSQL();
    const rows = await sql`
      SELECT hd.*, u.name as uploader_name 
      FROM heritage_documents hd
      LEFT JOIN users u ON hd.uploaded_by = u.id
      WHERE hd.id = ${id} 
      LIMIT 1
    `;
    return rows[0] || null;
  },

  async create({ title, description, category, year, file_url, file_type, uploaded_by }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO heritage_documents (title, description, category, year, file_url, file_type, uploaded_by)
      VALUES (${title}, ${description}, ${category}, ${year}, ${file_url}, ${file_type}, ${uploaded_by})
      RETURNING *
    `;
    return rows[0];
  },

  async update(id, { title, description, category, year, file_url, file_type }) {
    const sql = getSQL();
    const rows = await sql`
      UPDATE heritage_documents
      SET title = ${title},
          description = ${description},
          category = ${category},
          year = ${year},
          file_url = ${file_url},
          file_type = ${file_type}
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0];
  },

  async delete(id) {
    const sql = getSQL();
    await sql`
      DELETE FROM heritage_documents WHERE id = ${id}
    `;
    return true;
  },

  async getAvailableYears() {
    const sql = getSQL();
    const rows = await sql`
      SELECT DISTINCT year FROM heritage_documents WHERE year IS NOT NULL AND year != '' ORDER BY year DESC
    `;
    return rows.map(r => r.year);
  }
};

module.exports = HeritageDocument;
