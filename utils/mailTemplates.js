/**
 * Düzenlenebilir e-posta taslakları. Metinler site_settings tablosunda `mail_<anahtar>_<alan>` olarak
 * saklanır; boş değer "varsayılan metin" demektir. Admin düz metin yazar ({ad} gibi yer tutucular ve
 * **kalın** desteklenir); HTML her zaman burada üretilir, böylece taslaklardan HTML/script enjekte edilemez.
 */
const { esc } = require('./escape');
const { getSQL } = require('../config/database');

const TEMPLATES = {
  welcome_pending: {
    label: 'Kayıt olana: başvuru alındı',
    hint: 'Kayıt formunu dolduran kişiye anında gider.',
    vars: ['ad'],
    button: null,
    subject: 'AIESEC İstanbul Mezunlar Portalı - Kayıt Talebiniz Alındı 📩',
    body: 'Merhaba {ad},\n\nAIESEC İstanbul Alumni Archive platformuna yaptığınız kayıt talebi **başarıyla alınmıştır.**\n\nÜyeliğinizin doğrulanması ve platformun güvenli kalması amacıyla başvurunuz yöneticilerimiz tarafından incelemeye alınmıştır.\n\nHesabınız onaylandığında giriş yapabilmeniz için size yeni bir onay e-postası göndereceğiz.\n\nGösterdiğiniz ilgi için teşekkür ederiz.',
  },
  approved: {
    label: 'Onaylanınca kullanıcıya',
    hint: 'Admin bir başvuruyu onayladığında gider.',
    vars: ['ad'],
    button: { label: 'Sisteme Giriş Yap', path: '/auth/login' },
    subject: 'AIESEC İstanbul Alumni Archive - Hesabınız Onaylandı! 🎉',
    body: 'Merhaba {ad},\n\nAIESEC İstanbul Alumni Archive sistemine yaptığınız kayıt başvurusu **başarıyla onaylanmıştır!**\n\nArtık sisteme giriş yapabilir, geçmiş dönem takımlarını detaylıca inceleyebilir, diğer mezunların bilgilerine "Mezunlar Rehberi" üzerinden erişebilir ve kendi profil bilgilerinizi güncelleyebilirsiniz.',
    after: 'Aramıza tekrar hoş geldiniz!',
  },
  reset: {
    label: 'Şifre sıfırlama',
    hint: 'Bağlantı otomatik eklenir ve 1 saat geçerlidir; bu süreyi metinde değiştirmeyin.',
    vars: ['ad'],
    button: { label: 'Şifremi Sıfırla', path: null },
    subject: 'AIESEC İstanbul Mezunlar Portalı - Şifre Sıfırlama Talebi 🔑',
    body: 'Merhaba {ad},\n\nHesabınız için şifre sıfırlama talebinde bulundunuz.\n\nAşağıdaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz. Bu bağlantı güvenlik nedeniyle **1 saat** geçerli kalacaktır:',
    after: 'Eğer bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.',
  },
  admin_new: {
    label: 'Adminlere: yeni başvuru',
    hint: 'Yeni kayıt olduğunda tüm adminlere gider.',
    vars: ['ad', 'email'],
    button: { label: 'Admin Paneline Git', path: '/admin' },
    subject: 'AIESEC İstanbul Mezunlar Portalı - Yeni Üye Kayıt Başvurusu 🔔',
    body: 'Sayın Yönetici,\n\nAIESEC İstanbul Alumni Archive sistemine yeni bir üye adayı kayıt başvurusu yapmıştır.\n\n**Aday Detayları**\nAd Soyad: {ad}\nE-posta: {email}\n\nBaşvuruyu değerlendirmek, onaylamak veya reddetmek için lütfen admin paneline giriş yapınız:',
  },
};

const SIGNATURE = {
  sig_name: { label: 'İmza: ad / görev', def: '26-27 LCVP F&L Elif Kurnaz', max: 150 },
  sig_org: { label: 'İmza: kurum', def: 'AIESEC İstanbul', max: 150 },
  sig_note: { label: 'İmza altı not', def: 'Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.', max: 300 },
};

const LIMITS = { subject: 150, body: 3000, button: 40, after: 300 };

const settingKey = (tpl, field) => `mail_${tpl}_${field}`;

async function loadOverrides() {
  try {
    const rows = await getSQL()`SELECT key, value FROM site_settings WHERE key LIKE 'mail\\_%'`;
    const o = {};
    rows.forEach((r) => { o[r.key] = r.value; });
    return o;
  } catch (err) {
    console.error('Mail taslakları okunamadı, varsayılanlar kullanılıyor:', err.message);
    return {};
  }
}

const pick = (v, def) => (typeof v === 'string' && v.trim() ? v : def);

/** Varsayılanla birleştirilmiş güncel taslaklar ve imza. */
async function getConfig() {
  const o = await loadOverrides();
  const templates = {};
  for (const [key, t] of Object.entries(TEMPLATES)) {
    templates[key] = {
      ...t,
      subject: pick(o[settingKey(key, 'subject')], t.subject),
      body: pick(o[settingKey(key, 'body')], t.body),
      buttonLabel: t.button ? pick(o[settingKey(key, 'button')], t.button.label) : null,
      afterText: t.after ? pick(o[settingKey(key, 'after')], t.after) : null,
      customized: ['subject', 'body', 'button', 'after'].some((f) => (o[settingKey(key, f)] || '').trim()),
    };
  }
  const sig = {};
  for (const [k, s] of Object.entries(SIGNATURE)) sig[k] = pick(o['mail_' + k], s.def);
  return { templates, sig };
}

function fill(text, vars, transform) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? transform(String(vars[k] ?? '')) : m));
}

const P = 'style="margin: 0 0 16px 0;"';

function textToHtml(text, vars) {
  const paras = String(text).replace(/\r/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paras.map((p, i) => {
    let h = esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = fill(h, vars, esc).replace(/\n/g, '<br>');
    if (i === 0 && !p.includes('\n') && p.length <= 80) {
      return `<h2 style="color: #111827; font-size: 20px; margin-top: 0;">${h}</h2>`;
    }
    return `<p ${P}>${h}</p>`;
  }).join('\n');
}

/** Taslağı { subject, content, sig } olarak üretir. buttonUrl yalnızca düğmesi olan taslaklar için kullanılır. */
async function buildMail(key, vars, buttonUrl) {
  const { templates, sig } = await getConfig();
  const t = templates[key];
  const subject = fill(t.subject, vars, (v) => v).replace(/[\r\n]+/g, ' ').slice(0, 200);
  let content = textToHtml(t.body, vars);
  if (t.button && buttonUrl) {
    content += `\n<div style="text-align: center; margin: 35px 0;">
      <a href="${esc(buttonUrl)}" style="background-color: #037ef3; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(3,126,243,0.2);">${esc(t.buttonLabel)}</a>
    </div>`;
  }
  if (t.afterText) content += `\n<p style="margin-bottom: 0; color: #374151;">${esc(t.afterText)}</p>`;
  return { subject, content, sig };
}

module.exports = { TEMPLATES, SIGNATURE, LIMITS, settingKey, getConfig, buildMail };
