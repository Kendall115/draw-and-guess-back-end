const {
  createLine,
  addPoint,
  getGameLines,
  undo,
  clear,
} = require("./drawingBoardManager");

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
    .emit("chat message", message, result.lastID);
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
        socket.emit(
          "chat message",
          { userName: row.user_name, text: row.content },
          row.id
        );
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
  socket.on("join room", (callback) => {
    const room = io.sockets.adapter.rooms.get(socket.handshake.auth.roomID);

    if (!room) return callback(false);

    socket.join(socket.handshake.auth.roomID);
    callback(true);
  });

  socket.on("create room", () => {
    socket.join(socket.handshake.auth.roomID);
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
  }
}

module.exports = { handleSocketEvents };
