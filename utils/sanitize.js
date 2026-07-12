/**
 * sanitize-html'in ^2.17.6 sürümü, ESM-only bir bağımlılık olan htmlparser2@12'yi
 * gerektiriyor ve bu, Vercel'in CommonJS çalışma zamanında require() ile
 * yüklenemiyor (her çağrıda ERR_REQUIRE_ESM hatası verip isteği düşürüyor).
 * Bu proje sanitize-html'i yalnızca düz-metin alanlarından TÜM HTML etiketlerini
 * temizlemek için kullanıyordu (allowedTags: [] ile) — bunun için harici bir
 * bağımlılığa ihtiyaç yok.
 */
function stripTags(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/<[^>]*>/g, '');
}

module.exports = { stripTags };
