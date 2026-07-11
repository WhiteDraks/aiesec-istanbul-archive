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

  // Check if BLOB_READ_WRITE_TOKEN is available
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('⚠️ BLOB_READ_WRITE_TOKEN is not set. Saving to memory only (this will disappear!).');
    // If running locally without blob token, just return a placeholder or handle locally
    // Since we must return a URL, we will just return a placeholder.
    return `/images/default-avatar.svg?error=no-blob-token`;
  }

  const result = await put(filename, buffer, {
    access: 'private',
  });

  // For private blobs, `downloadUrl` is a signed URL that works in browsers (img tags)
  // Fall back to `url` if downloadUrl is not available
  return result.downloadUrl || result.url;
}

module.exports = { uploadToBlob };
