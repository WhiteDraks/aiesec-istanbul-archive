/**
 * Ortak güvenlik yardımcıları: URL doğrulama, metin normalizasyonu ve
 * yüklenen görsellerin gerçek içeriğini (magic bytes) doğrulama.
 */

// Yalnızca http(s) şemasına izin verir; javascript:, data: vb. şemaları reddeder.
function safeUrl(value) {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : '';
  } catch (e) {
    return '';
  }
}

// Gövdeden gelen değeri (dizi/nesne olabilir) kırpılmış düz metne çevirir.
function str(value, max = 1000) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

// Yerel (aynı site içi) yönlendirme hedefi mi? "//", "/\" ve kontrol karakterlerini reddeder.
function isSafeLocalPath(p) {
  return typeof p === 'string' && /^\/(?![\/\\])[^\r\n\\]*$/.test(p);
}

const IMAGE_SIGNATURES = [
  { ext: 'jpg',  mime: 'image/jpeg', test: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ext: 'png',  mime: 'image/png',  test: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { ext: 'gif',  mime: 'image/gif',  test: b => b.slice(0, 4).toString('ascii') === 'GIF8' },
  { ext: 'webp', mime: 'image/webp', test: b => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
];

// Buffer'ın gerçekten izin verilen bir görsel olup olmadığını döndürür ({ext, mime} | null).
function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return IMAGE_SIGNATURES.find(s => s.test(buffer)) || null;
}

function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.slice(0, 5).toString('ascii') === '%PDF-';
}

module.exports = { safeUrl, str, isSafeLocalPath, detectImage, isPdf };
