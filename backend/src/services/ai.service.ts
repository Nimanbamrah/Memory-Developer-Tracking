import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new
   Error("CRITICAL FAILURE: GEMINI_API_KEY inside .env configuration.");
}

// Fixed explicit construction targeting
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
    });

    if (!response.embeddings || response.embeddings.length === 0 || !response.embeddings[0].values) {
      throw new Error('Vector engine failed to allocate target geometric float arrays.');
    }

    return response.embeddings[0].values;
  } catch (error: any) {
    console.error('Gemini Embedding Exception:', error.message || error);
    throw error;
  }
}  