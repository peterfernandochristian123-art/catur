const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Online Chess Rooms (persisted to disk so data survives server restarts)
// Key: pin string, Value: Room Object (subscribers are runtime-only and not persisted)
const DATA_FILE = path.join(__dirname, 'rooms-data.json');
const rooms = new Map();

function persistRooms() {
  try {
    const data = Array.from(rooms.values()).map(sanitizeRoom);
    fs.writeFileSync(DATA_FILE, JSON.stringify({ savedAt: Date.now(), rooms: data }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Gagal menyimpan data room:', err.message);
  }
}

function loadRooms() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed && parsed.rooms) ? parsed.rooms : [];
    const now = Date.now();
    for (const room of list) {
      if (!room || !room.pin) continue;
      // Drop very old rooms (> 7 days) to keep data file small
      if (now - (room.lastActivity || room.createdAt || 0) > 7 * 24 * 3600 * 1000) continue;
      rooms.set(String(room.pin), { ...room, subscribers: new Set() });
    }
    if (rooms.size) console.log(`Memuat ${rooms.size} room dari penyimpanan lokal.`);
  } catch (err) {
    console.warn('Gagal memuat data room:', err.message);
  }
}

loadRooms();

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const dev in ifaces) {
    for (const details of ifaces[dev]) {
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }
  return 'localhost';
}

function sanitizeRoom(room) {
  if (!room) return null;
  return {
    pin: room.pin,
    timeLimit: room.timeLimit,
    host: room.host,
    guest: room.guest,
    status: room.status,
    fen: room.fen,
    moves: room.moves,
    turn: room.turn,
    whiteTime: room.whiteTime,
    blackTime: room.blackTime,
    winner: room.winner,
    resultReason: room.resultReason,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity
  };
}

function broadcastToRoom(pin, eventName, data) {
  const room = rooms.get(pin);
  if (!room || !room.subscribers) return;

  const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const clientRes of room.subscribers) {
    try {
      clientRes.write(message);
    } catch (err) {
      room.subscribers.delete(clientRes);
    }
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB max
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Clean up stale rooms (> 6 hours old) every 30 minutes
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [pin, room] of rooms.entries()) {
    if (now - (room.lastActivity || room.createdAt) > 6 * 3600 * 1000) {
      if (room.subscribers) {
        for (const res of room.subscribers) {
          try { res.end(); } catch (e) {}
        }
      }
      rooms.delete(pin);
      changed = true;
    }
  }
  if (changed) persistRooms();
}, 30 * 60 * 1000);

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ==================== API ROUTES ====================

  // 1. GET /api/info
  if (req.method === 'GET' && pathname === '/api/info') {
    return sendJson(res, 200, {
      lanIp: getLanIp(),
      port: PORT,
      activeRoomsCount: rooms.size
    });
  }

  // 2. POST /api/rooms/create
  if (req.method === 'POST' && pathname === '/api/rooms/create') {
    try {
      const body = await parseJsonBody(req);
      let pin;
      do {
        pin = Math.floor(1000 + Math.random() * 9000).toString();
      } while (rooms.has(pin));

      const timeLimit = typeof body.timeLimit === 'number' ? body.timeLimit : 600;
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      const newRoom = {
        pin,
        timeLimit,
        host: {
          name: body.hostName || 'Pemain 1',
          studentClass: body.hostClass || 'X-A',
          avatar: body.hostAvatar || 'â™š',
          color: 'w',
          connected: true
        },
        guest: null,
        status: 'waiting', // 'waiting', 'playing', 'finished'
        fen: initialFen,
        moves: [],
        turn: 'w',
        whiteTime: timeLimit,
        blackTime: timeLimit,
        winner: null,
        resultReason: null,
        subscribers: new Set(),
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      rooms.set(pin, newRoom);
      persistRooms();
      return sendJson(res, 201, {
        success: true,
        pin,
        color: 'w',
        room: sanitizeRoom(newRoom)
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, message: err.message });
    }
  }

  // 3. POST /api/rooms/join
  if (req.method === 'POST' && pathname === '/api/rooms/join') {
    try {
      const body = await parseJsonBody(req);
      const pin = (body.pin || '').toString().trim();
      const room = rooms.get(pin);

      if (!room) {
        return sendJson(res, 404, { success: false, message: 'Ruang catur dengan PIN tersebut tidak ditemukan!' });
      }

      if (room.status === 'playing' && room.guest && room.guest.name !== body.guestName) {
        return sendJson(res, 400, { success: false, message: 'Ruangan sudah terisi oleh 2 pemain lain!' });
      }

      room.guest = {
        name: body.guestName || 'Pemain 2',
        studentClass: body.guestClass || 'X-B',
        avatar: body.guestAvatar || 'â™š',
        color: 'b',
        connected: true
      };
      room.status = 'playing';
      room.lastActivity = Date.now();
      persistRooms();

      // Notify host and all listeners
      broadcastToRoom(pin, 'start', { room: sanitizeRoom(room) });

      return sendJson(res, 200, {
        success: true,
        pin,
        color: 'b',
        room: sanitizeRoom(room)
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, message: err.message });
    }
  }

  // 4. GET /api/rooms/:pin/events (Server-Sent Events)
  const eventsMatch = pathname.match(/^\/api\/rooms\/([0-9]{4,6})\/events$/);
  if (req.method === 'GET' && eventsMatch) {
    const pin = eventsMatch[1];
    const room = rooms.get(pin);

    if (!room) {
      return sendJson(res, 404, { success: false, message: 'Ruang tidak ditemukan' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`event: init\ndata: ${JSON.stringify({ room: sanitizeRoom(room) })}\n\n`);
    room.subscribers.add(res);

    // Keepalive heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (e) {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      if (room.subscribers) {
        room.subscribers.delete(res);
      }
    });
    return;
  }

  // 5. GET /api/rooms/:pin
  const getRoomMatch = pathname.match(/^\/api\/rooms\/([0-9]{4,6})$/);
  if (req.method === 'GET' && getRoomMatch) {
    const pin = getRoomMatch[1];
    const room = rooms.get(pin);
    if (!room) {
      return sendJson(res, 404, { success: false, message: 'Ruang tidak ditemukan' });
    }
    return sendJson(res, 200, { success: true, room: sanitizeRoom(room) });
  }

  // 6. POST /api/rooms/:pin/move
  const moveMatch = pathname.match(/^\/api\/rooms\/([0-9]{4,6})\/move$/);
  if (req.method === 'POST' && moveMatch) {
    const pin = moveMatch[1];
    const room = rooms.get(pin);
    if (!room) {
      return sendJson(res, 404, { success: false, message: 'Ruang tidak ditemukan' });
    }

    try {
      const body = await parseJsonBody(req);
      room.fen = body.fen || room.fen;
      room.turn = body.turn || (room.turn === 'w' ? 'b' : 'w');
      if (typeof body.whiteTime === 'number') room.whiteTime = body.whiteTime;
      if (typeof body.blackTime === 'number') room.blackTime = body.blackTime;
      room.lastActivity = Date.now();

      const moveEntry = {
        color: body.color,
        move: body.move,
        san: body.san,
        fen: room.fen,
        turn: room.turn,
        whiteTime: room.whiteTime,
        blackTime: room.blackTime,
        timestamp: Date.now()
      };
      room.moves.push(moveEntry);

      if (body.isGameOver) {
        room.status = 'finished';
        room.winner = body.winner || null;
        room.resultReason = body.resultReason || 'Selesai';
      }
      persistRooms();

      broadcastToRoom(pin, 'move', {
        moveEntry,
        room: sanitizeRoom(room)
      });

      return sendJson(res, 200, { success: true, room: sanitizeRoom(room) });
    } catch (err) {
      return sendJson(res, 400, { success: false, message: err.message });
    }
  }

  // 7. POST /api/rooms/:pin/resign
  const resignMatch = pathname.match(/^\/api\/rooms\/([0-9]{4,6})\/resign$/);
  if (req.method === 'POST' && resignMatch) {
    const pin = resignMatch[1];
    const room = rooms.get(pin);
    if (!room) {
      return sendJson(res, 404, { success: false, message: 'Ruang tidak ditemukan' });
    }

    try {
      const body = await parseJsonBody(req);
      const resignerColor = body.color || 'w';
      room.status = 'finished';
      room.winner = resignerColor === 'w' ? 'b' : 'w';
      room.resultReason = `Pemain ${resignerColor === 'w' ? 'Putih' : 'Hitam'} Menyerah (Resign)`;
      room.lastActivity = Date.now();
      persistRooms();

      broadcastToRoom(pin, 'game_over', {
        winner: room.winner,
        resultReason: room.resultReason,
        room: sanitizeRoom(room)
      });

      return sendJson(res, 200, { success: true, room: sanitizeRoom(room) });
    } catch (err) {
      return sendJson(res, 400, { success: false, message: err.message });
    }
  }

  // 8. POST /api/rooms/:pin/rematch
  const rematchMatch = pathname.match(/^\/api\/rooms\/([0-9]{4,6})\/rematch$/);
  if (req.method === 'POST' && rematchMatch) {
    const pin = rematchMatch[1];
    const room = rooms.get(pin);
    if (!room) {
      return sendJson(res, 404, { success: false, message: 'Ruang tidak ditemukan' });
    }

    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    room.fen = initialFen;
    room.moves = [];
    room.turn = 'w';
    room.whiteTime = room.timeLimit;
    room.blackTime = room.timeLimit;
    room.status = 'playing';
    room.winner = null;
    room.resultReason = null;
    room.lastActivity = Date.now();
    persistRooms();

    broadcastToRoom(pin, 'rematch', { room: sanitizeRoom(room) });
    return sendJson(res, 200, { success: true, room: sanitizeRoom(room) });
  }

  // 9. POST /api/rooms/:pin/leave
  const leaveMatch = pathname.match(/^\/api\/rooms\/([0-9]{4,6})\/leave$/);
  if (req.method === 'POST' && leaveMatch) {
    const pin = leaveMatch[1];
    const room = rooms.get(pin);
    if (room) {
      broadcastToRoom(pin, 'player_left', { pin });
    }
    return sendJson(res, 200, { success: true });
  }

  // ==================== STATIC FILE SERVING ====================
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(__dirname, reqPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  console.log(`Server Catur Sekolah aktif!`);
  console.log(`- Akses Lokal  : http://localhost:${PORT}`);
  console.log(`- Akses Lab/WiFi: http://${lanIp}:${PORT}`);
});
