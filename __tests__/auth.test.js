const request = require('supertest');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const createAuthApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const APPROVED_COMPANY_CODE = 'ARCH2026';
  const users = {};
  const otps = {};

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (!/[A-Z]/.test(password)) return 'Password must contain uppercase';
    if (!/[a-z]/.test(password)) return 'Password must contain lowercase';
    if (!/\d/.test(password)) return 'Password must contain digit';
    if (!/[!@#$%^&*]/.test(password)) return 'Password must contain special char';
    return null;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const hashPassword = (password, salt) => {
    if (!salt) salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
    return salt + ':' + hash;
  };

  const verifyPassword = (password, hash) => {
    const parts = hash.split(':');
    const salt = parts[0];
    const storedHash = parts[1];
    const newHash = crypto.createHmac('sha256', salt).update(password).digest('hex');
    return newHash === storedHash;
  };

  app.post('/api/auth/register', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const userName = req.body.userName;
    const companyCode = req.body.companyCode;

    if (!email || !password || !userName || !companyCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    if (companyCode !== APPROVED_COMPANY_CODE) {
      return res.status(403).json({ error: 'Invalid company code' });
    }

    if (users[email]) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    users[email] = {
      email: email,
      password: hashPassword(password),
      userName: userName,
      createdAt: new Date()
    };

    return res.status(201).json({ success: true, message: 'User registered successfully' });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = users[email];
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.status(200).json({
      success: true,
      user: { email: user.email, userName: user.userName }
    });
  });

  app.post('/api/auth/send-otp', (req, res) => {
    const email = req.body.email;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps[email] = { code: otp, expires: Date.now() + 10 * 60 * 1000 };

    return res.status(200).json({ success: true, message: 'OTP sent' });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const email = req.body.email;
    const code = req.body.code;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    const otpData = otps[email];
    if (!otpData) {
      return res.status(400).json({ error: 'No OTP found' });
    }

    if (Date.now() > otpData.expires) {
      delete otps[email];
      return res.status(400).json({ error: 'OTP expired' });
    }

    if (otpData.code !== code) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    delete otps[email];
    return res.status(200).json({ success: true, message: 'OTP verified' });
  });

  return app;
};

describe('Auth Endpoints', () => {
  let app;

  beforeAll(() => {
    app = createAuthApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid credentials', (done) => {
      request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test@Pass123',
          userName: 'TestUser',
          companyCode: 'ARCH2026'
        })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });

    it('should reject weak password', (done) => {
      request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: 'weak',
          userName: 'WeakUser',
          companyCode: 'ARCH2026'
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.error).toContain('Password must be at least');
          done();
        });
    });

    it('should reject invalid company code', (done) => {
      request(app)
        .post('/api/auth/register')
        .send({
          email: 'test2@example.com',
          password: 'Valid@Pass123',
          userName: 'User2',
          companyCode: 'INVALID'
        })
        .expect(403)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.error).toBe('Invalid company code');
          done();
        });
    });

    it('should reject duplicate email', (done) => {
      request(app)
        .post('/api/auth/register')
        .send({
          email: 'dup@example.com',
          password: 'Valid@Pass123',
          userName: 'User1',
          companyCode: 'ARCH2026'
        })
        .end(() => {
          request(app)
            .post('/api/auth/register')
            .send({
              email: 'dup@example.com',
              password: 'Different@Pass123',
              userName: 'User2',
              companyCode: 'ARCH2026'
            })
            .expect(409)
            .end((err, res) => {
              if (err) return done(err);
              expect(res.body.error).toBe('Email already registered');
              done();
            });
        });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach((done) => {
      request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'Login@Pass123',
          userName: 'LoginUser',
          companyCode: 'ARCH2026'
        })
        .end(done);
    });

    it('should login with correct credentials', (done) => {
      request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Login@Pass123'
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.user.email).toBe('login@example.com');
          done();
        });
    });

    it('should reject incorrect password', (done) => {
      request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Wrong@Pass123'
        })
        .expect(401)
        .end(done);
    });
  });

  describe('POST /api/auth/send-otp', () => {
    it('should send OTP successfully', (done) => {
      request(app)
        .post('/api/auth/send-otp')
        .send({
          email: 'otp@example.com'
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });

    it('should reject invalid email', (done) => {
      request(app)
        .post('/api/auth/send-otp')
        .send({
          email: 'invalidemail'
        })
        .expect(400)
        .end(done);
    });
  });
});
