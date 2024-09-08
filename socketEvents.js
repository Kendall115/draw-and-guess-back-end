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
  addPlayer,
  removePlayer,
  getPlayers,
} = require("./gameManager");

const { startTimer, getRandomPlayer } = require("./gameUtils");
const { getRandomWord } = require("./database");

const GAME_TIME = 45;

async function handleSocketEvents(io, socket, db) {
  const roomID = socket.handshake.auth.roomID;

  socket.on("join room", (roomID, callback) => {
    const room = io.sockets.adapter.rooms.get(roomID);

    if (!room) return callback(false);

    addPlayer(roomID, socket.handshake.auth.userName);
    socket.join(roomID);
    socket.to(roomID).emit("update player list", getPlayers(roomID));
    callback(true, getGameStatus(roomID));
  });

  socket.on("create room", (roomID) => {
    addGame(roomID);
    addPlayer(roomID, socket.handshake.auth.userName);
    socket.join(roomID);
    socket.to(roomID).emit("update player list", getPlayers(roomID));
  });

  socket.on("start countdown", () => {
    socket.broadcast.to(roomID).emit("start countdown", false);
  });

  socket.on("start game", async () => {
    setGameStatus(roomID, "playing");

    const { selectedPlayerUserName, selectedPlayerId } = await getRandomPlayer(
      roomID,
      io
    );

    const guessWord = await getRandomWord();
    setGuessWord(roomID, guessWord);

    io.to(selectedPlayerId).emit("selected player", {
      isCurrentTurn: true,
      guessWord,
    });

    io.to(roomID).emit("user name drawing", selectedPlayerUserName);
    io.to(roomID).emit("start game", selectedPlayerUserName);
    startTimer(roomID, GAME_TIME, io);
  });

  socket.on("drawingNewLine", (line, clientOffset) => {
    createLine(line, roomID);
    socket.broadcast.to(roomID).emit("drawingNewLine", line, clientOffset);
  });

  socket.on("drawing", (point, clientOffset) => {
    addPoint(point, roomID);
    socket.broadcast.to(roomID).emit("drawing", point, clientOffset);
  });

  socket.on("undo", (clientOffset) => {
    undo(roomID);
    socket.broadcast.to(roomID).emit("undo", clientOffset);
  });

  socket.on("clear", (clientOffset) => {
    clear(roomID);
    socket.broadcast.to(roomID).emit("clear", clientOffset);
  });

  socket.on("play again", () => {
    clear(roomID);
    setGameStatus(roomID, "countdown");
    socket.to(roomID).emit("play again");
  });

  socket.on("auth update", (newAuth) => {
    socket.handshake.auth = newAuth;
  });

  socket.on("chat message", async (message, clientOffset) => {
    const guessWord = getGameGuessword(roomID);
    if (
      message.text.includes(guessWord) &&
      !socket.handshake.auth.isCurrentTurn
    )
      message.isGuess = true;
    await handleChatMessage(socket, db, message, clientOffset);
  });

  socket.on("get player list", (callback) => {
    const players = getPlayers(roomID);
    return callback(players);
  });

  socket.on("disconnect", () => {
    removePlayer(roomID, socket.handshake.auth.userName);
    socket.to(roomID).emit("update player list", getPlayers(roomID));
  });

  if (!socket.recovered) {
    await handleRecoveredMessages(socket, db);
    await handleRecoveredLines(socket);
    await handleRecoverGameStatus(socket);
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
    console.log(error);
    return;
  }

  if (
    message.isGuess &&
    !socket.handshake.auth.isCurrentTurn &&
    getGameStatus(message.roomID) === "playing"
  ) {
    message.text = `${message.userName} guessed the word!`;
    message.userName = "";
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

module.exports = { handleSocketEvents };
