import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './database/app.js';

// ─── Config ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// ─── Security & Parsing Middleware ───────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5000', 'http://localhost:3000'];

app.use(cors({
  origin: NODE_ENV === 'production' ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ─── Health Check ────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: NODE_ENV, timestamp: new Date().toISOString() });
});

// ─── Serve Frontend Static Files ─────────────────────
// Service worker (must be served from root with correct headers)
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(FRONTEND_DIR, 'service-worker.js'));
});

// Static assets with caching
app.use('/assets', express.static(path.join(FRONTEND_DIR, 'assets'), {
  maxAge: NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
}));
app.use(express.static(FRONTEND_DIR, {
  maxAge: NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  index: false,  // We handle routes explicitly
}));

// ─── Page Routes ─────────────────────────────────────
const pageRoutes = {
  '/':                'index.html',
  '/signup':          'public/signup.html',
  '/login':           'public/login.html',
  '/reset-password':  'public/reset-password.html',
  '/dashboard':       'public/dashboard.html',
  '/product':         'public/product.html',
  '/add-product':     'public/add-product.html',
  '/sale':            'public/sale.html',
  '/add-bill':        'public/add-bill.html',
  '/bill':            'public/add-bill.html',
  '/bills':           'public/bills.html',
  '/stock':           'public/stock.html',
  '/workers':         'public/workers.html',
  '/revenue':         'public/revenue.html',
};

for (const [route, file] of Object.entries(pageRoutes)) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, file));
  });
}

// ─── Start Server ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Server running on port http://localhost:${PORT} [${NODE_ENV}]`);
});