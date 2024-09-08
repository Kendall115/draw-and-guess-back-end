const games = {};

function createLine(line, roomID) {
  games[roomID].lines.push(line);
}

function addPoint(point, roomID) {
  const lastLineIndex = games[roomID].lines.length - 1;
  const lastLine = games[roomID].lines[lastLineIndex] || null;
  if (lastLine) {
    lastLine.points.push(point.x, point.y);
    games[roomID].lines.splice(lastLineIndex, 1, lastLine);
  }
}

function undo(roomID) {
  const lines = games[roomID].lines;

  if (lines.length < 0) return;

  lines.pop();
}

function clear(roomID) {
  games[roomID].lines = [];
}

function getGameLines(roomID) {
  return games[roomID]?.lines;
}

function addGame(roomID) {
  games[roomID] = { gameStatus: "waiting", lines: [], players: [] };
}

function getGameStatus(roomID) {
  return games[roomID]?.gameStatus || "waiting";
}

function getGameGuessword(roomID) {
  return games[roomID]?.guessWord;
}

function setGameStatus(roomID, status) {
  games[roomID].gameStatus = status;
}

function setGuessWord(roomID, guessWord) {
  games[roomID].guessWord = guessWord;
}

function getPlayers(roomID) {
  return games[roomID]?.players || [];
}

function addPlayer(roomID, userName) {
  games[roomID].players.push(userName);
}

function removePlayer(roomID, userName) {
  if (!games[roomID]?.players) return;
  games[roomID].players = games[roomID].players.filter(
    (player) => player !== userName
  );
}

module.exports = {
  createLine,
  addPoint,
  undo,
  clear,
  getGameLines,
  getGameGuessword,
  addGame,
  getGameStatus,
  setGameStatus,
  setGuessWord,
  addPlayer,
  removePlayer,
  getPlayers,
};
