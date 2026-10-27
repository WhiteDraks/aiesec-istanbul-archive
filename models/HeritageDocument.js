const { getSQL } = require('../config/database');

const HeritageDocument = {
  async findAll(filters = {}) {
    const sql = getSQL();
    const { category, search, year } = filters;

    // Tek, parametreli sorgu: boş filtreler NULL olarak geçer (sorgu parçalarını iç içe geçirmek sürücüde desteklenmez)
    const searchPattern = search ? `%${String(search).slice(0, 100).replace(/[\\%_]/g, '\\$&')}%` : null;
    return await sql`
      SELECT hd.*, u.name as uploader_name
      FROM heritage_documents hd
      LEFT JOIN users u ON hd.uploaded_by = u.id
      WHERE (${category || null}::text IS NULL OR hd.category = ${category || null}::text)
        AND (${year || null}::text IS NULL OR hd.year = ${year || null}::text)
        AND (${searchPattern}::text IS NULL OR hd.title ILIKE ${searchPattern}::text OR hd.description ILIKE ${searchPattern}::text)
      ORDER BY hd.year DESC, hd.created_at DESC
    `;
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
