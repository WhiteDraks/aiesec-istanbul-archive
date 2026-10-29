#!/usr/bin/env node
/**
 * replace-aiesec.js
 * Replaces all AIES+EC occurrences (including typos like AIESEEC) across all .ejs view files.
 * Keeps database column names (aiesec_journey, etc.) intact — only replaces display text.
 */

const fs = require('fs');
const path = require('path');
const glob = null;  // not used

const VIEWS_DIR = path.join(__dirname, '../views');

// Map of exact replacement rules [regex, replacement]
// Order matters — more specific first
const REPLACEMENTS = [
  // Typos first
  [/AIESEEC/gi, 'Alumni Archive'],

  // With "İstanbul" suffix — visible text labels
  [/AIESEC İstanbul Alumni Archive Yönetimi/g, 'Alumni Archive Yönetimi'],
  [/AIESEC İstanbul Alumni Archive/g, 'Alumni Archive'],
  [/AIESEC İstanbul Mezunlar Portalı/g, 'Alumni Archive Portalı'],
  [/AIESEC İstanbul Tarih Şeridi/g, 'Alumni Archive Tarih Şeridi'],
  [/AIESEC İstanbul Geçmiş Belgeleri/g, 'Alumni Archive Geçmiş Belgeleri'],
  [/AIESEC İstanbul mezunlarıyla/g, 'Alumni mezunlarıyla'],
  [/AIESEC İstanbul'un 70 yıllık mirası/g, 'Alumni Archive\'nin 70 yıllık mirası'],
  [/AIESEC İstanbul'u yöneten liderler/g, 'topluluğu yöneten liderler'],
  [/AIESEC İstanbul'un/g, 'topluluğun'],
  [/AIESEC İstanbul/g, 'İstanbul Alumni Archive'],

  // Label texts (headings, placeholders, descriptions) — NOT column names
  [/AIESEC Kariyeri/g, 'Topluluk Kariyeri'],
  [/AIESEC Görevleri/g, 'Topluluk Görevleri'],
  [/AIESEC Yolculuğunuz/g, 'Topluluk Yolculuğunuz'],
  [/AIESEC Yolculuğu/g, 'Topluluk Yolculuğu'],
  [/AIESEC geçmişinizi/g, 'topluluk geçmişinizi'],
  [/AIESEC görevlerini/g, 'topluluk görevlerini'],
  [/AIESEC görevlerinizi/g, 'topluluk görevlerinizi'],
  [/AIESEC ağında/g, 'topluluk ağında'],
  [/AIESEC Rolü/g, 'Topluluk Rolü'],
  [/AIESEC içerisindeki görevlerinizden/g, 'topluluktaki görevlerinizden'],
  [/AIESEC Alumni platformunun/g, 'Alumni Archive platformunun'],
  [/diğer AIESEC görevlerini/g, 'diğer topluluk görevlerini'],
  [/diğer AIESEC görevlerinizi/g, 'diğer topluluk görevlerinizi'],

  // Standalone AIESEC in visible text only (not in HTML comments, not in EJS column refs)
  // Careful: don't replace aiesec.org URLs or aiesec_journey column names
  // Replace 'AIESEC' as standalone word in visible text — fallback for any remaining
  // We'll handle this carefully below
];

function getAllEjsFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getAllEjsFiles(fullPath));
    } else if (item.endsWith('.ejs')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllEjsFiles(VIEWS_DIR);
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  for (const [pattern, replacement] of REPLACEMENTS) {
    content = content.replace(pattern, replacement);
  }

  // Count changes
  if (content !== original) {
    const changeCount = (original.match(/AIES+EC/gi) || []).length - (content.match(/AIES+EC/gi) || []).length;
    console.log(`✅ ${path.relative(VIEWS_DIR, file)}: ${changeCount} değişiklik`);
    fs.writeFileSync(file, content, 'utf8');
    totalChanges += changeCount;
  }
}

console.log(`\nToplam ${totalChanges} AIESEC ibaresi değiştirildi.`);

// Verify remaining
console.log('\n--- Kalan AIESEC ibareleri (varsa) ---');
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/AIES+EC/gi);
  if (matches) {
    console.log(`⚠️  ${path.relative(VIEWS_DIR, file)}: ${matches.length} kalan → ${matches.slice(0,3).join(', ')}`);
  }
}
