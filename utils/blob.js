const { put } = require('@vercel/blob');
const crypto = require('crypto');
const path = require('path');

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
  const ext = path.extname(originalName);
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
  });

  return result.url;
}

module.exports = { uploadToBlob };
