# Sajha Karobar — Admin Panel

> साझा समाधान, सजिलो व्यापार — Retail business management made easy

## Project Structure

```
├── frontend/          # Static frontend (HTML, JS, PWA assets)
│   ├── index.html     # Landing / redirect page
│   ├── manifest.json  # PWA manifest
│   ├── service-worker.js
│   ├── assets/        # Images & JS modules
│   │   ├── images/
│   │   └── Js/        # Page-specific scripts
│   └── public/        # HTML pages
│
├── backend/           # Express API server
│   ├── server.js      # Entry point
│   ├── package.json
│   ├── .env           # Environment variables (NOT in git)
│   ├── .env.example   # Template for env vars
│   └── database/
│       ├── app.js     # Express app & route registration
│       ├── config/    # Supabase client config
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       └── utils/
│
├── Dockerfile         # Production container
├── Procfile           # Heroku / Render deploy
└── .gitignore
```

## Getting Started

### Prerequisites
- Node.js >= 18
- A [Supabase](https://supabase.com) project

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/sailesh-010/AdminPanel.git
cd AdminPanel

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Run in development
npm run dev
```

The app will be available at `http://localhost:5000`

### Production

```bash
# Option A: Node.js directly
cd backend && NODE_ENV=production node server.js

# Option B: Docker
docker build -t sajha-karobar .
docker run -p 5000:5000 --env-file backend/.env sajha-karobar
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `CORS_ORIGIN` | Yes (prod) | Comma-separated allowed origins |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |

## API Endpoints

All API routes are prefixed with `/api/`:

| Route | Description |
|---|---|
| `/api/auth/*` | Authentication (login, register, refresh) |
| `/api/tenants/*` | Tenant management |
| `/api/users/*` | User management |
| `/api/dashboard/*` | Dashboard data |
| `/api/products/*` | Product CRUD |
| `/api/categories/*` | Category listing |
| `/api/bills/*` | Bill management |
| `/api/sales/*` | Sales data |
| `/api/workers/*` | Worker management |
| `/api/health` | Health check |

## Deployment Platforms

### Render.com (Recommended)
1. Connect your GitHub repo
2. **Build Command**: `cd backend && npm install`
3. **Start Command**: `cd backend && node server.js`
4. Add environment variables in Render dashboard

### Railway
1. Connect GitHub repo
2. Set **Root Directory**: `/` (root)
3. **Start Command**: `cd backend && node server.js`
4. Add env vars in Railway dashboard

### Heroku
Uses `Procfile` automatically. Add env vars via `heroku config:set`.

## License

ISC
