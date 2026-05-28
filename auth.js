const jwt = require('jsonwebtoken');
const { Users } = require('../db');

// Vérifie le JWT dans le cookie ou le header Authorization
function requireAuth(req, res, next) {
  const token = req.cookies?.token || extractBearerToken(req);

  if (!token) {
    return res.redirect('/login.html?reason=not_logged_in');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    res.clearCookie('token');
    return res.redirect('/login.html?reason=session_expired');
  }

  const user = Users.findById.get(payload.userId);
  if (!user) {
    res.clearCookie('token');
    return res.redirect('/login.html?reason=user_not_found');
  }

  req.user = user;
  next();
}

// Vérifie le JWT ET que l'abonnement est actif
function requireSubscription(req, res, next) {
  requireAuth(req, res, () => {
    if (!Users.isActive(req.user)) {
      return res.redirect('/subscribe.html?reason=no_subscription');
    }
    next();
  });
}

// Renvoie une 401 en JSON (pour les appels API)
function requireAuthAPI(req, res, next) {
  const token = extractBearerToken(req) || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = Users.findById.get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

module.exports = { requireAuth, requireSubscription, requireAuthAPI };
