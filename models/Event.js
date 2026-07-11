const { getSQL } = require('../config/database');

const Event = {
  async create({ title, description, event_date, location, link, created_by }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO events (title, description, event_date, location, link, created_by)
      VALUES (${title.trim()}, ${description.trim()}, ${event_date}, ${location.trim()}, ${link ? link.trim() : null}, ${created_by})
      RETURNING *
    `;
    return rows[0];
  },

  async findAll() {
    const sql = getSQL();
    return await sql`
      SELECT e.*, u.name as creator_name,
             (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.event_date ASC
    `;
  },

  async findById(id) {
    const sql = getSQL();
    const rows = await sql`
      SELECT e.*, u.name as creator_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ${id}
    `;
    return rows[0] || null;
  },

  async getAttendees(eventId) {
    const sql = getSQL();
    return await sql`
      SELECT u.id, u.name, u.photo, u.email
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.id
      WHERE ea.event_id = ${eventId}
    `;
  },

  async isAttending(eventId, userId) {
    const sql = getSQL();
    const rows = await sql`
      SELECT 1 FROM event_attendees
      WHERE event_id = ${eventId} AND user_id = ${userId}
    `;
    return rows.length > 0;
  },

  async attend(eventId, userId) {
    const sql = getSQL();
    return await sql`
      INSERT INTO event_attendees (event_id, user_id)
      VALUES (${eventId}, ${userId})
      ON CONFLICT DO NOTHING
    `;
  },

  async leave(eventId, userId) {
    const sql = getSQL();
    return await sql`
      DELETE FROM event_attendees
      WHERE event_id = ${eventId} AND user_id = ${userId}
    `;
  },

  async delete(id, user_id, user_role) {
    const sql = getSQL();
    if (user_role === 'admin') {
      return await sql`DELETE FROM events WHERE id = ${id}`;
    } else {
      return await sql`DELETE FROM events WHERE id = ${id} AND created_by = ${user_id}`;
    }
  }
};

module.exports = Event;
