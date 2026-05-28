const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.sqlite'));

// Activer les foreign keys et le mode WAL (plus performant)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Créer les tables si elles n'existent pas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    created_at      TEXT    DEFAULT (datetime('now')),

    -- Abonnement PayPal
    paypal_sub_id   TEXT    UNIQUE,
    sub_status      TEXT    DEFAULT 'inactive',  -- inactive | active | cancelled | suspended
    sub_expires_at  TEXT,                         -- date ISO de la prochaine facturation
    sub_started_at  TEXT                          -- date de début de l'abo
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now')),
    expires_at TEXT    NOT NULL
  );
`);

// ── Helpers utilisateurs ────────────────────────────────────────────────────

const Users = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById:    db.prepare('SELECT * FROM users WHERE id = ?'),
  findBySubId: db.prepare('SELECT * FROM users WHERE paypal_sub_id = ?'),

  create: db.prepare(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)'
  ),

  activateSubscription: db.prepare(`
    UPDATE users
    SET sub_status     = 'active',
        paypal_sub_id  = ?,
        sub_started_at = datetime('now'),
        sub_expires_at = ?
    WHERE email = ?
  `),

  updateSubStatus: db.prepare(`
    UPDATE users SET sub_status = ?, sub_expires_at = ?
    WHERE paypal_sub_id = ?
  `),

  isActive: (user) => {
    if (!user) return false;
    if (user.sub_status !== 'active') return false;
    // Vérifier que la date d'expiration n'est pas passée
    if (user.sub_expires_at) {
      const expires = new Date(user.sub_expires_at);
      if (expires < new Date()) return false;
    }
    return true;
  },
};

module.exports = { db, Users };
