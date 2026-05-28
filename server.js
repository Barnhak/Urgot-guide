require('dotenv').config();
// Initialiser la DB avant tout
const { getDb } = require('./db');
getDb().then(() => console.log('✅ Base de données prête'));
const express    = require('express');
const path       = require('path');
// Parse cookies manuellement sans dépendance externe
const cookieParser = (req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(pair => {
      const [key, ...val] = pair.trim().split('=');
      req.cookies[key.trim()] = decodeURIComponent(val.join('='));
    });
  }
  // Helper pour effacer un cookie
  res.clearCookie = (name) => {
    res.setHeader('Set-Cookie', `${name}=; HttpOnly; Path=/; Max-Age=0`);
  };
  // Helper pour définir un cookie
  res.cookie = (name, value, opts = {}) => {
    let str = `${name}=${value}; HttpOnly; Path=/`;
    if (opts.maxAge) str += `; Max-Age=${Math.floor(opts.maxAge/1000)}`;
    if (opts.secure) str += `; Secure`;
    if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
    res.setHeader('Set-Cookie', str);
  };
  next();
};
const cors = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
};

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
