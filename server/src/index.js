import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { router as apiRouter } from './routes/index.js';
import { initIo } from './realtime/io.js';

const app = express();

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Create HTTP server and attach Socket.IO for realtime features.
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Make the Socket.IO instance available to other modules.
initIo(io);

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  // Join a room for a specific SOS id so we can broadcast updates
  // only to the people interested in that SOS.
  socket.on('sos:join', ({ sosId }) => {
    if (!sosId) return;
    socket.join(`sos:${sosId}`);
  });

  socket.on('sos:leave', ({ sosId }) => {
    if (!sosId) return;
    socket.leave(`sos:${sosId}`);
  });

  // Helpers send their live location here. The server simply relays
  // the latest position to everyone in the same SOS room.
  socket.on('helper:location', ({ sosId, latitude, longitude }) => {
    if (!sosId || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return;
    }
    io.to(`sos:${sosId}`).emit('location:update', {
      sosId,
      latitude,
      longitude,
      at: new Date().toISOString(),
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
