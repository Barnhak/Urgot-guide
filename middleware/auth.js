const jwt = require('jsonwebtoken');
const { Users } = require('../db');

function requireAuth(req, res, next) {
  const token = req.cookies?.token || extractBearerToken(req);
  if (!token) return res.redirect('/login.html?reason=not_logged_in');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = Users.findById.get(payload.userId);
    if (!user) return res.redirect('/login.html?reason=user_not_found');
    req.user = user;
    next();
  } catch {
    return res.redirect('/login.html?reason=session_expired');
  }
}

function requireSubscription(req, res, next) {
  requireAuth(req, res, () => {
    if (!Users.isActive(req.user))
      return res.redirect('/subscribe.html?reason=no_subscription');
    next();
  });
}

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

module.exports = { requireAuth, requireSubscription };
