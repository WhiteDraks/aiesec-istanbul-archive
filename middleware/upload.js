const multer = require('multer');

// Hafıza (Memory) tabanlı saklama kullanıyoruz çünkü 
// dosyayı Vercel sunucusunda değil, Vercel Blob'da tutacağız.
const storage = multer.memoryStorage();

// Sadece resim dosyalarına izin ver (SVG hariç - XSS riski nedeniyle)
const fileFilter = (req, file, cb) => {
  if (file && file.mimetype && file.mimetype.startsWith('image/')) {
    if (file.mimetype === 'image/svg+xml') {
      cb(new Error('Güvenlik nedeniyle SVG formatında resim yüklenemez.'), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error('Lütfen sadece resim dosyası yükleyin.'), false);
  }
};

const multerInstance = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
});

// Custom Wrapper to intercept base64 fallback uploads
const upload = {
  single(fieldName) {
    const originalMiddleware = multerInstance.single(fieldName);
    return (req, res, next) => {
      originalMiddleware(req, res, (err) => {
        if (err) return next(err);
        
        const base64Key = `${fieldName}_base64`;
        if (!req.file && req.body && req.body[base64Key]) {
          try {
            const base64Str = req.body[base64Key];
            const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];

              if (mimeType === 'image/svg+xml') {
                console.warn('Blocked SVG base64 upload attempt.');
              } else {
                const buffer = Buffer.from(matches[2], 'base64');

                req.file = {
                  fieldname: fieldName,
                  originalname: `cropped_image.${mimeType.split('/')[1] || 'jpg'}`,
                  encoding: '7bit',
                  mimetype: mimeType,
                  buffer: buffer,
                  size: buffer.length
                };
              }
            }
          } catch (e) {
            console.error('Failed to parse base64 fallback upload:', e);
          }
        }
        next();
      });
    };
  },
  
  array(fieldName, maxCount) {
    return multerInstance.array(fieldName, maxCount);
  },
  
  fields(fieldsArray) {
    return multerInstance.fields(fieldsArray);
  },
  
  none() {
    return multerInstance.none();
  },
  
  any() {
    return multerInstance.any();
  }
};

module.exports = upload;
