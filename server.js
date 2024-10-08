const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  methods: ["GET", "POST"],
  transports: ["websocket", "polling"],
});

module.exports = { app, server, io };
