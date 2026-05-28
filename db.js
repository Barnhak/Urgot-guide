const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

const DB_PATH = path.join(__dirname, 'data.sqlite');

let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Sauvegarder sur disque à chaque modification
  const originalRun = db.run.bind(db);
  db.run = function(...args) {
    const result = originalRun(...args);
    fs.writeFileSync(DB_PATH, db.export());
    return result;
  };

  // Créer les tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT    NOT NULL UNIQUE,
      password_hash   TEXT    NOT NULL,
      created_at      TEXT    DEFAULT (datetime('now')),
      paypal_sub_id   TEXT    UNIQUE,
      sub_status      TEXT    DEFAULT 'inactive',
      sub_expires_at  TEXT,
      sub_started_at  TEXT
    )
  `);

  return db;
}

// Helpers synchrones pour compatibilité avec le reste du code
const Users = {
  findByEmail: { get: (email) => {
    const res = db.exec(`SELECT * FROM users WHERE email = '${email.replace(/'/g,"''")}'`);
    return res[0]?.values[0] ? rowToObj(res[0]) : null;
  }},
  findById: { get: (id) => {
    const res = db.exec(`SELECT * FROM users WHERE id = ${id}`);
    return res[0]?.values[0] ? rowToObj(res[0]) : null;
  }},
  findBySubId: { get: (subId) => {
    const res = db.exec(`SELECT * FROM users WHERE paypal_sub_id = '${subId}'`);
    return res[0]?.values[0] ? rowToObj(res[0]) : null;
  }},
  create: { run: (email, hash) => {
    db.run(`INSERT INTO users (email, password_hash) VALUES ('${email.replace(/'/g,"''")}', '${hash}')`);
    const res = db.exec(`SELECT last_insert_rowid() as id`);
    return { lastInsertRowid: res[0].values[0][0] };
  }},
  updateSubStatus: { run: (status, expires, subId) => {
    db.run(`UPDATE users SET sub_status='${status}', sub_expires_at=${expires?`'${expires}'`:'NULL'} WHERE paypal_sub_id='${subId}'`);
  }},
  isActive: (user) => {
    if (!user) return false;
    if (user.sub_status !== 'active') return false;
    if (user.sub_expires_at && new Date(user.sub_expires_at) < new Date()) return false;
    return true;
  },
};

function rowToObj(res) {
  const cols = res.columns;
  const vals = res.values[0];
  const obj  = {};
  cols.forEach((c, i) => obj[c] = vals[i]);
  return obj;
}

module.exports = { getDb, Users, get db() { return db; } };