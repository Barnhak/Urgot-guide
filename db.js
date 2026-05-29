const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialise les tables
async function getDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              SERIAL PRIMARY KEY,
      email           TEXT    NOT NULL UNIQUE,
      password_hash   TEXT    NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      paypal_sub_id   TEXT    UNIQUE,
      sub_status      TEXT    DEFAULT 'inactive',
      sub_expires_at  TIMESTAMPTZ,
      sub_started_at  TIMESTAMPTZ
    )
  `);
  return pool;
}

const Users = {
  findByEmail: {
    get: async (email) => {
      const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return r.rows[0] || null;
    }
  },
  findById: {
    get: async (id) => {
      const r = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return r.rows[0] || null;
    }
  },
  findBySubId: {
    get: async (subId) => {
      const r = await pool.query('SELECT * FROM users WHERE paypal_sub_id = $1', [subId]);
      return r.rows[0] || null;
    }
  },
  create: {
    run: async (email, hash) => {
      const r = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, hash]
      );
      return { lastInsertRowid: r.rows[0].id };
    }
  },
  updateSubStatus: {
    run: async (status, expires, subId) => {
      await pool.query(
        'UPDATE users SET sub_status = $1, sub_expires_at = $2 WHERE paypal_sub_id = $3',
        [status, expires, subId]
      );
    }
  },
  isActive: (user) => {
    if (!user) return false;
    if (user.sub_status !== 'active') return false;
    if (user.sub_expires_at && new Date(user.sub_expires_at) < new Date()) return false;
    return true;
  },
};

module.exports = { getDb, Users, pool };
