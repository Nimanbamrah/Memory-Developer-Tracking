"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const ai_service_1 = require("./services/ai.service");
const genai_1 = require("@google/genai");
const perfLogger_1 = require("./middleware/perfLogger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 4000;
if (!process.env.GEMINI_API_KEY) {
    throw new Error("CRITICAL CONFIGURATION ERROR: GEMINI_API_KEY environment variable is undefined.");
}
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(perfLogger_1.perfLogger); // Global integration of our telemetry engine layer
app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});
// Reuse Phase 1 Ingestion for context generation
app.post('/api/memories', async (req, res) => {
    const { title, problem, solution, tags } = req.body;
    if (!title || !problem || !solution)
        return res.status(400).json({ error: "Fields missing." });
    try {
        console.log(req.body);
        const contextText = `Title: ${title}\nProblem: ${problem}\nSolution: ${solution}`;
        //////////////////////////////////////////////////////////////////////////////////
        const vectorCoordinates = await (0, ai_service_1.generateEmbedding)(contextText);
        const databaseVectorString = `[${vectorCoordinates.join(',')}]`;
        ////////////////////////////////////////////////////////////////////////////////////
        const savedRecord = await prisma.$transaction(async (tx) => {
            const memory = await tx.memory.create({
                data: { title, problem, solution, tags: Array.isArray(tags) ? tags : [] },
            });
            await tx.$executeRawUnsafe(`UPDATE "Memory" SET "embedding" = $1::vector WHERE "id" = $2`, databaseVectorString, memory.id);
            return memory;
        });
        return res.status(201).json({ success: true, memoryId: savedRecord.id });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});
/**
 * ⚡ NEW: Conversational RAG Endpoint with Integrated Sub-Millisecond Diagnostics
 */
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message)
        return res.status(400).json({ error: "Message query is mandatory." });
    try {
        // 1. EMBEDDING PHASE: Convert query prompt into 768 float array
        const embedStart = process.hrtime.bigint();
        const queryVector = await (0, ai_service_1.generateEmbedding)(message);
        const vectorString = `[${queryVector.join(',')}]`;
        res.locals.perf.embeddingTime = Number(process.hrtime.bigint() - embedStart) / 1e6;
        // 2. VECTOR DB RETRIEVAL PHASE: Cosine similarity vector search
        const dbStart = process.hrtime.bigint();
        const matchingContexts = await prisma.$queryRawUnsafe(`
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
            semanticContextPayload = matchingContexts.map((node, i) => `[MEMORY NODE #${i + 1}]\nTITLE: ${node.title}\nPROBLEM: ${node.problem}\nSOLUTION: ${node.solution}\nTAGS: ${node.tags.join(', ')}\n`).join('\n---\n');
        }
        // 4. GENERATION PHASE: Execute contextual instruction targeting gemini-2.5-flash
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
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
                systemInstruction: operationalSystemInstruction,
                temperature: 0.2 // Low temperature restricts hallucinations and enforces context reliance
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
    }
    catch (error) {
        console.error("RAG Processing Pipeline Error:", error);
        return res.status(500).json({ error: "Cognitive generation sub-module failure." });
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
    }
    catch (error) {
        console.error('Memory history retrieval error:', error);
        res.status(500).json({ error: 'Unable to retrieve memory history.' });
    }
});
app.listen(PORT, () => console.log(`MEM_OS Phase 2 Active on Port ${PORT}`));
//# sourceMappingURL=server.js.map