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
const { getDb } = require('./db'
