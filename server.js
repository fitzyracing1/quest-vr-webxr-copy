const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

let clients = 0;
let blocks = [];
let generatedChunks = new Set(); // Track which chunks have been generated

// Initialize with hidden Easter egg blocks
const easterEggs = [
  { id: 'egg-0', pos: { x: -5, y: 3, z: -10 }, color: '#FFD700', isEgg: true, name: 'Gold Cube' },
  { id: 'egg-1', pos: { x: 8, y: 2, z: 5 }, color: '#FF1493', isEgg: true, name: 'Pink Star' },
  { id: 'egg-2', pos: { x: 0, y: 5, z: -15 }, color: '#00FFFF', isEgg: true, name: 'Cyan Mystery' },
  { id: 'egg-3', pos: { x: 12, y: 1, z: -8 }, color: '#00FF00', isEgg: true, name: 'Green Secret' },
  { id: 'egg-4', pos: { x: -10, y: 4, z: 10 }, color: '#FF6347', isEgg: true, name: 'Red Treasure' },
];

blocks = [...easterEggs];

// Procedural chunk generation
function generateChunk(chunkX, chunkZ) {
  const key = `${chunkX},${chunkZ}`;
  if (generatedChunks.has(key)) return [];

  generatedChunks.add(key);
  const chunkBlocks = [];
  const chunkSize = 20; // 20x20 blocks per chunk
  const baseX = chunkX * chunkSize;
  const baseZ = chunkZ * chunkSize;
  
  // Create a procedural landscape using Perlin-like noise (deterministic hash)
  for (let dx = 0; dx < 4; dx++) {
    for (let dz = 0; dz < 4; dz++) {
      const x = baseX + dx * 5;
      const z = baseZ + dz * 5;
      const seed = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const height = Math.floor((seed % 1) * 4) + 1;
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
      
      for (let y = 0; y < height; y++) {
        const blockId = `chunk-${chunkX}-${chunkZ}-${dx}-${dz}-${y}`;
        chunkBlocks.push({
          id: blockId,
          pos: { x, y, z },
          color: colors[Math.floor((seed * 10) % colors.length)],
          isChunk: true
        });
      }
    }
  }
  
  return chunkBlocks;
}

io.on('connection', (socket) => {
  clients++;
  io.emit('presence', { clients });
  
  // Send initial world state to new client
  socket.emit('blocks-init', blocks);
  
  // Handle player position updates for chunking
  socket.on('player-moved', (data) => {
    const playerX = data.pos.x;
    const playerZ = data.pos.z;
    const chunkSize = 20;
    const chunkRadius = 2; // Generate chunks 2 chunks away
    
    // Determine which chunk the player is in
    const chunkX = Math.floor(playerX / chunkSize);
    const chunkZ = Math.floor(playerZ / chunkSize);
    
    // Generate chunks around player
    for (let cx = chunkX - chunkRadius; cx <= chunkX + chunkRadius; cx++) {
      for (let cz = chunkZ - chunkRadius; cz <= chunkZ + chunkRadius; cz++) {
        const newBlocks = generateChunk(cx, cz);
        if (newBlocks.length > 0) {
          blocks.push(...newBlocks);
          io.emit('chunk-generated', { blocks: newBlocks, chunkX: cx, chunkZ: cz });
        }
      }
    }
  });
  
  // Handle block placement
  socket.on('place-block', (block) => {
    blocks.push(block);
    io.emit('block-added', block);
  });
  
  // Handle block removal
  socket.on('remove-block', (data) => {
    blocks = blocks.filter(b => b.id !== data.id);
    io.emit('block-removed', data);
  });
  
  // Handle Easter egg discovery
  socket.on('discover-egg', (data) => {
    io.emit('egg-found', { eggId: data.id, playerMessage: `Found: ${data.name}!` });
  });
  
  // Handle scan activation
  socket.on('scan-activated', (data) => {
    io.emit('world-scan', { activatedBy: data.playerId });
  });
  
  socket.on('disconnect', () => {
    clients = Math.max(0, clients - 1);
    io.emit('presence', { clients });
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    clients,
    blocks: blocks.length,
    chunks: generatedChunks.size,
    eggs: easterEggs.length,
    uptime: process.uptime(),
    host: os.hostname()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  if (addrs.length) {
    for (const ip of addrs) {
      console.log(`📡 LAN: http://${ip}:${PORT}`);
    }
  }
  console.log(`🥚 Easter eggs hidden: ${easterEggs.length}`);
  console.log(`🌍 Procedural world generation enabled`);
});
