const router   = require('express').Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt  = require('jsonwebtoken');
const { Users } = require('../db');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  `${process.env.SITE_URL}/api/auth/google/callback`,
},
async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value.toLowerCase();
  let user = Users.findByEmail.get(email);
  if (!user) {
    const result = Users.create.run(email, 'GOOGLE_OAUTH');
    user = Users.findById.get(result.lastInsertRowid);
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, Users.findById.get(id)));

// Redirige vers Google
router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
}));

// Callback après Google
router.get('/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?reason=google_failed' }),
  (req, res) => {
    const user  = req.user;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000,
    });
    res.redirect(Users.isActive(user) ? '/guide' : '/subscribe.html');
  }
);

module.exports = { router, passport };
