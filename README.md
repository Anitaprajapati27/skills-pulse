# Skills Pulse - OTP Email Verification

Node.js + Express + PostgreSQL backend with a simple frontend that verifies a user's email using a 6-digit OTP sent via Nodemailer.

## Features
- Register user, send / verify / resend OTP
- OTP hashed with bcrypt, expires in 5 minutes, single use
- Max 5 wrong attempts, 60s resend cooldown
- Verification status stored in PostgreSQL

## Setup
1. Clone the repo and run `cd skills-pulse/backend`
2. `npm install`
3. Create the database: `psql -U postgres -c "CREATE DATABASE skills_pulse;"`
4. Create tables: `psql -U postgres -d skills_pulse -f src/schema.sql`
5. Copy `.env.example` to `.env` and fill in your PostgreSQL password and Gmail App Password
6. `npm run dev`
7. Open http://localhost:5000

## API Endpoints
| Method | Endpoint | Body |
|---|---|---|
| POST | /api/auth/register | name, email |
| POST | /api/auth/send-otp | email |
| POST | /api/auth/verify-otp | email, otp |
| POST | /api/auth/resend-otp | email |

## Security
Real credentials live in `.env`, which is excluded via `.gitignore`. Use `.env.example` as a template.