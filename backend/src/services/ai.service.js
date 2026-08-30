"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = void 0;
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.GEMINI_API_KEY) {
    throw new Error("CRITICAL FAILURE: GEMINI_API_KEY inside .env configuration.");
}
// Fixed explicit construction targeting
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function generateEmbedding(text) {
    try {
        const response = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: text,
        });
        // if (!response.embeddings || response.embeddings.length === 0 || !response.embeddings[0].values) {
        //   throw new Error('Vector engine failed to allocate target geometric float arrays.');
        // }
        // return response.embeddings[0].values;
        const embedding = response.embeddings?.[0]?.values;
        if (!embedding) {
            throw new Error("No embedding returned from Gemini");
        }
        return embedding;
    }
    catch (error) {
        console.error('Gemini Embedding Exception:', error.message || error);
        throw error;
    }
}
exports.generateEmbedding = generateEmbedding;
//# sourceMappingURL=ai.service.js.map