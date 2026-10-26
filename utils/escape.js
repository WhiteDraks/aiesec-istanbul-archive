// HTML'e girecek kullanıcı kaynaklı değerleri kaçırır (e-posta şablonları için).
function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Sitenin kök adresi: SITE_URL ortam değişkeni, yoksa güncel canlı alan adı.
const SITE_URL = (process.env.SITE_URL || 'https://istanbul-alumni-archive.vercel.app').replace(/\/+$/, '');

module.exports = { esc, SITE_URL };
