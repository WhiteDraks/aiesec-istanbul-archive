require('dotenv').config();
const { initDB, getSQL } = require('../config/database');
const bcrypt = require('bcryptjs');

async function main() {
  await initDB();
  const sql = getSQL();
  
  const name = "Elif Kurnaz Test";
  const email = "elifkrnz963@gmail.com";
  const password = "Password123!";
  const role = "user";
  const status = "pending";
  const school = "İstanbul Üniversitesi";
  const eb_year = "26.27";
  const eb_role = "LCVP F&L";
  
  // Clean up any existing test user with this email
  await sql`DELETE FROM users WHERE email = ${email}`;
  
  const salt = await bcrypt.genSalt(12);
  const hashed = await bcrypt.hash(password, salt);
  const roles_history = [{ year: eb_year, role: eb_role }];
  
  await sql`
    INSERT INTO users (name, email, password, role, status, school, eb_year, roles_history)
    VALUES (${name}, ${email}, ${hashed}, ${role}, ${status}, ${school}, ${eb_year}, ${JSON.stringify(roles_history)}::jsonb)
  `;
  
  console.log(`\n================================================================================`);
  console.log(`✅ Test kullanıcısı başarıyla veritabanına eklendi: ${email}`);
  console.log(`👉 Şimdi canlı sitenizdeki Admin Paneline (/admin) girip bu kullanıcıyı onaylayın.`);
  console.log(`================================================================================\n`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
