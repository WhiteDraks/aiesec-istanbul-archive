/**
 * EB verisi için Excel (.xlsx) içe/dışa aktarma.
 *
 * EB üyeliği users.roles_history üzerinden türetildiği için içe aktarma, "Üyeler"
 * sayfasındaki her satırı bir (kişi, dönem, görev) kaydı olarak ele alır:
 *   - Kişi e-posta ile (e-posta yoksa tam ad ile) mevcut kullanıcıyla eşleşir.
 *   - Yoksa onaylı (status=approved) yeni bir kullanıcı oluşturulur; giriş yapılamayan
 *     bir parola ile saklanır, kişi "Şifremi unuttum" ile hesabı sahiplenebilir.
 *   - Mevcut kullanıcıların dolu alanları EZİLMEZ; yalnızca boş alanlar doldurulur.
 *   - Rol/durum (admin vb.) hiçbir zaman değiştirilmez.
 * "Dönemler" sayfası (isteğe bağlı) dönem başlığı/açıklaması/başarılarını günceller.
 */
const crypto = require('crypto');
const writeXlsx = require('write-excel-file/node');
const readXlsx = require('read-excel-file/node');
const { getSQL } = require('../config/database');
const { stripTags } = require('./sanitize');
const { safeUrl } = require('./security');

const MAX_PEOPLE = 500;
const MAX_ROWS = 1500;
const MAX_UNCOMPRESSED = 50 * 1024 * 1024;

const MEMBER_COLUMNS = [
  { key: 'name',     label: 'Ad Soyad *',        aliases: ['adsoyad', 'ad', 'isim', 'name', 'fullname'], width: 26 },
  { key: 'email',    label: 'E-posta',           aliases: ['eposta', 'email', 'mail', 'epostaadresi'], width: 30 },
  { key: 'year',     label: 'Dönem *',           aliases: ['donem', 'yil', 'ebdonemi', 'year', 'period'], width: 14 },
  { key: 'role',     label: 'Görev *',           aliases: ['gorev', 'rol', 'pozisyon', 'role', 'position'], width: 26 },
  { key: 'school',   label: 'Okul',              aliases: ['okul', 'universite', 'school'], width: 26 },
  { key: 'department', label: 'Bölüm',           aliases: ['bolum', 'department'], width: 22 },
  { key: 'linkedin', label: 'LinkedIn',          aliases: ['linkedin', 'linkedinlinki'], width: 30 },
  { key: 'phone',    label: 'Telefon',           aliases: ['telefon', 'tel', 'phone'], width: 16 },
  { key: 'city',     label: 'Şehir',             aliases: ['sehir', 'il', 'city'], width: 14 },
  { key: 'country',  label: 'Ülke',              aliases: ['ulke', 'country'], width: 14 },
  { key: 'sector',   label: 'Sektör',            aliases: ['sektor', 'sector'], width: 18 },
  { key: 'workplaces', label: 'İş Yeri',         aliases: ['isyeri', 'sirket', 'kurum', 'workplace', 'company'], width: 24 },
  { key: 'journey',  label: 'AIESEC Hikayesi',   aliases: ['aiesechikayesi', 'hikaye', 'yolculuk', 'aiesecyolculugu', 'journey'], width: 40 },
];
const TEAM_COLUMNS = [
  { key: 'year',        label: 'Dönem *',   aliases: ['donem', 'yil', 'year'], width: 14 },
  { key: 'title',       label: 'Başlık',    aliases: ['baslik', 'title', 'ad'], width: 30 },
  { key: 'description', label: 'Açıklama',  aliases: ['aciklama', 'description'], width: 50 },
  { key: 'achievements', label: 'Başarılar (; ile ayırın)', aliases: ['basarilar', 'achievements'], width: 60 },
];

const norm = (s) => String(s || '').toLowerCase()
  .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
  .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]/g, '');

function cellText(v, max = 500) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return stripTags(String(v)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

/** "2025-2026", "2025/26", "25-26", "2025 – 2026" → "2025-2026"; geçersizse null. */
function normalizeYear(raw) {
  const s = String(raw === null || raw === undefined ? '' : raw).trim().replace(/[–—/\\.\s]+/g, '-');
  let m = s.match(/^(\d{4})-(\d{4})$/);
  if (!m) m = s.match(/^(\d{4})-(\d{2})$/) && [null, s.slice(0, 4), s.slice(0, 2) + s.slice(5, 7)];
  if (!m) m = s.match(/^(\d{2})-(\d{2})$/) && [null, '20' + s.slice(0, 2), '20' + s.slice(3, 5)];
  if (!m) return null;
  const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  if (b !== a + 1 || a < 1950 || a > 2100) return null;
  return `${a}-${b}`;
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

/** .xlsx içindeki sıkıştırılmamış toplam boyutu zip dizininden okur (zip bombası koruması). */
function assertSafeZip(buf) {
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('Dosya geçerli bir .xlsx (Excel) dosyası değil.');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Excel dosyası bozuk.');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16), total = 0;
  if (count > 2000) throw new Error('Excel dosyası beklenenden fazla parça içeriyor.');
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Excel dosyası bozuk.');
    total += buf.readUInt32LE(off + 24);
    off += 46 + buf.readUInt16LE(off + 28) + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
  }
  if (total > MAX_UNCOMPRESSED) throw new Error('Excel dosyası açıldığında çok büyük (en fazla 50 MB).');
}

function mapHeader(headerRow, columns) {
  const idx = {};
  headerRow.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    const col = columns.find(c => norm(c.label.replace('*', '')) === n || c.aliases.includes(n));
    if (col && idx[col.key] === undefined) idx[col.key] = i;
  });
  return idx;
}

/** Excel dosyasını doğrulayıp kişi/dönem listesine çevirir. Veritabanına dokunmaz. */
async function parseWorkbook(buffer) {
  assertSafeZip(buffer);
  let sheets;
  try { sheets = await readXlsx(buffer); } catch (e) { throw new Error('Excel dosyası okunamadı: ' + (e.message || 'bozuk dosya')); }
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error('Dosyada sayfa bulunamadı.');

  const find = (names) => sheets.find(s => names.includes(norm(s.sheet)));
  const memberSheet = find(['uyeler', 'members', 'ebuyeleri', 'eb']) || sheets[0];
  const teamSheet = find(['donemler', 'teams', 'periods']);

  const errors = [], warnings = [];
  const people = new Map();   // anahtar → kişi
  const rows = memberSheet.data || [];
  if (rows.length < 2) throw new Error('"Üyeler" sayfasında veri satırı yok.');
  if (rows.length - 1 > MAX_ROWS) throw new Error(`En fazla ${MAX_ROWS} satır içe aktarılabilir.`);

  const idx = mapHeader(rows[0], MEMBER_COLUMNS);
  for (const req of ['name', 'year', 'role']) {
    if (idx[req] === undefined) throw new Error(`Zorunlu sütun bulunamadı: ${MEMBER_COLUMNS.find(c => c.key === req).label.replace(' *', '')}. Şablonu indirip başlıkları değiştirmeden kullanın.`);
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const get = (k) => (idx[k] === undefined ? '' : row[idx[k]]);
    if (!row.some(v => v !== null && v !== undefined && String(v).trim() !== '')) continue;
    const line = r + 1;

    const name = cellText(get('name'), 100);
    const email = cellText(get('email'), 254).toLowerCase();
    const year = normalizeYear(get('year'));
    const role = cellText(get('role'), 150);
    if (name.length < 2) { errors.push({ line, message: 'Ad Soyad boş veya çok kısa.' }); continue; }
    if (!year) { errors.push({ line, name, message: `Dönem geçersiz ("${cellText(get('year'), 30)}"). Örnek: 2025-2026` }); continue; }
    if (!role) { errors.push({ line, name, message: 'Görev boş.' }); continue; }
    if (email && !EMAIL_RE.test(email)) { errors.push({ line, name, message: `E-posta geçersiz ("${email.slice(0, 40)}").` }); continue; }

    let linkedin = cellText(get('linkedin'), 300);
    if (linkedin) { const u = safeUrl(linkedin); if (!u) { warnings.push({ line, name, message: 'LinkedIn adresi geçersiz, atlandı.' }); linkedin = ''; } else linkedin = u; }

    const fields = {
      school: cellText(get('school'), 150), department: cellText(get('department'), 150), linkedin,
      phone: cellText(get('phone'), 30).replace(/[^\d+()\-\s]/g, ''), city: cellText(get('city'), 100),
      country: cellText(get('country'), 100), sector: cellText(get('sector'), 100),
      workplaces: cellText(get('workplaces'), 300), journey: cellText(get('journey'), 5000),
    };
    const key = email || 'name:' + norm(name);
    let p = people.get(key);
    if (!p) {
      if (people.size >= MAX_PEOPLE) throw new Error(`En fazla ${MAX_PEOPLE} kişi içe aktarılabilir. Dosyayı bölün.`);
      p = { key, name, email, roles: [], fields: {}, lines: [] };
      people.set(key, p);
    }
    p.lines.push(line);
    for (const [k, v] of Object.entries(fields)) if (v && !p.fields[k]) p.fields[k] = v;
    const dup = p.roles.find(x => x.year === year);
    if (dup) {
      if (dup.role !== role) warnings.push({ line, name, message: `${year} için birden fazla görev var; ilki kullanıldı ("${dup.role}").` });
    } else p.roles.push({ year, role });
  }

  const teams = [];
  if (teamSheet && teamSheet.data && teamSheet.data.length > 1) {
    const th = mapHeader(teamSheet.data[0], TEAM_COLUMNS);
    if (th.year !== undefined) {
      for (let r = 1; r < teamSheet.data.length; r++) {
        const row = teamSheet.data[r] || [];
        const g = (k) => (th[k] === undefined ? '' : row[th[k]]);
        if (!row.some(v => v !== null && v !== undefined && String(v).trim() !== '')) continue;
        const year = normalizeYear(g('year'));
        if (!year) { errors.push({ line: r + 1, sheet: teamSheet.sheet, message: `Dönem geçersiz ("${cellText(g('year'), 30)}").` }); continue; }
        const achievements = cellText(g('achievements'), 4000).split(/[;\n]+/).map(a => a.trim()).filter(Boolean).slice(0, 30);
        teams.push({ year, title: cellText(g('title'), 255), description: cellText(g('description'), 2000), achievements });
      }
    }
  }

  const list = [...people.values()];
  if (list.length === 0 && teams.length === 0) throw new Error('İçe aktarılacak geçerli satır bulunamadı.');
  return { people: list, teams, errors, warnings, totalRows: rows.length - 1 };
}

const FIELD_TO_COL = { school: 'school', department: 'department', linkedin: 'linkedin', phone: 'phone', city: 'city', country: 'country', sector: 'sector', workplaces: 'workplaces', journey: 'aiesec_journey' };

/** Ayrıştırılmış veriyi mevcut kullanıcılarla eşleştirip ne yapılacağını hesaplar (yazmaz). */
async function buildPlan(parsed) {
  const sql = getSQL();
  const emails = parsed.people.map(p => p.email).filter(Boolean);
  const byEmail = new Map();
  if (emails.length) {
    const rows = await sql`SELECT id, name, email, role, status, school, department, linkedin, phone, city, country, sector, workplaces, aiesec_journey, roles_history, eb_year FROM users WHERE lower(email) = ANY(${emails}::text[])`;
    rows.forEach(u => byEmail.set(u.email.toLowerCase(), u));
  }
  const nameKeys = parsed.people.filter(p => !p.email).map(p => p.name.toLowerCase());
  const byName = new Map();
  if (nameKeys.length) {
    const rows = await sql`SELECT id, name, email, role, status, school, department, linkedin, phone, city, country, sector, workplaces, aiesec_journey, roles_history, eb_year FROM users WHERE lower(name) = ANY(${nameKeys}::text[])`;
    rows.forEach(u => { const k = u.name.toLowerCase(); byName.set(k, (byName.get(k) || []).concat(u)); });
  }
  const existingTeams = new Set((await sql`SELECT year FROM eb_teams`).map(t => t.year));

  const items = [];
  for (const p of parsed.people) {
    let user = null, note = '';
    if (p.email) user = byEmail.get(p.email) || null;
    else {
      const m = byName.get(p.name.toLowerCase()) || [];
      if (m.length === 1) { user = m[0]; note = 'Ad ile eşleşti (e-posta yok)'; }
      else if (m.length > 1) { items.push({ person: p, action: 'skip', note: 'Aynı adla birden fazla kullanıcı var; e-posta ekleyin.' }); continue; }
    }
    if (!user) { items.push({ person: p, action: 'create', note: p.email ? '' : 'E-posta yok: geçici adres atanacak' }); continue; }

    const current = Array.isArray(user.roles_history) ? user.roles_history : [];
    const merged = current.map(r => ({ ...r }));
    let added = 0, changed = 0;
    for (const nr of p.roles) {
      const ex = merged.find(r => r.year === nr.year);
      if (!ex) { merged.push({ year: nr.year, role: nr.role }); added++; }
      else if ((ex.role || '') !== nr.role) { ex.role = nr.role; changed++; }
    }
    const fills = Object.keys(p.fields).filter(k => !user[FIELD_TO_COL[k]]);
    items.push({
      person: p, action: (added || changed || fills.length) ? 'update' : 'nochange', user,
      merged, added, changed, fills,
      note: [note, user.status !== 'approved' ? `Hesap durumu "${user.status}": onaylanana kadar EB sayfalarında görünmez` : ''].filter(Boolean).join(' · '),
    });
  }
  const years = new Set(); parsed.people.forEach(p => p.roles.forEach(r => years.add(r.year))); parsed.teams.forEach(t => years.add(t.year));
  const newTeams = [...years].filter(y => !existingTeams.has(y));
  const summary = {
    create: items.filter(i => i.action === 'create').length,
    update: items.filter(i => i.action === 'update').length,
    nochange: items.filter(i => i.action === 'nochange').length,
    skip: items.filter(i => i.action === 'skip').length,
    newTeams: newTeams.length, teamUpdates: parsed.teams.length,
  };
  return { items, newTeams, summary };
}

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/** Planı veritabanına uygular. Toplu (unnest) sorgular kullanır: sunucusuz zaman aşımına karşı hızlı. */
async function applyImport(parsed) {
  const sql = getSQL();
  const plan = await buildPlan(parsed);
  const result = { created: 0, updated: 0, teamsCreated: 0, teamsUpdated: 0, skipped: plan.summary.skip, errors: [] };

  // 1) Yeni kullanıcılar
  const creates = plan.items.filter(i => i.action === 'create');
  for (const part of chunk(creates, 100)) {
    const cols = { n: [], e: [], p: [], s: [], d: [], l: [], ph: [], c: [], co: [], se: [], w: [], j: [], r: [], y: [] };
    for (const it of part) {
      const p = it.person, f = p.fields;
      cols.n.push(p.name);
      cols.e.push(p.email || `import-${crypto.randomUUID()}@import.invalid`);
      cols.p.push('!' + crypto.randomBytes(24).toString('hex')); // geçerli bcrypt hash değil: parolayla girişe kapalı
      cols.s.push(f.school || ''); cols.d.push(f.department || ''); cols.l.push(f.linkedin || ''); cols.ph.push(f.phone || '');
      cols.c.push(f.city || ''); cols.co.push(f.country || ''); cols.se.push(f.sector || ''); cols.w.push(f.workplaces || '');
      cols.j.push(f.journey || '');
      cols.r.push(JSON.stringify(p.roles)); cols.y.push(p.roles[0] ? p.roles[0].year : '');
    }
    try {
      const rows = await sql`
        INSERT INTO users (name, email, password, role, status, approved_at, school, department, linkedin, phone, city, country, sector, workplaces, aiesec_journey, roles_history, eb_year)
        SELECT t.n, t.e, t.p, 'user', 'approved', NOW(), NULLIF(t.s,''), NULLIF(t.d,''), NULLIF(t.l,''), NULLIF(t.ph,''), NULLIF(t.c,''), NULLIF(t.co,''), NULLIF(t.se,''), NULLIF(t.w,''), NULLIF(t.j,''), t.r::jsonb, NULLIF(t.y,'')
        FROM unnest(${cols.n}::text[], ${cols.e}::text[], ${cols.p}::text[], ${cols.s}::text[], ${cols.d}::text[], ${cols.l}::text[], ${cols.ph}::text[], ${cols.c}::text[], ${cols.co}::text[], ${cols.se}::text[], ${cols.w}::text[], ${cols.j}::text[], ${cols.r}::text[], ${cols.y}::text[])
          AS t(n, e, p, s, d, l, ph, c, co, se, w, j, r, y)
        ON CONFLICT (email) DO NOTHING
        RETURNING id`;
      result.created += rows.length;
      if (rows.length < part.length) result.errors.push(`${part.length - rows.length} kişi eklenemedi (e-posta çakışması).`);
    } catch (err) {
      console.error('Import create error:', err.message);
      result.errors.push('Yeni kullanıcılar eklenirken hata oluştu.');
    }
  }

  // 2) Mevcut kullanıcılar: rol birleştirme + yalnızca boş alanları doldurma
  const updates = plan.items.filter(i => i.action === 'update');
  for (const part of chunk(updates, 100)) {
    const c = { id: [], r: [], y: [], s: [], d: [], l: [], ph: [], c: [], co: [], se: [], w: [], j: [] };
    for (const it of part) {
      const f = it.person.fields;
      c.id.push(it.user.id); c.r.push(JSON.stringify(it.merged)); c.y.push(it.merged[0] ? it.merged[0].year : '');
      c.s.push(f.school || ''); c.d.push(f.department || ''); c.l.push(f.linkedin || ''); c.ph.push(f.phone || '');
      c.c.push(f.city || ''); c.co.push(f.country || ''); c.se.push(f.sector || ''); c.w.push(f.workplaces || ''); c.j.push(f.journey || '');
    }
    try {
      const rows = await sql`
        UPDATE users u SET
          roles_history = t.r::jsonb,
          eb_year = COALESCE(NULLIF(u.eb_year,''), NULLIF(t.y,'')),
          school = COALESCE(NULLIF(u.school,''), NULLIF(t.s,'')),
          department = COALESCE(NULLIF(u.department,''), NULLIF(t.d,'')),
          linkedin = COALESCE(NULLIF(u.linkedin,''), NULLIF(t.l,'')),
          phone = COALESCE(NULLIF(u.phone,''), NULLIF(t.ph,'')),
          city = COALESCE(NULLIF(u.city,''), NULLIF(t.c,'')),
          country = COALESCE(NULLIF(u.country,''), NULLIF(t.co,'')),
          sector = COALESCE(NULLIF(u.sector,''), NULLIF(t.se,'')),
          workplaces = COALESCE(NULLIF(u.workplaces,''), NULLIF(t.w,'')),
          aiesec_journey = COALESCE(NULLIF(u.aiesec_journey,''), NULLIF(t.j,'')),
          updated_at = NOW()
        FROM unnest(${c.id}::uuid[], ${c.r}::text[], ${c.y}::text[], ${c.s}::text[], ${c.d}::text[], ${c.l}::text[], ${c.ph}::text[], ${c.c}::text[], ${c.co}::text[], ${c.se}::text[], ${c.w}::text[], ${c.j}::text[])
          AS t(id, r, y, s, d, l, ph, c, co, se, w, j)
        WHERE u.id = t.id
        RETURNING u.id`;
      result.updated += rows.length;
    } catch (err) {
      console.error('Import update error:', err.message);
      result.errors.push('Mevcut kullanıcılar güncellenirken hata oluştu.');
    }
  }

  // 3) Dönem (eb_teams) kayıtları
  const EBTeam = require('../models/EBTeam');
  const allYears = new Set(); parsed.people.forEach(p => p.roles.forEach(r => allYears.add(r.year))); parsed.teams.forEach(t => allYears.add(t.year));
  for (const year of allYears) {
    try {
      const had = await EBTeam.findByYear(year);
      const team = had || await EBTeam.findOrCreateByYear(year);
      if (!had) result.teamsCreated++;
      const meta = parsed.teams.find(t => t.year === year);
      if (meta && (meta.title || meta.description || meta.achievements.length)) {
        await EBTeam.update(team.id, {
          title: meta.title || undefined,
          description: meta.description || undefined,
          achievements: meta.achievements.length ? meta.achievements : undefined,
        });
        result.teamsUpdated++;
      }
    } catch (err) {
      console.error('Import team error:', year, err.message);
      result.errors.push(`${year} dönemi kaydedilemedi.`);
    }
  }
  return result;
}

const H = (v) => ({ value: v, fontWeight: 'bold', backgroundColor: '#e8f0fe' });
const C = (v) => ({ value: v === undefined || v === null || v === '' ? undefined : String(v), type: String });

/** Boş şablon (örnek satırlı) üretir. */
async function buildTemplate() {
  const example = ['Ayşe Yılmaz', 'ayse@example.com', '2025-2026', 'Başkan (LCP)', 'İstanbul Üniversitesi', 'İşletme', 'https://www.linkedin.com/in/ayse', '+90 555 000 00 00', 'İstanbul', 'Türkiye', 'Danışmanlık', 'Örnek A.Ş.', 'AIESEC yolculuğumu kısaca anlatan metin.'];
  const example2 = ['Ayşe Yılmaz', 'ayse@example.com', '2024-2025', 'LCVP Finans', '', '', '', '', '', '', '', '', ''];
  const members = [MEMBER_COLUMNS.map(c => H(c.label)), example.map(C), example2.map(C)];
  const teams = [TEAM_COLUMNS.map(c => H(c.label)), ['2025-2026', '2025-2026 Executive Board', 'Dönemi anlatan kısa açıklama', 'Başarı 1; Başarı 2; Başarı 3'].map(C)];
  const help = [
    [H('Excel ile EB verisi içe aktarma')],
    [C('1) "Üyeler" sayfasına her satıra bir (kişi, dönem, görev) yazın. Aynı kişi birden fazla dönemde görev aldıysa her dönem için ayrı satır ekleyin.')],
    [C('2) Zorunlu sütunlar: Ad Soyad, Dönem, Görev. Dönem biçimi 2025-2026 (25-26 ve 2025/26 da kabul edilir).')],
    [C('3) E-posta varsa kişi mevcut kullanıcıyla e-postayla eşleşir. E-posta yoksa tam adla eşleşir; hiç eşleşme yoksa yeni kişi oluşturulur.')],
    [C('4) Mevcut kullanıcıların dolu alanları değiştirilmez, yalnızca boş alanlar doldurulur. Yeni eklenen kişiler "onaylı" olur ve EB sayfalarında görünür.')],
    [C('5) Yeni eklenen kişiler parolayla giriş yapamaz; "Şifremi unuttum" ile hesabı sahiplenebilirler. Telefon numaraları varsayılan olarak GİZLİ kalır.')],
    [C('6) "Dönemler" sayfası isteğe bağlıdır: dönem başlığı, açıklaması ve başarıları (; ile ayırın) için.')],
    [C('7) Örnek satırları silin. En fazla 500 kişi / 1500 satır, dosya boyutu en fazla 5 MB.')],
  ];
  return await writeXlsx([
    { data: members, sheet: 'Üyeler', columns: MEMBER_COLUMNS.map(c => ({ width: c.width })), stickyRowsCount: 1 },
    { data: teams, sheet: 'Dönemler', columns: TEAM_COLUMNS.map(c => ({ width: c.width })), stickyRowsCount: 1 },
    { data: help, sheet: 'Açıklama', columns: [{ width: 130 }] },
  ]).toBuffer();
}

/** Sitedeki onaylı EB üyelerini aynı biçimde dışa aktarır (yedek / toplu düzenleme için). */
async function buildExport() {
  const sql = getSQL();
  const users = await sql`SELECT name, email, school, department, linkedin, phone, city, country, sector, workplaces, aiesec_journey, roles_history FROM users WHERE status = 'approved' ORDER BY name ASC`;
  const teams = await sql`SELECT year, title, description, achievements FROM eb_teams ORDER BY year DESC`;
  const memberRows = [MEMBER_COLUMNS.map(c => H(c.label))];
  for (const u of users) {
    const roles = Array.isArray(u.roles_history) ? u.roles_history.filter(r => r && r.year) : [];
    for (const r of roles) {
      memberRows.push([u.name, u.email && !u.email.endsWith('@import.invalid') ? u.email : '', r.year, r.role || '', u.school, u.department, u.linkedin, u.phone, u.city, u.country, u.sector, u.workplaces, u.aiesec_journey].map(C));
    }
  }
  const teamRows = [TEAM_COLUMNS.map(c => H(c.label))];
  for (const t of teams) teamRows.push([t.year, t.title, t.description, Array.isArray(t.achievements) ? t.achievements.join('; ') : ''].map(C));
  return await writeXlsx([
    { data: memberRows, sheet: 'Üyeler', columns: MEMBER_COLUMNS.map(c => ({ width: c.width })), stickyRowsCount: 1 },
    { data: teamRows, sheet: 'Dönemler', columns: TEAM_COLUMNS.map(c => ({ width: c.width })), stickyRowsCount: 1 },
  ]).toBuffer();
}

module.exports = { parseWorkbook, buildPlan, applyImport, buildTemplate, buildExport, normalizeYear };
