const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

async function connectToDatabase() {
  const db = await open({
    filename: "database.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        room_id TEXT,
        user_name TEXT,
        content TEXT
    );
  `);

  return db;
}

module.exports = { connectToDatabase };
