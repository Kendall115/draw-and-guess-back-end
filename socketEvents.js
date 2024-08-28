const {
  createLine,
  addPoint,
  getGameLines,
  undo,
  clear,
  addGame,
  getGameStatus,
  setGameStatus,
} = require("./gameManager");

const { getRandomWord } = require("./database");

const timers = {};

function startTimer(roomID, duration, io) {
  if (!timers[roomID]) {
    timers[roomID] = duration; // Set the initial timer value
    const timerInterval = setInterval(() => {
      timers[roomID]--;
      io.to(roomID).emit("timer update", timers[roomID]);

      if (timers[roomID] <= 0) {
        clearInterval(timerInterval);
        delete timers[roomID]; // Clean up
        // io.to(roomID).emit("time's up");
      }
    }, 1000);
  }
}

async function handleRecoverGameStatus(socket) {
  const roomID = socket.handshake.auth.roomID;
  socket.emit("recover game status", getGameStatus(roomID));
}

async function handleChatMessage(socket, db, message, clientOffset) {
  let result;

  try {
    result = await db.run(
      "INSERT INTO messages (content, client_offset, user_name, room_id) VALUES (?, ?, ?, ?)",
      message.text,
      clientOffset,
      message.userName,
      message.roomID
    );
  } catch (error) {
    if (error.errno === 19) {
    }
    console.log(error);
    return;
  }

  socket.broadcast
    .to(socket.handshake.auth.roomID)
    .emit("chat message", { ...message, serverChatOffset: result.lastID });
}

async function handleRecoveredMessages(socket, db) {
  try {
    await db.each(
      "SELECT id, user_name, content FROM messages WHERE room_id = ? AND id > ?",
      [
        socket.handshake.auth.roomID,
        socket.handshake.auth.serverChatOffset || 0,
      ],
      (_err, row) => {
        socket.emit("chat message", {
          userName: row.user_name,
          text: row.content,
          serverChatOffset: row.id,
        });
      }
    );
  } catch (e) {}
}

async function handleRecoveredLines(socket) {
  const roomID = socket.handshake.auth.roomID;
  const gameLines = getGameLines(roomID);

  if (!gameLines) return;

  socket.emit("recover lines", gameLines);
}

async function handleSocketEvents(io, socket, db) {
  const roomID = socket.handshake.auth.roomID;

  socket.on("join room", (roomID, callback) => {
    const room = io.sockets.adapter.rooms.get(roomID);

    if (!room) return callback(false);

    socket.join(roomID);
    callback(true, getGameStatus(roomID));
  });

  socket.on("create room", (roomID) => {
    addGame(roomID);
    socket.join(roomID);
  });

  socket.on("start countdown", () => {
    socket.broadcast
      .to(socket.handshake.auth.roomID)
      .emit("start countdown", false);
  });

  socket.on("start game", async () => {
    const roomID = socket.handshake.auth.roomID;
    setGameStatus(roomID, true);

    const roomMembers = io.sockets.adapter.rooms.get(roomID);

    const selectedPlayerId =
      Array.from(roomMembers)[Math.floor(Math.random() * roomMembers.size)];

    const guessWord = await getRandomWord();
    io.to(selectedPlayerId).emit("selected player", {
      isCurrentTurn: true,
      guessWord,
    });

    startTimer(roomID, 60, io);
  });

  socket.on("drawingNewLine", (line, clientOffset) => {
    createLine(line, socket.handshake.auth.roomID);
    socket.broadcast
      .to(socket.handshake.auth.roomID)
      .emit("drawingNewLine", line, clientOffset);
  });

  socket.on("drawing", (point, clientOffset) => {
    addPoint(point, socket.handshake.auth.roomID);
    socket.broadcast
      .to(socket.handshake.auth.roomID)
      .emit("drawing", point, clientOffset);
  });

  socket.on("undo", (clientOffset) => {
    undo(socket.handshake.auth.roomID);
    socket.broadcast
      .to(socket.handshake.auth.roomID)
      .emit("undo", clientOffset);
  });

  socket.on("clear", (clientOffset) => {
    clear(socket.handshake.auth.roomID);
    socket.broadcast
      .to(socket.handshake.auth.roomID)
      .emit("clear", clientOffset);
  });

  socket.on("chat message", async (message, clientOffset) => {
    await handleChatMessage(socket, db, message, clientOffset);
  });

  if (!socket.recovered) {
    await handleRecoveredMessages(socket, db);
    await handleRecoveredLines(socket);
    await handleRecoverGameStatus(socket);
  }
}

module.exports = { handleSocketEvents };
