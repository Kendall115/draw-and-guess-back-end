const {
  createLine,
  addPoint,
  getGameLines,
  undo,
  clear,
  addGame,
  getGameStatus,
  setGameStatus,
  setGuessWord,
  getGameGuessword,
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
        const guessword = getGameGuessword(roomID);
        setGameStatus(roomID, "countdown");
        clearInterval(timerInterval);
        delete timers[roomID];
        io.to(roomID).emit("time is up", guessword);
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
      "INSERT INTO messages (content, client_offset, user_name, room_id, is_guess) VALUES (?, ?, ?, ?, ?)",
      message.text,
      clientOffset,
      message.userName,
      message.roomID,
      message.isGuess
    );
  } catch (error) {
    if (error.errno === 19) {
    }
    console.log(error);
    return;
  }

  if (message.isGuess) {
    message.text = `${message.userName} guessed the word!`;
    socket.emit("chat message", {
      ...message,
      serverChatOffset: result.lastID,
    });
  }

  socket.broadcast
    .to(socket.handshake.auth.roomID)
    .emit("chat message", { ...message, serverChatOffset: result.lastID });
}

async function handleRecoveredMessages(socket, db) {
  try {
    await db.each(
      "SELECT id, user_name, content, is_guess FROM messages WHERE room_id = ? AND id > ?",
      [
        socket.handshake.auth.roomID,
        socket.handshake.auth.serverChatOffset || 0,
      ],
      (_err, row) => {
        const text = row.is_guess
          ? `${row.user_name} guessed the word!`
          : row.content;
        socket.emit("chat message", {
          userName: row.user_name,
          text,
          isGuess: row.is_guess,
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
    setGameStatus(roomID, "playing");

    const roomMembers = io.sockets.adapter.rooms.get(roomID);

    const selectedPlayerId =
      Array.from(roomMembers)[Math.floor(Math.random() * roomMembers.size)];

    const sockets = await io.in(selectedPlayerId).fetchSockets();
    const selectedPlyayerUserName = sockets[0].handshake.auth.userName;

    const guessWord = await getRandomWord();
    setGuessWord(roomID, guessWord);

    io.to(selectedPlayerId).emit("selected player", {
      isCurrentTurn: true,
      guessWord,
    });

    io.to(roomID).emit("user name drawing", selectedPlyayerUserName);
    startTimer(roomID, 5, io);
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

  socket.on("play again", () => {
    const roomID = socket.handshake.auth.roomID;
    clear(roomID);
    setGameStatus(roomID, "countdown");
    socket.to(roomID).emit("play again");
  });

  socket.on("chat message", async (message, clientOffset) => {
    const guessWord = getGameGuessword(socket.handshake.auth.roomID);
    if (message.text.includes(guessWord)) message.isGuess = true;
    await handleChatMessage(socket, db, message, clientOffset);
  });

  if (!socket.recovered) {
    await handleRecoveredMessages(socket, db);
    await handleRecoveredLines(socket);
    await handleRecoverGameStatus(socket);
  }
}

module.exports = { handleSocketEvents };
