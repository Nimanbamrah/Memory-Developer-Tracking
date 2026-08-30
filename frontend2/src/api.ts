const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type ApiError = { error?: string };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) throw new Error(data.error ?? 'The server could not complete that request.');
  return data;
}

export type MemoryInput = { title: string; problem: string; solution: string; tags: string[] };
export type Telemetry = { embeddingMs: number; dbMs: number; llmMs: number };
export type StoredMemory = { id: string; title: string; problem: string; solution: string; tags: string[]; createdAt: string };

export const memoryApi = {
  create: (memory: MemoryInput) => request<{ success: boolean; memoryId: string }>('/api/memories', {
    method: 'POST', body: JSON.stringify(memory),
  }),
  stats: () => request<{ totalMemories: number }>('/api/memories/stats'),
  history: (page: number) => request<{ memories: StoredMemory[]; hasMore: boolean }>(`/api/memories?page=${page}&limit=25`),
  chat: (message: string) => request<{ reply: string; contextMatchedCount: number; telemetry: Telemetry }>('/api/chat', {
    method: 'POST', body: JSON.stringify({ message }),
  }),
};
