require('dotenv').config();
const express    = require('express');
const path       = require('path');
const cookieParser = require('cookie-parser');
const cors       = require('cors');

const { requireSubscription } = require('./middleware/auth');
const authRoutes   = require('./routes/auth');
const paypalRoutes = require('./routes/paypal');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globaux ──────────────────────────────────────────────────────
app.use(cors({ origin: process.env.SITE_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Le webhook PayPal a besoin du body brut pour la vérification de signature
app.use('/api/paypal/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
  next();
});

// ── Pages publiques ──────────────────────────────────────────────────────────
// Accessibles par tout le monde (login, register, landing, subscribe)
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes API ───────────────────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/paypal', paypalRoutes);

// ── Pages protégées ──────────────────────────────────────────────────────────
// Tout ce qui est sous /guide nécessite un abo actif
app.use('/guide', requireSubscription, express.static(path.join(__dirname, 'protected')));

// Route /guide sans fichier → sert index.html du dossier protected
app.get('/guide', requireSubscription, (req, res) => {
  res.sendFile(path.join(__dirname, 'protected', 'index.html'));
});

// Accès direct aux fichiers protégés par URL
app.get('/guide/:file', requireSubscription, (req, res) => {
  const file = path.join(__dirname, 'protected', req.params.file);
  res.sendFile(file, err => {
    if (err) res.status(404).send('Page introuvable');
  });
});

// ── Redirections pratiques ───────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login',    (req, res) => res.redirect('/login.html'));
app.get('/register', (req, res) => res.redirect('/register.html'));

// ── 404 global ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send('Page introuvable');
});

// ── Démarrage ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Urgot Guide server running on port ${PORT}`);
  console.log(`   Environnement PayPal : ${process.env.PAYPAL_ENV || 'sandbox'}`);
});
