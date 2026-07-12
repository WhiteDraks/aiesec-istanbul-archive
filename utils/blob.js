const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Uploads a file buffer locally to the public/uploads/ folder and returns the relative public URL.
 * 
 * @param {Buffer} buffer - The file buffer
 * @param {string} originalName - Original file name
 * @param {string} prefix - Optional folder prefix (e.g., 'avatars/')
 * @returns {Promise<string>} The public URL of the uploaded file
 */
async function uploadToBlob(buffer, originalName, prefix = 'uploads/') {
  // Generate a unique filename
  const ext = path.extname(originalName);
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const filename = `${uniqueId}${ext}`;

  // Target directory in public folder
  const targetDir = path.join(process.cwd(), 'public', 'uploads', prefix);

  // Ensure directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, filename);

  // Write file to disk
  fs.writeFileSync(targetPath, buffer);

  // Return the relative web path
  return `/uploads/${prefix}${filename}`;
}

module.exports = { uploadToBlob };
