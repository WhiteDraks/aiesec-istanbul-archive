const multer = require('multer');

// Hafıza (Memory) tabanlı saklama kullanıyoruz çünkü 
// dosyayı Vercel sunucusunda değil, Vercel Blob'da tutacağız.
const storage = multer.memoryStorage();

// Sadece resim dosyalarına izin ver
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Lütfen sadece resim dosyası yükleyin.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
});

module.exports = upload;
