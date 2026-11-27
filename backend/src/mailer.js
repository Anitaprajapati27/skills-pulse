require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendOtpEmail(to, name, otp) {
  await transporter.sendMail({
    from: `"Skills Pulse" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your Skills Pulse verification code',
    text: `Hi ${name}, your OTP is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.`,
  });
}

module.exports = { sendOtpEmail };