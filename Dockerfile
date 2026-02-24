FROM node:20-alpine

WORKDIR /app

# Copy backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend/ ./backend/

# Copy frontend
COPY frontend/ ./frontend/

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
