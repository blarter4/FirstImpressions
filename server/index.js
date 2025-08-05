const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const users = {};
const messages = [];

app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).send('Username required');
  res.status(200).json({ success: true });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    socket.username = username;
    users[socket.id] = username;
    socket.emit('chatHistory', messages);
  });

  socket.on('sendMessage', (msg) => {
    const message = {
      id: messages.length,
      text: msg.text,
      sender: socket.username,
      likes: 0,
      retries: 0
    };
    messages.push(message);
    io.emit('newMessage', message);
  });

  socket.on('feedback', ({ id, type, newText }) => {
    if (id >= messages.length) return;
    const message = messages[id];

    if (type === 'like') {
      message.likes++;
    } else if (type === 'retry') {
      message.retries++;
    } else if (type === 'edit' && newText !== undefined && message.sender === socket.username) {
      message.text = newText;
    }

    io.emit('updateMessage', message);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

server.listen(5000, () => console.log('✅ Server listening on http://localhost:5000'));