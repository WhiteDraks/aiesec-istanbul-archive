const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isLoggedIn, isApproved } = require('../middleware/auth');
const { getSystemContext } = require('../utils/aiContext');
const rateLimit = require('express-rate-limit');

// Gemini kotası/maliyeti ve kötüye kullanım için kullanıcı başına sınır
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.session?.userId || req.ip),
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen bir dakika sonra tekrar deneyin.' },
});

// Initialize Gemini API client if API key is provided
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// GET /ai-assistant - Render AI Assistant Page
router.get('/', isLoggedIn, isApproved, (req, res) => {
  res.render('ai/index', {
    title: '🤖 AI Alumni Asistanı - AIESEC İstanbul',
    currentPage: 'ai',
    hasApiKey: !!process.env.GEMINI_API_KEY
  });
});

// POST /ai-assistant/chat - Process Chat Message
router.post('/chat', isLoggedIn, isApproved, aiLimiter, async (req, res) => {
  try {
    const history = req.body.history;
    const message = typeof req.body.message === 'string' ? req.body.message.slice(0, 2000) : '';

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Mesaj boş olamaz.' });
    }

    // If key is not configured, re-check (in case .env was modified after launch)
    if (!genAI && process.env.GEMINI_API_KEY) {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    if (!process.env.GEMINI_API_KEY || !genAI) {
      return res.json({
        reply: 'Üzgünüm, şu anda AI Alumni Asistanı aktif değil. Sunucuda GEMINI_API_KEY tanımlanmamış. Lütfen site yöneticinizle iletişime geçin.'
      });
    }

    // Fetch the compiled system database context
    const dbContext = await getSystemContext();

    const systemInstruction = `
Sen AIESEC İstanbul Alumni platformunun yapay zeka asistanı ve rehberisin.
Görevin, AIESEC İstanbul mezunlarının platformla, geçmiş dönemlerle, diğer mezunlarla, zaman tüneli ve arşivle ilgili sorularını yanıtlamaktır.

Bilgi tabanındaki bilgilere tam olarak sadık kalarak kullan.
Eğer bir bilgi bilgi tabanında yer almıyorsa veya belirsizse, uydurma cevaplar vermek yerine "Maalesef bu bilgi arşivlerimizde kayıtlı değil" de.
Bilgi tabanı dışındaki genel AIESEC İstanbul ve AIESEC Türkiye tarihi (1954 kuruluşu, kurucuları vb.) hakkındaki soruları bildiğin ölçüde doğru yanıtla.

Yanıt verirken her zaman nazik, profesyonel, yardımsever ve AIESEC ruhuna uygun (LC jargonlarına hakim, samimi) bir üslup kullan.
Aday/aktif üyeler ve mezunlar arasındaki bağı güçlendirecek şekilde teşvik edici konuş.
Cevapları temiz markdown formatında yaz.
`;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      systemInstruction: systemInstruction
    });

    // Structure contents with history + current message + database context
    const contents = [];
    
    // Add context to the model call
    contents.push({
      role: 'user',
      parts: [{ text: `AIESEC İstanbul platformu güncel veri tabanı bilgileri aşağıdadır:\n${dbContext}\n\nLütfen bu verileri kullanarak sorularımı yanıtla.` }]
    });
    
    contents.push({
      role: 'model',
      parts: [{ text: 'Anlaşıldı. AIESEC İstanbul Alumni Archive veri tabanı bilgilerini kaydettim. Size bu veriler doğrultusunda ve AIESEC jargonuna uygun şekilde yardımcı olacağım. Sorularınızı alabilirim!' }]
    });

    // Append chat history from client
    if (history && Array.isArray(history)) {
      history.slice(-20).forEach(item => {
        if (item && typeof item.text === 'string' && (item.role === 'user' || item.role === 'model')) {
          // Map model to model, user to user
          contents.push({
            role: item.role,
            parts: [{ text: item.text.slice(0, 4000) }]
          });
        }
      });
    }

    // Append the new message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const result = await model.generateContent({ contents });
    const response = await result.response;
    const replyText = response.text();

    res.json({ reply: replyText });
  } catch (err) {
    console.error('Gemini API Error:', err);
    res.status(500).json({ error: 'Yapay zeka asistanı cevap üretirken bir hata oluştu.' });
  }
});

module.exports = router;
