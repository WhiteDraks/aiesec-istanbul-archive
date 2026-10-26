const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { isLoggedIn, isApproved } = require('../middleware/auth');
const { safeUrl, str } = require('../utils/security');

// Require login + approval for all events actions
router.use(isLoggedIn, isApproved);

// GET /events - List all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.findAll();
    
    // Check attending status for each event
    const eventsWithStatus = await Promise.all(events.map(async (e) => {
      const attending = await Event.isAttending(e.id, req.session.userId);
      const attendees = await Event.getAttendees(e.id);
      return {
        ...e,
        attending,
        attendees
      };
    }));

    res.render('events/index', {
      title: 'Etkinlikler - AIESEC İstanbul',
      events: eventsWithStatus,
      currentPage: 'events'
    });
  } catch (err) {
    console.error('Failed to list events:', err);
    req.flash('error', 'Etkinlikler yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

// POST /events - Create a new event
router.post('/', async (req, res) => {
  try {
    const title = str(req.body.title, 150), description = str(req.body.description, 5000);
    const event_date = str(req.body.event_date, 40), location = str(req.body.location, 200);
    const link = safeUrl(str(req.body.link, 500));
    if (req.body.link && str(req.body.link, 500) && !link) {
      req.flash('error', 'Bağlantı geçerli bir http(s) adresi olmalıdır.');
      return res.redirect('/events');
    }
    if (event_date && isNaN(new Date(event_date).getTime())) {
      req.flash('error', 'Geçerli bir tarih girin.');
      return res.redirect('/events');
    }

    if (!title || !description || !event_date || !location) {
      req.flash('error', 'Lütfen tüm zorunlu alanları doldurun.');
      return res.redirect('/events');
    }

    await Event.create({
      title,
      description,
      event_date: new Date(event_date),
      location,
      link,
      created_by: req.session.userId
    });

    req.flash('success', 'Etkinlik başarıyla oluşturuldu!');
    res.redirect('/events');
  } catch (err) {
    console.error('Failed to create event:', err);
    req.flash('error', 'Etkinlik oluşturulurken bir hata oluştu.');
    res.redirect('/events');
  }
});

// POST /events/:id/attend - Join an event
router.post('/:id/attend', async (req, res) => {
  try {
    await Event.attend(req.params.id, req.session.userId);
    req.flash('success', 'Etkinliğe katılımınız kaydedildi! 🎉');
  } catch (err) {
    console.error('Failed to attend event:', err);
    req.flash('error', 'Katılım kaydedilirken bir hata oluştu.');
  }
  res.redirect('/events');
});

// POST /events/:id/leave - Leave an event
router.post('/:id/leave', async (req, res) => {
  try {
    await Event.leave(req.params.id, req.session.userId);
    req.flash('success', 'Etkinlik katılımınız iptal edildi.');
  } catch (err) {
    console.error('Failed to leave event:', err);
    req.flash('error', 'Katılımdan çıkılırken bir hata oluştu.');
  }
  res.redirect('/events');
});

// POST /events/delete/:id - Delete an event
router.post('/delete/:id', async (req, res) => {
  try {
    await Event.delete(req.params.id, req.session.userId, req.session.user.role);
    req.flash('success', 'Etkinlik başarıyla silindi.');
  } catch (err) {
    console.error('Failed to delete event:', err);
    req.flash('error', 'Etkinlik silinirken bir hata oluştu.');
  }
  res.redirect('/events');
});

module.exports = router;
