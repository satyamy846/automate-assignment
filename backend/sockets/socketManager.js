const { socketLogger } = require('../utils/logger/index')

class SocketManager {
    constructor(io) {
      this.io = io;
      this.onlineUsers = new Map();
      this.registerEvents();
    }
  
    registerEvents() {
      this.io.on("connection", (socket) => {
        socketLogger.info("User connected:", {socket_id:socket.id});
        socket.emit("ping", "Pinging you......");
        socket.on("pong", (msg) => {
          socketLogger.info("Pong received from client:", {socket_id:socket.id, message: msg});
        })
      });
    }
  }
  
module.exports = SocketManager;
  