const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { isLoggedIn, isApproved } = require('../middleware/auth');
const { safeUrl, str } = require('../utils/security');

// Require login + approval for all jobs actions
router.use(isLoggedIn, isApproved);

// GET /jobs - List all career opportunities
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.findAll();
    res.render('jobs/index', {
      title: 'Kariyer Fırsatları - AIESEC İstanbul',
      jobs,
      currentPage: 'jobs'
    });
  } catch (err) {
    console.error('Failed to list jobs:', err);
    req.flash('error', 'İş ilanları yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

// POST /jobs - Add a new career opportunity
router.post('/', async (req, res) => {
  try {
    const title = str(req.body.title, 150), company = str(req.body.company, 150);
    const location = str(req.body.location, 150), type = str(req.body.type, 50);
    const description = str(req.body.description, 5000);
    const link = safeUrl(str(req.body.link, 500));
    if (req.body.link && str(req.body.link, 500) && !link) {
      req.flash('error', 'Bağlantı geçerli bir http(s) adresi olmalıdır.');
      return res.redirect('/jobs');
    }
    
    if (!title || !company || !type || !description) {
      req.flash('error', 'Lütfen tüm zorunlu alanları doldurun.');
      return res.redirect('/jobs');
    }

    await Job.create({
      user_id: req.session.userId,
      title,
      company,
      location,
      type,
      description,
      link
    });

    req.flash('success', 'İş ilanı başarıyla yayınlandı!');
    res.redirect('/jobs');
  } catch (err) {
    console.error('Failed to create job:', err);
    req.flash('error', 'İş ilanı yayınlanırken bir hata oluştu.');
    res.redirect('/jobs');
  }
});

// POST /jobs/delete/:id - Delete a career opportunity
router.post('/delete/:id', async (req, res) => {
  try {
    await Job.delete(req.params.id, req.session.userId, req.session.user.role);
    req.flash('success', 'İş ilanı başarıyla silindi.');
  } catch (err) {
    console.error('Failed to delete job:', err);
    req.flash('error', 'İş ilanı silinirken bir hata oluştu.');
  }
  res.redirect('/jobs');
});

module.exports = router;
