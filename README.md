# Lost and Found QCU SBCS2A

Starter monorepo scaffold for the Lost and Found thesis project.

## Project structure

- `frontend` - React + TypeScript + Vite app (placeholder pages)
- `backend` - Node.js + TypeScript + Express + Prisma app
- `docs` - architecture/API/testing templates

## Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
4. Start PostgreSQL with Docker Compose:
   ```bash
   docker compose up -d
   ```
5. Run Prisma migration:
   ```bash
   npm run prisma:migrate --workspace backend
   ```
6. Seed initial data:
   ```bash
   npm run prisma:seed --workspace backend
   ```
7. Run apps in separate terminals:
   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```
