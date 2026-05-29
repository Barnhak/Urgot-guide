const jwt = require('jsonwebtoken');
const { Users } = require('../db');

const ADMIN_EMAILS = [
  'l.rouxel22300@gmail.com',
  'barnhak123@gmail.com',
];

async function requireAuth(req, res, next) {
  const token = req.cookies?.token || extractBearerToken(req);
  if (!token) return res.redirect('/login.html?reason=not_logged_in');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await Users.findById.get(payload.userId);
    if (!user) return res.redirect('/login.html?reason=user_not_found');
    req.user = user;
    next();
  } catch {
    return res.redirect('/login.html?reason=session_expired');
  }
}

async function requireSubscription(req, res, next) {
  const token = req.cookies?.token || extractBearerToken(req);
  if (!token) return res.redirect('/login.html?reason=not_logged_in');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await Users.findById.get(payload.userId);
    if (!user) return res.redirect('/login.html?reason=user_not_found');
    req.user = user;

    // Admin bypass
    const userEmail = (user.email || '').toLowerCase();
    if (ADMIN_EMAILS.map(e => e.toLowerCase()).includes(userEmail)) {
      return next();
    }

    if (!Users.isActive(user)) {
      return res.redirect('/subscribe.html?reason=no_subscription');
    }
    next();
  } catch {
    return res.redirect('/login.html?reason=session_expired');
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

module.exports = { requireAuth, requireSubscription };
