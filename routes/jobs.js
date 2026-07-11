const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { isLoggedIn, isApproved } = require('../middleware/auth');

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
    const { title, company, location, type, description, link } = req.body;
    
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
