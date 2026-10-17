# Developer Memory OS

**An AI-powered developer knowledge assistant that helps developers retrieve previously solved problems using natural-language queries.**

Developer Memory OS stores technical problems and their solutions as searchable memories. When a developer asks a question, the backend creates an embedding for the query, searches for semantically similar memories in PostgreSQL using `pgvector`, and passes the retrieved context to Gemini to generate a contextual response.

> **Project status:** Working prototype / MVP. The current implementation supports manual memory creation, vector-based retrieval, RAG chat, and a memory-count metric. Authentication, automated activity capture, and production hardening are future improvements.

## Table of Contents

- [Problem](#problem)
- [Solution](#solution)
- [Features](#features)
- [Architecture](#architecture)
- [RAG Workflow](#rag-workflow)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Testing the API](#testing-the-api)
- [Current Limitations](#current-limitations)
- [Future Improvements](#future-improvements)
- [Security Notes](#security-notes)

## Problem

Developers often solve the same errors and implementation problems more than once. Useful fixes can be scattered across notes, terminal history, documentation, and old projects, making them difficult to find later.

## Solution

Developer Memory OS provides a central place to record a problem, its solution, and relevant tags. It uses semantic search rather than relying only on exact keyword matches, allowing a developer to ask questions in natural language and retrieve related saved memories.

## Features

- **Manual memory capture:** Save a title, problem description, solution, and comma-separated tags.
- **Embedding generation:** Convert the memory's title, problem, and solution into a vector using Gemini's embedding API.
- **Vector storage:** Store memory embeddings in PostgreSQL with `pgvector`.
- **Semantic retrieval:** Embed a question and retrieve up to three relevant memories using cosine distance.
- **RAG chat:** Provide retrieved memory context to Gemini 2.5 Flash to generate a contextual answer.
- **Performance telemetry:** Return the measured embedding, database-search, and LLM-generation durations for chat requests.
- **Dashboard metric:** Display the total number of saved memories.

## Architecture

```text
React + Vite Frontend
        |
        | HTTP / JSON
        v
Express + TypeScript API
        |
        +------------------------------+
        |                              |
        v                              v
PostgreSQL + pgvector             Gemini API
        |                              |
        |                      Embeddings + LLM
        |                              |
        +--------- RAG workflow -------+
```

The frontend communicates with the Express API. Prisma is used for database operations, while a raw parameterized vector query performs similarity retrieval. Gemini provides embedding generation and response generation.

## RAG Workflow

### 1. Save a memory

1. The user submits a title, problem, solution, and tags.
2. The backend validates the required fields.
3. The backend creates an embedding from the title, problem, and solution.
4. The memory is inserted into PostgreSQL.
5. The embedding is written to the memory's `embedding` column using the PostgreSQL vector type.
6. The API returns the created memory ID.

### 2. Ask a question

1. The user submits a natural-language question.
2. The backend generates an embedding for the question.
3. PostgreSQL calculates cosine distance between the query vector and stored memory vectors.
4. The query filters out records without embeddings and applies a distance threshold of `0.5`, then selects up to three closest memories.
5. The backend builds a context from the retrieved titles, problems, solutions, and tags.
6. Gemini 2.5 Flash generates a response using the supplied context and a system instruction that asks it to acknowledge when no relevant memories are available.
7. The API returns the response, number of matched memories, and timing telemetry.

**Important:** Semantic retrieval quality depends on the embedding model, vector dimensions, distance threshold, and stored data. The current threshold is a prototype setting, not a validated accuracy guarantee.

## Tech Stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend | React, TypeScript, Vite | User interface |
| Styling | Tailwind CSS v4 | Utility-first styling |
| Backend | Node.js, Express, TypeScript | REST API and application logic |
| ORM | Prisma | Database access and schema migrations |
| Database | PostgreSQL | Persistent memory storage |
| Vector search | pgvector | Store embeddings and perform similarity search |
| AI embeddings | Gemini `gemini-embedding-001` | Convert memory text and queries into vectors |
| Answer generation | Gemini `gemini-2.5-flash` | Generate responses grounded in retrieved memories |
| Local database | Docker | Run PostgreSQL with pgvector |

## Project Structure

```text
Memory-Developer-Tracking/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── middleware/
│   │   │   └── perfLogger.ts
│   │   ├── services/
│   │   │   └── ai.service.ts
│   │   └── server.ts
│   ├── .env                  # Create locally; do not commit
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── views/
    │   │   ├── ChatView.tsx
    │   │   ├── CreateMemoryView.tsx
    │   │   └── DashboardView.tsx
    │   ├── App.tsx
    │   ├── App.css
    │   ├── index.css
    │   └── main.tsx
    ├── .env                  # Optional, if using a configurable API URL
    └── package.json
```

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/memories` | Create a memory and store its embedding |
| `POST` | `/api/chat` | Retrieve related memories and generate an answer |
| `GET` | `/api/memories/stats` | Return the total number of memories |

### Create a memory

**Request**

```http
POST /api/memories
Content-Type: application/json
```

```json
{
  "title": "CORS credentials issue in Express",
  "problem": "The browser blocked a cross-origin request when credentials were included.",
  "solution": "Configure the server to allow the specific frontend origin and credentials.",
  "tags": ["express", "cors", "security"]
}
```

**Successful response**

```json
{
  "success": true,
  "memoryId": "generated-memory-id"
}
```

The actual ID format depends on the Prisma schema.

### Ask a question

**Request**

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "message": "How did I resolve my CORS credentials issue?"
}
```

**Response shape**

```json
{
  "reply": "A contextual answer generated from retrieved memories.",
  "contextMatchedCount": 1,
  "telemetry": {
    "embeddingMs": 12.3,
    "dbMs": 4.5,
    "llmMs": 650.2
  }
}
```

The values above are illustrative; actual timings and match counts vary.

### Get memory statistics

```http
GET /api/memories/stats
```

Example response:

```json
{
  "totalMemories": 1
}
```

## Prerequisites

Install the following before running the project:

- Node.js and npm
- Docker Desktop
- A Gemini API key
- Git (optional, for cloning the repository)

## Local Setup

### 1. Clone the repository

```bash
git clone <YOUR_PUBLIC_GITHUB_REPOSITORY_URL>
cd Memory-Developer-Tracking
```

Replace the placeholder with your actual repository URL.

### 2. Start PostgreSQL with pgvector

If you already have a Docker container named `developer-memory-db`, start it:

```bash
docker start developer-memory-db
```

Otherwise, create a new container:

```bash
docker run --name developer-memory-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=YOUR_LOCAL_DB_PASSWORD \
  -e POSTGRES_DB=developer_memory \
  -p 5432:5432 \
  -d pgvector/pgvector:pg17
```

The PostgreSQL database should be available on port `5432`. If that port is already in use, choose another host port and update the database URL accordingly.

### 3. Configure the backend environment

Create `backend/.env`:

```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL="postgresql://postgres:YOUR_LOCAL_DB_PASSWORD@127.0.0.1:5432/developer_memory?schema=public"
```

Use the same password configured for the database container. Do not commit `.env` files or expose API keys in frontend code.

### 4. Install backend dependencies and prepare Prisma

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
```

These commands assume the repository includes a compatible Prisma schema and migration history. If the project uses a different Prisma version or configuration, follow the configuration for that version rather than blindly upgrading packages.

Ensure the PostgreSQL `vector` extension is enabled by the project's migration or database setup. The database image includes pgvector, but the extension must still be enabled in the target database, for example:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Start the backend using the script defined in `backend/package.json`, for example:

```bash
npm run dev
```

The API is expected to listen on `http://localhost:4000`.

### 5. Install and start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

The current frontend view code uses `http://localhost:4000` as its API base URL. If you change the backend host or port, update the frontend requests accordingly.

## Testing the API

You can use Postman, another API client, or `curl`.

### Check the backend

```bash
curl http://localhost:4000/api/memories/stats
```

### Create a memory

```bash
curl -X POST http://localhost:4000/api/memories \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"CORS issue\",\"problem\":\"Cross-origin request failed\",\"solution\":\"Configure the allowed origin and credentials\",\"tags\":[\"express\",\"cors\"]}"
```

### Ask a question

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"How did I resolve my CORS issue?\"}"
```

On Windows PowerShell, `curl` may be an alias for `Invoke-WebRequest`; use `curl.exe` or Postman's interface if shell quoting becomes inconvenient.

## Current Limitations

This is a prototype and should not be described as production-hardened yet.

- Memories are entered manually; automatic capture from an IDE, terminal, GitHub, or browser is not implemented.
- Authentication and per-user access control are not implemented.
- Retrieval is limited to three memories and uses a fixed distance threshold that has not been calibrated against a benchmark.
- The application returns timing telemetry, but it does not yet measure answer correctness, retrieval precision/recall, or end-to-end latency across a representative test set.
- The chat pipeline does not stream responses.
- API validation, rate limiting, structured error handling, automated tests, and production security controls need further work.
- The frontend's localhost API URL must be configured for a deployed environment.

## Future Improvements

- Add authentication and authorization.
- Configure the API base URL through environment variables.
- Add automated unit and integration tests.
- Build an evaluation dataset to measure retrieval quality and answer faithfulness.
- Tune the similarity threshold and compare retrieval strategies.
- Add memory editing, deletion, filtering, and pagination.
- Add related-memory links and a chronological timeline.
- Integrate with GitHub or a VS Code extension for opt-in memory capture.
- Add rate limiting, request validation, monitoring, and deployment automation.

## Security Notes

- Keep `GEMINI_API_KEY` exclusively on the backend.
- Never commit `.env`, database credentials, or API keys.
- Rotate any key that has been accidentally exposed.
- Do not expose a development database directly to the public internet.
- Before public deployment, add authentication, authorization, request validation, rate limiting, and appropriate CORS restrictions.
- The current open API endpoints are suitable only for local development or a controlled demonstration, not an unrestricted public deployment.



*Developer Memory OS explores how vector search and retrieval-augmented generation can turn saved engineering experiences into a searchable personal knowledge base.*
