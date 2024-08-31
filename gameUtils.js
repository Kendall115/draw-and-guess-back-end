const {
  setGameStatus,
  getGameGuessword,
  setGuessWord,
} = require("./gameManager");

const timers = {};

function handleTimerEnd(roomID, timerInterval, io) {
  const guessword = getGameGuessword(roomID);
  setGuessWord(roomID, "");
  setGameStatus(roomID, "finished");
  clearInterval(timerInterval);
  delete timers[roomID];
  io.to(roomID).emit("time is up", guessword);
}

function updateTimer(roomID, timerInterval, io) {
  io.to(roomID).emit("timer update", timers[roomID]);
  timers[roomID]--;

  if (timers[roomID] < 0) handleTimerEnd(roomID, timerInterval, io);
}

function startTimer(roomID, duration, io) {
  if (timers[roomID]) return;

  timers[roomID] = duration;
  const timerInterval = setInterval(() => {
    updateTimer(roomID, timerInterval, io);
  }, 1000);
}

async function getRandomPlayer(roomID, io) {
  const roomMembers = io.sockets.adapter.rooms.get(roomID);
  const selectedPlayerId =
    Array.from(roomMembers)[Math.floor(Math.random() * roomMembers.size)];

  const sockets = await io.in(selectedPlayerId).fetchSockets();
  const selectedPlayerUserName = sockets[0].handshake.auth.userName;
  return { selectedPlayerUserName, selectedPlayerId };
}

module.exports = { startTimer, getRandomPlayer };
