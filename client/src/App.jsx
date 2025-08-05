import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [username, setUsername] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editText, setEditText] = useState('');
  const [lastEditId, setLastEditId] = useState(null);
  const [retryStreaks, setRetryStreaks] = useState({});
  const [theme, setTheme] = useState('light');
  const typingUsers = useRef(new Set());

  const addSystemMessage = (msg) => {
    setMessages((prev) => [...prev, { id: Date.now(), system: true, text: msg }]);
  };

  useEffect(() => {
    const handleChatHistory = (msgs) => setMessages(msgs);
    const handleNewMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const handleUpdateMessage = (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
      );

      if (
        updatedMsg.retries > 0 &&
        updatedMsg.sender === username &&
        updatedMsg.id !== lastEditId
      ) {
        setEditTarget(updatedMsg.id);
        setEditText(updatedMsg.text);
      }

      if (updatedMsg.retries > 0) {
        setRetryStreaks((prev) => {
          const newStreaks = { ...prev };
          newStreaks[updatedMsg.sender] = (newStreaks[updatedMsg.sender] || 0) + 1;
          return newStreaks;
        });
      }
    };

    socket.on('chatHistory', handleChatHistory);
    socket.on('newMessage', handleNewMessage);
    socket.on('updateMessage', handleUpdateMessage);

    return () => {
      socket.off('chatHistory', handleChatHistory);
      socket.off('newMessage', handleNewMessage);
      socket.off('updateMessage', handleUpdateMessage);
    };
  }, [username, lastEditId]);

  useEffect(() => {
    const typingHandler = (user) => {
      typingUsers.current.add(user);
      setTimeout(() => {
        typingUsers.current.delete(user);
      }, 2000);
    };
    socket.on('typing', typingHandler);
    return () => socket.off('typing', typingHandler);
  }, []);

  const login = async () => {
    const res = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (res.ok) {
      setLoggedIn(true);
      socket.emit('join', username);
      addSystemMessage(`${username} joined the chat`);
    }
  };

  const sendMessage = () => {
    if (text.trim() !== '') {
      socket.emit('sendMessage', { text });
      setText('');
    }
  };

  const sendFeedback = (id, type) => {
    socket.emit('feedback', { id, type });
  };

  const submitEdit = () => {
    if (editTarget !== null) {
      socket.emit('feedback', {
        id: editTarget,
        type: 'edit',
        newText: editText
      });
      setLastEditId(editTarget);
      setEditTarget(null);
      setEditText('');
      addSystemMessage("Edit submitted.");
    }
  };

  const notifyTyping = () => {
    socket.emit('typing', username);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!loggedIn) {
    return (
      <div className={`login-box ${theme}`}>
        <h2>💬 First Impressions</h2>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your name"
        />
        <button onClick={login}>Enter</button>
        <button className="theme-btn" onClick={toggleTheme}>Toggle Theme</button>
      </div>
    );
  }

  return (
    <div className={`chat-container ${theme}`}>
      <header>
        <h2>Welcome, {username}</h2>
        <div className="top-bar">
          <button onClick={toggleTheme}>🌓 Theme</button>
          <button onClick={clearChat}>🧹 Clear</button>
          <span className="streak">
            🔁 Retry Streak: {retryStreaks[username] || 0}
          </span>
        </div>
      </header>
      {editTarget !== null && (
        <div className="edit-popup">
          <h4>🔁 Retry Requested — Make it better:</h4>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <button onClick={submitEdit}>✅ Submit Edit</button>
        </div>
      )}
      <div className="typing">
        {[...typingUsers.current].map((user) => (
          <span key={user}>{user} is typing...</span>
        ))}
      </div>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.system ? 'system' : msg.sender === username ? 'me' : 'them'}`}>
            <div className="bubble" title={new Date().toLocaleString()}>
              {msg.system ? (
                <i>{msg.text}</i>
              ) : (
                <>
                  <b className="tag">@{msg.sender}</b> {msg.text}
                  <div className="actions">
                    <span onClick={() => sendFeedback(msg.id, 'like')}>👍 {msg.likes}</span>
                    <span onClick={() => sendFeedback(msg.id, 'retry')}>🔁 {msg.retries}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="input-bar">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); notifyTyping(); }}
          placeholder="Say something..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;