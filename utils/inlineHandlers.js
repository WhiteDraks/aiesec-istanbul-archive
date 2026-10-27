/**
 * CSP uyumu için satır-içi olay yazılarını (onclick="..." vb.) çalışma zamanında kaldırır.
 *
 * Şablonlarda 80+ yerde onclick/onsubmit/... özniteliği var. CSP'de `script-src-attr
 * 'unsafe-inline'` açık kalırsa, HTML'e girecek tek bir kaçırılmamış değer bile komut
 * çalıştırabilir. Burada, render edilmiş HTML'deki bu öznitelikler `data-h-<olay>="<id>"`
 * ile değiştirilir; kodların kendisi sayfa sonunda NONCE'lu tek bir <script> içinde
 * fonksiyon olarak tanımlanır ve olaylar belge düzeyinde (delegasyonla) dinlenir.
 * eval/new Function kullanılmaz; her kod sunucuda vm ile sözdizimi açısından doğrulanır.
 *
 * Güvenlik notu: Öznitelik değerleri HTML'den çözülüp koda dönüştüğü için şablonlarda
 * bu özniteliklerin içine kullanıcı verisi YAZILMAMALIDIR (data-* öznitelikleri kullanın).
 */
const crypto = require('crypto');
const vm = require('vm');

const EVENTS = ['click', 'submit', 'change', 'input', 'error'];
const ENTITIES = { '&quot;': '"', '&#34;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' };
const decode = (s) => s.replace(/&(quot|#34|#39|#x27|apos|lt|gt|amp);/g, (m) => ENTITIES[m] || m);

const SKIP = /(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->)/gi;
const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const HANDLER = /\son(click|submit|change|input|error)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function isValidBody(code) {
  try { new vm.Script('(function(event){' + code + '\n})'); return true; } catch (e) { return false; }
}

function transform(html, nonce) {
  const registry = new Map(); // id -> code
  const used = new Set();

  const parts = html.split(SKIP);
  for (let i = 0; i < parts.length; i += 2) { // çift indeksler script/style/yorum DIŞINDAki işaretleme
    parts[i] = parts[i].replace(TAG, (full, name, attrs, selfClose) => {
      if (!/\son[a-z]+\s*=/i.test(attrs)) return full;
      const newAttrs = attrs.replace(HANDLER, (m, evt, dq, sq) => {
        const code = decode(dq !== undefined ? dq : sq).trim();
        evt = evt.toLowerCase();
        if (!code || !isValidBody(code)) return ''; // bozuk/boş kodu sessizce at (eskiden de çalışmazdı)
        const id = 'h' + crypto.createHash('sha1').update(code).digest('hex').slice(0, 10);
        registry.set(id, code);
        used.add(evt);
        return ` data-h-${evt}="${id}"`;
      });
      return `<${name}${newAttrs}${selfClose ? ' /' : ''}>`;
    });
  }
  let out = parts.join('');
  if (registry.size === 0) return out;

  const body = [...registry.entries()]
    .map(([id, code]) => `${JSON.stringify(id)}:function(event){${code.replace(/<\/(script)/gi, '<\\/$1')}\n}`)
    .join(',\n');
  const script =
    `<script nonce="${nonce || ''}">(function(){var H={\n${body}\n};` +
    `${JSON.stringify([...used])}.forEach(function(t){document.addEventListener(t,function(e){` +
    `var el=e.target;while(el&&el.getAttribute){var id=el.getAttribute('data-h-'+t);` +
    `if(id&&H[id]){var r;try{r=H[id].call(el,e);}catch(err){console.error(err);}if(r===false)e.preventDefault();if(e.cancelBubble)break;}` +
    `el=el.parentNode;}},true);});})();</script>`;
  return /<\/body>/i.test(out) ? out.replace(/<\/body>(?![\s\S]*<\/body>)/i, script + '</body>') : out + script;
}

/** Express için ejs motoru: render edilen HTML'i yukarıdaki dönüşümden geçirir. */
function ejsEngine() {
  const ejs = require('ejs');
  return (file, options, cb) => ejs.__express(file, options, (err, html) => {
    if (err) return cb(err);
    // Yalnızca tam sayfalar (</html> içerenler) dönüştürülür; kısmi çıktılar atlanır
    if (typeof html === 'string' && /<\/html>/i.test(html)) return cb(null, transform(html, options.cspNonce));
    cb(null, html);
  });
}

module.exports = { transform, ejsEngine, EVENTS };
