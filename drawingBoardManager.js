const games = {};

function createLine(line, roomID) {
  if (!games[roomID]) games[roomID] = { lines: [] };

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

module.exports = { createLine, addPoint, undo, clear, getGameLines };
