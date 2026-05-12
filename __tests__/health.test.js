const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Setup basic Express app for testing
const createApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check endpoints
  app.get('/', (req, res) => {
    res.status(200).send('<h1>ARchSpace Backend is Running!</h1><p>API is active.</p>');
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });

  return app;
};

describe('Health Check Endpoints', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /', () => {
    it('should return HTML welcome message', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('ARchSpace Backend is Running!');
    });

    it('should have correct content type', async () => {
      const response = await request(app).get('/');
      expect(response.type).toContain('text/html');
    });
  });

  describe('GET /health', () => {
    it('should return health status JSON', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok');
      expect(response.body.ok).toBe(true);
    });

    it('should include database connection status', async () => {
      const response = await request(app).get('/health');
      expect(response.body).toHaveProperty('db');
      expect(['connected', 'disconnected']).toContain(response.body.db);
    });
  });
});
