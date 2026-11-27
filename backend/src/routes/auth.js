const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { sendOtpEmail } = require('../mailer');

const router = express.Router();
const EXPIRY = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;

const isEmail = (e) => typeof e === 'string' && /^\S+@\S+\.\S+$/.test(e);

// Generates, hashes, stores and emails a new OTP
async function issueOtp(user) {
  const otp = crypto.randomInt(100000, 1000000).toString(); // 6 digits
  const otpHash = await bcrypt.hash(otp, 10);

  // invalidate older unused OTPs so only the newest works
  await pool.query('UPDATE otps SET is_used = TRUE WHERE user_id = $1 AND is_used = FALSE', [user.id]);
  await pool.query(
    `INSERT INTO otps (user_id, otp_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
    [user.id, otpHash, EXPIRY]
  );
  await sendOtpEmail(user.email, user.name, otp);
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid name and email are required' });
    }
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows[0]?.is_verified) {
      return res.status(409).json({ success: false, message: 'Email already registered and verified' });
    }
    if (existing.rows[0]) {
      return res.json({ success: true, message: 'User already registered, please verify' });
    }
    await pool.query('INSERT INTO users (name, email) VALUES ($1, $2)', [name.trim(), email.toLowerCase()]);
    res.status(201).json({ success: true, message: 'User registered' });
  } catch (err) { next(err); }
});

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!isEmail(email)) return res.status(400).json({ success: false, message: 'Valid email required' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found. Register first' });
    if (user.is_verified) return res.status(400).json({ success: false, message: 'Email already verified' });

    await issueOtp(user);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) { next(err); }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!isEmail(email)) return res.status(400).json({ success: false, message: 'Valid email required' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.is_verified) return res.status(400).json({ success: false, message: 'Email already verified' });

    const recent = await pool.query(
      `SELECT 1 FROM otps WHERE user_id = $1 AND created_at > NOW() - ($2 || ' seconds')::interval`,
      [user.id, RESEND_COOLDOWN_SEC]
    );
    if (recent.rows.length) {
      return res.status(429).json({ success: false, message: `Please wait ${RESEND_COOLDOWN_SEC} seconds before resending` });
    }
    await issueOtp(user);
    res.json({ success: true, message: 'New OTP sent' });
  } catch (err) { next(err); }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!isEmail(email) || !/^\d{6}$/.test(otp || '')) {
      return res.status(400).json({ success: false, message: 'Email and a 6-digit OTP are required' });
    }
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.is_verified) return res.status(400).json({ success: false, message: 'Email already verified' });

    const otpRes = await pool.query(
      `SELECT *, (expires_at < NOW()) AS expired FROM otps
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    const record = otpRes.rows[0];
    if (!record) return res.status(400).json({ success: false, message: 'No OTP found. Request one first' });
    if (record.is_used) return res.status(400).json({ success: false, message: 'OTP already used or replaced. Request a new one' });
    if (record.expired) return res.status(400).json({ success: false, message: 'OTP expired. Request a new one' });
    if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP' });

    const match = await bcrypt.compare(otp, record.otp_hash);
    if (!match) {
      await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }

    await pool.query('UPDATE otps SET is_used = TRUE WHERE id = $1', [record.id]);
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [user.id]);
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) { next(err); }
});

module.exports = router;