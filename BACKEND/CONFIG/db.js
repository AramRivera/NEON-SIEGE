// backend/config/db.js
// Almacén de puntuaciones en JSON (sin base de datos).
const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'scores.json');

const emptyStore = () => ({ nextId: 1, scores: [] });

let writeQueue = Promise.resolve();

async function readStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.scores)) data.scores = [];
    if (typeof data.nextId !== 'number') data.nextId = 1;
    return data;
  } catch (err) {
    if (err.code === 'ENOENT') {
      const store = emptyStore();
      await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
      return store;
    }
    throw err;
  }
}

async function writeStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function withLock(fn) {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function insertScore(entry) {
  return withLock(async () => {
    const store = await readStore();
    const record = {
      id: store.nextId++,
      player_name: entry.player_name,
      score: entry.score,
      wave_reached: entry.wave_reached,
      time_survived_seconds: entry.time_survived_seconds,
      enemies_killed: entry.enemies_killed,
      bosses_defeated: entry.bosses_defeated,
      played_at: new Date().toISOString()
    };
    store.scores.push(record);
    await writeStore(store);
    return record;
  });
}

async function getAllScores() {
  const store = await readStore();
  return store.scores;
}

module.exports = {
  insertScore,
  getAllScores
};
