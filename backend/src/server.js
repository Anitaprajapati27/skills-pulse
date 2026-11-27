require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware: runs on every request before your routes
app.use(cors());           // allows the frontend to call this API
app.use(express.json());   // parses JSON request bodies into req.body
app.use(express.static(path.join(__dirname, '../../frontend')));

// A simple test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Skills Pulse backend is running' });
});

const pool = require('./db');
pool.query('SELECT NOW()')
  .then(r => console.log('DB connected:', r.rows[0].now))
  .catch(e => console.error('DB error:', e.message));

app.use('/api/auth', require('./routes/auth'));

// Error-handling middleware (must come after routes)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Something went wrong on the server' });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});