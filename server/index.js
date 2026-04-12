require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'RoboCC' });
});

io.on('connection', (socket) => {
  console.log(`[RoboCC] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[RoboCC] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[RoboCC] Server running on port ${PORT}`);
});
