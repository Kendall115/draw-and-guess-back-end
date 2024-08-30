const fs = require("fs");
const path = require("path");
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
        content TEXT,
        is_guess BOOLEAN DEFAULT FALSE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS guess_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT UNIQUE
    );
  `);

  const wordsFilePath = path.join(__dirname, "words.json");
  const wordsData = JSON.parse(fs.readFileSync(wordsFilePath, "utf8"));

  for (const { word } of wordsData) {
    try {
      await db.run(`INSERT INTO guess_words (word) VALUES (?)`, [word]);
    } catch (error) {}
  }

  return db;
}

async function getRandomWord() {
  const db = await connectToDatabase();
  const [{ word }] = await db.all(
    `SELECT word FROM guess_words ORDER BY RANDOM() LIMIT 1`
  );
  return word;
}

module.exports = { connectToDatabase, getRandomWord };
