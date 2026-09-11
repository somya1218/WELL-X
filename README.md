# WELL X

WELL X is a drilling-risk decision-support prototype. It combines historical well incidents, semantic embeddings, geographic distance, and drilling depth to produce explainable risk alerts.

## Run locally

1. Configure `backend/.env` using `backend/.env.example`. These `KEY=value` lines belong in the `.env` file, not directly in PowerShell:

```text
DATABASE_URL=your_real_supabase_connection_string
OPENAI_API_KEY=your_real_openai_key
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

Open the file with PowerShell using `notepad backend\.env`, and replace the placeholder values. Never share the real password or API key in chat or commit the file.

2. Configure `frontend/.env` using `frontend/.env.example`.
3. Install backend packages from the project root with `.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt`.
4. Seed PostgreSQL from the project root with `.\.venv\Scripts\python.exe backend\seed_data.py`.
5. Start the API from `backend`: `..\.venv\Scripts\python.exe -m uvicorn main:app --reload`.
6. Start the frontend from `frontend` with `npm run dev`.

The API documentation is available at `http://127.0.0.1:8000/docs` and the frontend at `http://127.0.0.1:5173`.

The frontend has mock fallback data for demos. The API also falls back to `data/wells_data.json` when PostgreSQL is unavailable, using geographic and depth ranking. Configured PostgreSQL and OpenAI embeddings provide the full production-like search path.

## Recommended deployment

Use Vercel for `frontend`, Railway for `backend`, and Supabase for PostgreSQL with pgvector enabled. Postman is for testing the deployed API; it is not a hosting platform.

### Supabase

1. Create a project.
2. Enable the `vector` extension.
3. Copy the PostgreSQL connection string into Railway as `DATABASE_URL`.

### Railway backend

1. Create a service from this repository.
2. Keep the repository root as the build context.
3. Set the Dockerfile path to `backend/Dockerfile`.
4. Add these variables in the Railway Variables dashboard. Do not paste these lines into a PowerShell terminal:

```text
DATABASE_URL=your_supabase_postgres_url
OPENAI_API_KEY=your_openai_key
CORS_ORIGINS=https://your-frontend.vercel.app
```

5. Deploy the service and copy its public URL.
6. Run the seed command once in the Railway shell:

```text
python seed_data.py
```

### Vercel frontend

1. Import the repository as a Vercel project.
2. Set the root directory to `frontend`.
3. Add this environment variable:

```text
VITE_API_BASE=https://your-backend.up.railway.app
```

4. Deploy and copy the Vercel URL.
5. Replace `CORS_ORIGINS` in Railway with the final Vercel URL, then redeploy the backend.

### Postman

Import `postman/WELL_X.postman_collection.json`. Change the `baseUrl` variable from the local URL to the deployed Railway backend URL, then run `Health`, `Search incidents`, and `Check risk`.
