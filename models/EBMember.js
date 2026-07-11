const { getSQL } = require('../config/database');

const EBMember = {
  /**
   * Returns members for a team:
   * normal members first (sort_order ASC), pinned-to-bottom last (Elif Kurnaz always last).
   */
  async findByTeamId(teamId) {
    const sql = getSQL();
    return await sql`
      SELECT * FROM eb_members
      WHERE team_id = ${teamId}
      ORDER BY is_pin_to_bottom ASC, sort_order ASC, name ASC
    `;
  },

  async create({
    teamId, name, role, department, school, email,
    linkedin, aiesecJourney, bio, photo, isPinToBottom, order,
  }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO eb_members
        (team_id, name, role, department, school, email, linkedin,
         aiesec_journey, bio, photo, is_pin_to_bottom, sort_order)
      VALUES
        (${teamId}, ${name}, ${role},
         ${department || null}, ${school || null}, ${email || null},
         ${linkedin || null}, ${aiesecJourney || null}, ${bio || null},
         ${photo || '/images/default-avatar.svg'},
         ${isPinToBottom || false}, ${order || 100})
      RETURNING *
    `;
    return rows[0];
  },
};

module.exports = EBMember;
