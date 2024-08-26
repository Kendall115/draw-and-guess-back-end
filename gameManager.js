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
  games[roomID] = { isGameStarted: false, lines: [] };
}

function getGameStatus(roomID) {
  return games[roomID]?.isGameStarted;
}

function setGameStatus(roomID, isGameStarted) {
  games[roomID].isGameStarted = isGameStarted;
}

module.exports = {
  createLine,
  addPoint,
  undo,
  clear,
  getGameLines,
  addGame,
  getGameStatus,
  setGameStatus,
};
