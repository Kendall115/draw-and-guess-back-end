const { server, app } = require("./server");
const { connectToDatabase } = require("./database");
const { handleSocketEvents } = require("./socketEvents");
const { io } = require("./server");

async function main() {
  const db = await connectToDatabase();

  server.listen(3000, () => {
    console.log("server running at http://localhost:3000");
  });

  app.get("/", (req, res) => {});

  io.on("connection", (socket) => {
    handleSocketEvents(io, socket, db);
  });
}

main();
