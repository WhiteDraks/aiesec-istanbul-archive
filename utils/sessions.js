const { getSQL } = require('../config/database');

/**
 * Bir kullanıcının açık oturumlarını (isteğe bağlı olarak biri hariç) sonlandırır.
 * Şifre değişince, hesap reddedilince/silinince veya yetki değişince çağrılır;
 * böylece çalınmış/eski bir oturum şifre değişiminden sonra da geçerli kalmaz.
 */
async function revokeUserSessions(userId, exceptSid = null) {
  try {
    const sql = getSQL();
    if (exceptSid) {
      await sql`DELETE FROM session WHERE (sess::jsonb ->> 'userId') = ${String(userId)} AND sid <> ${exceptSid}`;
    } else {
      await sql`DELETE FROM session WHERE (sess::jsonb ->> 'userId') = ${String(userId)}`;
    }
  } catch (err) {
    console.error('Oturumlar sonlandırılamadı:', err.message);
  }
}

module.exports = { revokeUserSessions };
