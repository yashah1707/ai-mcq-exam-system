Local development setup (Docker removed)

This project previously used Docker. The repo has been updated to remove Docker artifacts.

Prerequisites (install locally):
- Node.js 18+ and npm
- MongoDB 6.x (run locally or use a managed MongoDB)
- Redis (optional; used for caching)
- Python 3.10+ for the AI microservice

Server (API)
1. Install dependencies

```bash
cd server
npm install
```

2. Create `.env` or set env vars (see `server/.env.example`)

3. Run server in development

```bash
npm run dev
```

Workers (analytics + email job processors)

```bash
npm run worker:analytics
npm run worker:email
```

Client (frontend)

```bash
cd client
npm install
npm run dev
# app served at http://localhost:5173 (Vite) or port shown by Vite
```

AI microservice (Python)

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
python app.py
```

Local services
- MongoDB: run `mongod` locally or use a hosted URI and set `MONGO_URI` in `server/.env`.
- Redis: optional; run `redis-server` locally or set `REDIS_URL`.

Environment variables
- See `server/.env.example` and `ai-service/.env.example` for required env vars.

Testing
- Server tests:

```bash
cd server
npm test
```

Notes
- CI/CD or production deployment will need to be updated to use service-specific start commands or containerization if desired.
