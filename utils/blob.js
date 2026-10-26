const { put } = require('@vercel/blob');
const crypto = require('crypto');
const { detectImage, isPdf } = require('./security');

/**
 * Uploads a file buffer to Vercel Blob and returns the public URL.
 * 
 * @param {Buffer} buffer - The file buffer
 * @param {string} originalName - Original file name
 * @param {string} prefix - Optional folder prefix (e.g., 'avatars/')
 * @returns {Promise<string>} The public URL of the uploaded blob
 */
async function uploadToBlob(buffer, originalName, prefix = 'uploads/') {
  // Generate a unique filename
  // Dosya türü istemcinin bildirdiği ad/MIME'a değil, gerçek içeriğe (magic bytes) göre belirlenir.
  // Böylece "x.html" adıyla yüklenen sahte görsel/komut dosyaları Blob'a yazılamaz.
  const img = detectImage(buffer);
  let ext;
  if (img) ext = `.${img.ext}`;
  else if (isPdf(buffer)) ext = '.pdf';
  else throw new Error('Geçersiz dosya içeriği. Yalnızca JPG, PNG, GIF, WEBP veya PDF yüklenebilir.');
  // prefix içinde istemci kaynaklı değerler (örn. yıl) olabilir: yol geçişini engelle
  prefix = String(prefix).replace(/[^A-Za-z0-9_\-\/\.]/g, '_').replace(/\.\.+/g, '_');
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const filename = `${prefix}${uniqueId}${ext}`;

  const token = process.env.AIESEC_BLOB_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.warn('⚠️ No blob token set. Saving to memory only.');
    return `/images/default-avatar.svg?error=no-blob-token`;
  }

  const result = await put(filename, buffer, {
    access: 'public',
    token: token,
    addRandomSuffix: true,
  });

  return result.url;
}

module.exports = { uploadToBlob };
