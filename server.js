require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ── Vercel Serverless Database Connection ────────────────────────────────────
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        const uri = process.env.MONGO_URI;
        if (!uri || uri.includes('localhost')) {
          return res.status(500).json({ error: 'Production MONGO_URI missing in Vercel environment variables.' });
        }
        await mongoose.connect(uri);
      }
      next();
    } catch (err) {
      console.error('Vercel DB Connection Error:', err);
      res.status(500).json({ error: 'Database connection failed.' });
    }
  });
}
// ── Simple request logger ────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).send('<h1>ARchSpace Backend is Running!</h1><p>API is active.</p>');
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ── Config ───────────────────────────────────────────────────────────────────
const APPROVED_COMPANY_CODE = process.env.COMPANY_CODE || 'ARCH2026';

// ── Simple password hashing (no bcrypt dependency needed) ────────────────────
function hashPassword(plaintext) {
  // SHA-256 with a fixed salt prefix — good enough for local/demo use
  return crypto.createHash('sha256').update('archspace_salt_' + plaintext).digest('hex');
}

function checkPassword(plaintext, stored) {
  return hashPassword(plaintext) === stored;
}

// ── Mongoose model ───────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  email:             { type: String, required: true, unique: true, index: true },
  password:          { type: String, required: true },
  userName:          { type: String },
  lastProfileUpdate: { type: Date },
  createdAt:         { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

// ── In-memory OTP store (use Redis/MongoDB TTL in production) ────────────────
const otpStore = {};

// ── Password rules ───────────────────────────────────────────────────────────
function validatePassword(password) {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < 8)          return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(password))      return 'Password must include at least 1 lowercase letter.';
  if (!/[A-Z]/.test(password))      return 'Password must include at least 1 uppercase letter.';
  if (!/[0-9]/.test(password))      return 'Password must include at least 1 number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least 1 special character.';
  return null;
}

// ── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ── Register ─────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, companyCode, userName } = req.body;

    if (!email || !password || !companyCode) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const emailNormalized = String(email).trim().toLowerCase();

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    if (companyCode !== APPROVED_COMPANY_CODE) {
      return res.status(403).json({ error: 'Invalid Company Code provided.' });
    }

    const existingUser = await User.findOne({ email: emailNormalized });
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const user = new User({
      email:    emailNormalized,
      password: hashPassword(password),
      userName: userName || emailNormalized.split('@')[0],
    });
    await user.save();

    console.log(`✅ User registered: ${emailNormalized}`);
    res.status(201).json({
      message: 'User registered successfully!',
      user: { email: user.email, userName: user.userName },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const emailNormalized = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailNormalized });

    if (!user) {
      return res.status(404).json({ error: 'Account not registered. Please sign up.' });
    }

    // Support both old plain-text passwords and new hashed passwords
    const passwordMatch = checkPassword(password, user.password) || user.password === password;
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    // Migrate plain-text password to hashed on successful login
    if (user.password === password) {
      user.password = hashPassword(password);
      await user.save();
    }

    console.log(`✅ User logged in: ${emailNormalized}`);
    res.status(200).json({
      message: 'Login successful!',
      user: { email: user.email, userName: user.userName },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ── Update Profile ────────────────────────────────────────────────────────────
app.put('/api/auth/profile', async (req, res) => {
  try {
    const { email, userName } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.lastProfileUpdate) {
      const twoWeeks = 14 * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(user.lastProfileUpdate).getTime() < twoWeeks) {
        return res.status(403).json({ error: 'You can only update your profile once every 2 weeks.' });
      }
    }

    user.userName          = userName || user.userName;
    user.lastProfileUpdate = new Date();
    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: { email: user.email, userName: user.userName, lastProfileUpdate: user.lastProfileUpdate },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── Delete Account ────────────────────────────────────────────────────────────
app.delete('/api/auth/profile', async (req, res) => {
  try {
    const { email } = req.body;
    await User.findOneAndDelete({ email });
    res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── Send OTP ──────────────────────────────────────────────────────────────────
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const emailNormalized = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: emailNormalized });
    if (!existingUser) {
      return res.status(404).json({ error: 'Account not registered. Please sign up.' });
    }

    // Generate 4-digit OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore[emailNormalized] = { code: generatedOtp, expires: Date.now() + 10 * 60 * 1000 };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from:    `"ARchSpace" <${process.env.EMAIL_USER}>`,
        to:      emailNormalized,
        subject: 'Your ARchSpace Login Code',
        text:    `Your one-time login code is: ${generatedOtp}\nThis code expires in 10 minutes.`,
      };

      try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'OTP sent to your email.' });
      } catch (mailErr) {
        console.error('Mail error:', mailErr.message);
        // Fall through to demo mode so login still works
        console.log(`[DEMO FALLBACK] OTP for ${emailNormalized}: ${generatedOtp}`);
        return res.status(200).json({
          message: 'Email delivery failed — showing code in demo mode.',
          demoModeCode: generatedOtp,
        });
      }
    } else {
      // Demo mode: no email credentials set up
      console.log(`[DEMO] OTP for ${emailNormalized}: ${generatedOtp}`);
      return res.status(200).json({
        message: 'OTP ready (demo mode — add EMAIL_USER/EMAIL_PASS to .env to send real emails).',
        demoModeCode: generatedOtp,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating OTP.' });
  }
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const emailNormalized = String(email || '').trim().toLowerCase();
    const record = otpStore[emailNormalized];

    if (!record) {
      return res.status(400).json({ error: 'No OTP requested for this email.' });
    }

    if (Date.now() > record.expires) {
      delete otpStore[emailNormalized];
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (record.code !== String(otp).trim()) {
      return res.status(401).json({ error: 'Invalid verification code.' });
    }

    const user = await User.findOne({ email: emailNormalized });
    delete otpStore[emailNormalized];

    console.log(`✅ OTP verified: ${emailNormalized}`);
    return res.status(200).json({
      message: 'Logged in successfully.',
      user: { email: user.email, userName: user.userName },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error verifying OTP.' });
  }
});

// ── Verify session (called by the app on startup) ────────────────────────────
app.get('/api/auth/verify', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Session invalid. Please log in again.' });

    res.status(200).json({ valid: true, user: { email: user.email, userName: user.userName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP — connect DB then start server
// ═════════════════════════════════════════════════════════════════════════════
const BOOT_PORT = parseInt(process.env.PORT || '3000', 10);

function redactMongoUri(uri) {
  try {
    const u = new URL(uri);
    // Keep protocol/host/path for debugging; drop credentials + query.
    return `${u.protocol}//${u.hostname}${u.pathname || ''}`;
  } catch {
    return '<redacted>';
  }
}

async function bootstrap() {
  const mongoUri = process.env.MONGO_URI;

  if (mongoUri && mongoUri !== 'mongodb://localhost:27017/archspace') {
    // ── External MongoDB (Atlas etc.) ─────────────────────────────────────
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
      console.log(`✅ Connected to MongoDB at: ${redactMongoUri(mongoUri)}`);
    } catch (err) {
      console.error(`❌ Could not connect to MONGO_URI: ${err.message}`);
      console.log('💡 Falling back to in-memory MongoDB for this session...');
      await startMemoryMongo();
    }
  } else {
    // ── No valid external URI — start in-memory instantly ────────────────
    console.log('ℹ️  No external MONGO_URI — starting in-memory MongoDB (data resets on restart).');
    await startMemoryMongo();
  }

  app.listen(BOOT_PORT, '0.0.0.0', () => {
    console.log(`🚀 ARchSpace API running on http://0.0.0.0:${BOOT_PORT}`);
    console.log(`   Company Code for registration: ${APPROVED_COMPANY_CODE}`);
    console.log(`   To persist data, set MONGO_URI in .env to a MongoDB Atlas URL.`);
  });
}

async function startMemoryMongo() {
  // MongoMemoryServer is a devDependency — require it lazily
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const memServer = await MongoMemoryServer.create();
  const uri = memServer.getUri();
  await mongoose.connect(uri);
  console.log(`✅ In-memory MongoDB started at: ${uri}`);
}

if (process.env.VERCEL) {
  // Export the app for Vercel serverless
  module.exports = app;
} else {
  // Start server locally
  bootstrap().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
