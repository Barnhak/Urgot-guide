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

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000,
  });
}

module.exports = router;
