require('dotenv').config();

const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── Middleware cookies ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(pair => {
      const [key, ...val] = pair.trim().split('=');
      req.cookies[key.trim()] = decodeURIComponent(val.join('='));
    });
  }
  res.clearCookie = (name) => {
    res.setHeader('Set-Cookie', `${name}=; HttpOnly; Path=/; Max-Age=0`);
  };
  res.cookie = (name, value, opts = {}) => {
    let str = `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/`;
    if (opts.maxAge) str += `; Max-Age=${Math.floor(opts.maxAge/1000)}`;
    if (opts.secure) str += `; Secure`;
    if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
    res.setHeader('Set-Cookie', str);
  };
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Init DB puis démarrage ────────────────────────────────────────────────────
const { getDb } = require('./db');

getDb().then(() => {
  console.log('✅ Base de données prête');

  // Session
  const session = require('express-session');
  app.use(session({
    secret:            process.env.JWT_SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }));

  // Google OAuth — chargé APRÈS la DB
  const { router: googleRouter, passport } = require('./routes/google');
  app.use(passport.initialize());
  app.use(passport.session());
  app.use('/api/auth/google', googleRouter);

  // Routes API
  const authRoutes   = require('./routes/auth');
  const paypalRoutes = require('./routes/paypal');
  const { requireSubscription } = require('./middleware/auth');

  app.use('/api/auth',   authRoutes);
  app.use('/api/paypal', paypalRoutes);

  // Pages publiques
  app.use(express.static(path.join(__dirname, 'public')));

  // Pages protégées
  // Images et assets publics dans protected (sans auth)
  app.use('/guide/img', express.static(path.join(__dirname, 'protected', 'img')));
  app.use('/guide/gif', express.static(path.join(__dirname, 'protected', 'gif')));
  app.use('/guide/assets', express.static(path.join(__dirname, 'protected', 'assets')));
  app.use('/guide', requireSubscription, express.static(path.join(__dirname, 'protected')));
  app.get('/guide', requireSubscription, (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'index.html'));
  });
  app.get('/guide/:file', requireSubscription, (req, res) => {
    const file = path.join(__dirname, 'protected', req.params.file);
    res.sendFile(file, err => { if (err) res.status(404).send('Page introuvable'); });
  });

  // Redirections
  app.get('/', (req, res) => res.redirect('/login.html'));
  app.get('/login',    (req, res) => res.redirect('/login.html'));
  app.get('/register', (req, res) => res.redirect('/register.html'));

  // 404
  app.use((req, res) => res.status(404).send('Page introuvable'));

  // Démarrage
  app.listen(PORT, () => {
    console.log(`🚀 Urgot Guide server on port ${PORT}`);
    console.log(`   PayPal env: ${process.env.PAYPAL_ENV || 'sandbox'}`);
  });

}).catch(err => {
  console.error('❌ Erreur DB au démarrage:', err);
  process.exit(1);
});
