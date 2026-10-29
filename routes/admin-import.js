const express = require('express');
const multer = require('multer');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { parseWorkbook, buildPlan, applyImport, buildTemplate, buildExport } = require('../utils/ebImport');

router.use(isLoggedIn, isAdmin);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname || '')) return cb(null, true);
    cb(new Error('Yalnızca .xlsx (Excel) dosyası yükleyebilirsiniz. .xls veya .csv ise Excel\'de "Farklı Kaydet → .xlsx" yapın.'));
  },
});

const xlsxHeaders = (res, filename) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
};

// GET /admin/import - yükleme formu (+ varsa önizleme)
router.get('/', async (req, res) => {
  try {
    const pending = req.session.ebImport || null;
    let plan = null;
    if (pending) plan = await buildPlan(pending.parsed);
    res.render('admin/import', {
      title: 'Excel ile EB Verisi İçe Aktar - Admin',
      pending, plan,
    });
  } catch (err) {
    console.error('Import page error:', err);
    delete req.session.ebImport;
    req.flash('error', 'Önizleme hazırlanamadı. Dosyayı yeniden yükleyin.');
    res.redirect('/admin/import');
  }
});

router.get('/template', async (req, res) => {
  try {
    xlsxHeaders(res, 'eb-import-sablonu.xlsx');
    res.send(await buildTemplate());
  } catch (err) {
    console.error('Template error:', err);
    res.status(500).end();
  }
});

router.get('/export', async (req, res) => {
  try {
    xlsxHeaders(res, `eb-verileri-${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(await buildExport());
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).end();
  }
});

// POST /admin/import/preview - dosyayı doğrula, ne yapılacağını göster (veritabanına YAZMAZ)
router.post('/preview', (req, res) => {
  uploader.single('file')(req, res, async (upErr) => {
    if (upErr) {
      req.flash('error', upErr.code === 'LIMIT_FILE_SIZE' ? 'Dosya 5 MB sınırını aşıyor.' : upErr.message);
      return res.redirect('/admin/import');
    }
    if (!req.file) {
      req.flash('error', 'Lütfen bir .xlsx dosyası seçin.');
      return res.redirect('/admin/import');
    }
    try {
      const parsed = await parseWorkbook(req.file.buffer);
      req.session.ebImport = { parsed, fileName: String(req.file.originalname).slice(0, 100), at: Date.now() };
      res.redirect('/admin/import');
    } catch (err) {
      console.error('Import parse error:', err.message);
      delete req.session.ebImport;
      req.flash('error', err.message || 'Dosya okunamadı.');
      res.redirect('/admin/import');
    }
  });
});

// POST /admin/import/apply - önizlenen veriyi uygula
router.post('/apply', async (req, res) => {
  const pending = req.session.ebImport;
  if (!pending) {
    req.flash('error', 'Uygulanacak bir önizleme yok. Önce dosyayı yükleyin.');
    return res.redirect('/admin/import');
  }
  if (Date.now() - pending.at > 30 * 60 * 1000) {
    delete req.session.ebImport;
    req.flash('error', 'Önizleme zaman aşımına uğradı. Dosyayı yeniden yükleyin.');
    return res.redirect('/admin/import');
  }
  try {
    const r = await applyImport(pending.parsed);
    delete req.session.ebImport;
    const parts = [`${r.created} yeni kişi eklendi`, `${r.updated} kişi güncellendi`, `${r.teamsCreated} yeni dönem oluşturuldu`];
    if (r.teamsUpdated) parts.push(`${r.teamsUpdated} dönem bilgisi güncellendi`);
    if (r.skipped) parts.push(`${r.skipped} satır atlandı`);
    req.flash('success', 'İçe aktarma tamamlandı: ' + parts.join(', ') + '.');
    r.errors.forEach(e => req.flash('error', e));

    if (r.created > 0 || r.updated > 0) {
      const { sendApprovedListNotification } = require('../utils/email');
      sendApprovedListNotification({ reason: `Excel ile içe aktarma tamamlandı (${r.created} yeni, ${r.updated} güncellendi)` }).catch(err => {
        console.error('İçe aktarma sonrası onaylı liste bildirimi hatası:', err.message);
      });
    }

    res.redirect('/admin/import');
  } catch (err) {
    console.error('Import apply error:', err);
    req.flash('error', 'İçe aktarma sırasında bir hata oluştu. Bazı kayıtlar işlenmiş olabilir; önizlemeyi yenileyip tekrar deneyebilirsiniz.');
    res.redirect('/admin/import');
  }
});

router.post('/cancel', (req, res) => {
  delete req.session.ebImport;
  res.redirect('/admin/import');
});

module.exports = router;
