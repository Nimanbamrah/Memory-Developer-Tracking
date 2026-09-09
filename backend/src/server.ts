import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from './services/ai.service';
import { GoogleGenAI } from '@google/genai';
import { perfLogger } from './middleware/perfLogger';
import { aiRateLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

if (!process.env.GEMINI_API_KEY) {
  throw new Error("CRITICAL CONFIGURATION ERROR: GEMINI_API_KEY environment variable is undefined.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json());
app.use(perfLogger); // Global integration of our telemetry engine layer

app.use((req,res,next)=>{
    console.log(req.method, req.url);
    next();
});

// Reuse Phase 1 Ingestion for context generation
app.post('/api/memories', aiRateLimiter, async (req: Request, res: Response) => {
  const { title, problem, solution, tags } = req.body;
  if (!title || !problem || !solution) return res.status(400).json({ error: "Fields missing." });
  try {

    console.log(req.body);

    const contextText = `Title: ${title}\nProblem: ${problem}\nSolution: ${solution}`;
//////////////////////////////////////////////////////////////////////////////////
    const vectorCoordinates = await generateEmbedding(contextText);

    const databaseVectorString = `[${vectorCoordinates.join(',')}]`;
////////////////////////////////////////////////////////////////////////////////////
    const savedRecord = await prisma.$transaction(async (tx:any) => {
      const memory = await tx.memory.create({
        data: { title, problem, solution, tags: Array.isArray(tags) ? tags : [] },
      });
      await tx.$executeRawUnsafe(`UPDATE "Memory" SET "embedding" = $1::vector WHERE "id" = $2`, databaseVectorString, memory.id);
      return memory;
    });
    return res.status(201).json({ success: true, memoryId: savedRecord.id });
  } catch (error: any) {
     console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 *  RAG Endpoint with Integrated Sub-Millisecond Diagnostics
 */
app.post('/api/chat', aiRateLimiter, async (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message query is mandatory." });

  try {
    // EMBEDDING PHASE: Convert query prompt into 768 float array
    const embedStart = process.hrtime.bigint();
    const queryVector = await generateEmbedding(message);
    const vectorString = `[${queryVector.join(',')}]`;
    res.locals.perf.embeddingTime = Number(process.hrtime.bigint() - embedStart) / 1e6;

    // VECTOR DB RETRIEVAL PHASE: Cosine similarity vector search
    const dbStart = process.hrtime.bigint();
    const matchingContexts: any[] = await prisma.$queryRawUnsafe(`
      SELECT title, problem, solution, tags,
             (embedding <=> $1::vector) as distance
      FROM "Memory"
      WHERE embedding IS NOT NULL AND (embedding <=> $1::vector) <= 0.5
      ORDER BY embedding <=> $1::vector
      LIMIT 3;
    `, vectorString);
    res.locals.perf.dbSearchTime = Number(process.hrtime.bigint() - dbStart) / 1e6;

    // 3. SYNTHESIS PHASE: Compile matches into systemic truth layers
    let semanticContextPayload = "No matching developer memories were located within the database index thresholds.";
    if (matchingContexts.length > 0) {
      semanticContextPayload = matchingContexts.map((node, i) => 
        `[MEMORY NODE #${i + 1}]\nTITLE: ${node.title}\nPROBLEM: ${node.problem}\nSOLUTION: ${node.solution}\nTAGS: ${node.tags.join(', ')}\n`
      ).join('\n---\n');
    }

    // GENERATION PHASE: Execute contextual instruction targeting gemini-2.5-flash
    const llmStart = process.hrtime.bigint();
    const operationalSystemInstruction = `
      You are the core intelligence engineer engine of MEM_OS, a developer's real-time second brain.
      Analyze the user prompt utilizing exclusively the verified structural memory logs injected below.
      If the historical memories provide an accurate engineering fix, deliver a concise solution overview.
      If no memories apply, explicitly notify the operator you lack contextual metrics to formulate a reply.
      
      [VERIFIED HISTORICAL CONTEXT LOGS]
      ${semanticContextPayload}
    `;

    const modelResponse = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message,
      config: {
        systemInstruction: operationalSystemInstruction,
        temperature: 0.2 // Low temperature restricts hallucinations and enforces context relince
      }
    });
    res.locals.perf.llmTime = Number(process.hrtime.bigint() - llmStart) / 1e6;

    return res.json({
      reply: modelResponse.text,
      contextMatchedCount: matchingContexts.length,
      telemetry: {
        embeddingMs: res.locals.perf.embeddingTime,
        dbMs: res.locals.perf.dbSearchTime,
        llmMs: res.locals.perf.llmTime
      }
    });

  } catch (error: any) {
    console.error("RAG Processing Pipeline Error:", error);
    return res.status(500).json({ error: error?.message || "Cognitive generation sub-module failure." });
  }
});

app.get('/api/memories/stats', async (req, res) => {
  const count = await prisma.memory.count();
  res.json({ totalMemories: count });
});

// Lightweight history feed: deliberately excludes the vector embedding column.
app.get('/api/memories', async (req, res) => {
  const requestedPage = Number.parseInt(String(req.query.page ?? '1'), 10);
  const requestedLimit = Number.parseInt(String(req.query.limit ?? '25'), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;

  try {
    const memories = await prisma.memory.findMany({
      select: { id: true, title: true, problem: true, solution: true, tags: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    const hasMore = memories.length > limit;
    res.json({ memories: hasMore ? memories.slice(0, limit) : memories, hasMore });
  } catch (error) {
    console.error('Memory history retrieval error:', error);
    res.status(500).json({ error: 'Unable to retrieve memory history.' });
  }
});

app.listen(PORT, () => console.log(`MEM_OS Phase 2 Active on Port ${PORT}`));
