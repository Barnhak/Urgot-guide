const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Users } = require('../db');

// ── Inscription ──────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Email invalide.' });
  const existing = Users.findByEmail.get(email.toLowerCase());
  if (existing)
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  const hash   = await bcrypt.hash(password, 12);
  const result = Users.create.run(email.toLowerCase(), hash);
  const token = jwt.sign({ userId: result.lastInsertRowid }, process.env.JWT_SECRET, { expiresIn: '30d' });
  setTokenCookie(res, token);
  res.json({ success: true, redirect: '/subscribe.html' });
});

// ── Connexion ────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  const user = Users.findByEmail.get(email.toLowerCase());
  if (!user)
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  setTokenCookie(res, token);
  const redirect = Users.isActive(user) ? '/guide' : '/subscribe.html';
  res.json({ success: true, redirect });
});

// ── Déconnexion ──────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, redirect: '/login.html' });
});

// ── Vérifier session ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ loggedIn: false });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = Users.findById.get(payload.userId);
    if (!user) return res.json({ loggedIn: false });
    res.json({
      loggedIn:        true,
      email:           user.email,
      hasSubscription: Users.isActive(user),
      subStatus:       user.sub_status,
      expiresAt:       user.sub_expires_at,
    });
  } catch {
    res.json({ loggedIn: false });
  }
});

// ── Reset mot de passe depuis la page login ───────────────────────────────────
router.post('/request-reset', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 min).' });

  const user = Users.findByEmail.get(email.toLowerCase());
  if (!user)
    return res.status(404).json({ error: 'Aucun compte trouvé avec cet email.' });

  const hash = await bcrypt.hash(newPassword, 12);
  const { db } = require('../db');
  db.run(`UPDATE users SET password_hash='${hash.replace(/'/g,"''")}' WHERE email='${email.toLowerCase().replace(/'/g,"''")}'`);

  res.json({ success: true });
});

// ── Reset mot de passe (admin via URL) ────────────────────────────────────────
// GET /api/auth/reset-pwd?email=ton@email.com&pwd=NouveauMdp123!&secret=CLE_ADMIN
router.get('/reset-pwd', async (req, res) => {
  const { email, pwd, secret } = req.query;
  const ADMIN_SECRET = process.env.RESET_SECRET || 'urgot-reset-2026';

  if (secret !== ADMIN_SECRET)
    return res.status(403).send('Accès refusé.');
  if (!email || !pwd)
    return res.status(400).send('Paramètres manquants : email et pwd requis.');
  if (pwd.length < 8)
    return res.status(400).send('Mot de passe trop court (8 min).');

  const user = Users.findByEmail.get(email.toLowerCase());
  if (!user)
    return res.status(404).send(`Aucun compte trouvé pour ${email}`);

  const hash = await bcrypt.hash(pwd, 12);
  const { db } = require('../db');
  db.run(`UPDATE users SET password_hash='${hash.replace(/'/g,"''")}' WHERE email='${email.toLowerCase().replace(/'/g,"''")}'`);

  res.send(`✅ Mot de passe réinitialisé pour ${email}. Tu peux maintenant te connecter.`);
});

// ── Helper cookie ─────────────────────────────────────────────────────────────
function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000,
  });
}

module.exports = router;
