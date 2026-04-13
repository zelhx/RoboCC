require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { solve } = require('./kinematics/ik');

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

  // ik:solve — client sends { target: [x, y, z], dhParams?, initialAngles?, options? }
  // Emits back ik:solution — { angles, positions, converged, error } or { error: string }
  socket.on('ik:solve', (data, ack) => {
    try {
      const { target, dhParams, initialAngles, options } = data || {};
      console.log(`[ik:solve] Received from ${socket.id} — target:`, target);
      if (initialAngles) console.log(`[ik:solve] initialAngles:`, initialAngles);
      const result = solve(target, dhParams, initialAngles, options);
      console.log(`[ik:solve] Solved — converged: ${result.converged}, angles:`, result.angles);
      const payload = { success: true, ...result };
      if (typeof ack === 'function') {
        ack(payload);
      } else {
        socket.emit('ik:solution', payload);
      }
    } catch (err) {
      console.error(`[RoboCC] ik:solve error for ${socket.id}:`, err.message);
      const payload = { success: false, error: err.message };
      if (typeof ack === 'function') {
        ack(payload);
      } else {
        socket.emit('ik:solution', payload);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[RoboCC] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[RoboCC] Server running on port ${PORT}`);
});
