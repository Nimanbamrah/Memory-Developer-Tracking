"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRateLimiter = void 0;
const requestsByClient = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
function pruneExpiredEntries(now) {
    if (requestsByClient.size < 10_000)
        return;
    for (const [clientId, entry] of requestsByClient) {
        if (entry.resetAt <= now)
            requestsByClient.delete(clientId);
    }
}
/**
 * Protects the embedding and LLM routes from bursts without adding a database
 * dependency. Limits are scoped per client IP and reset every minute.
 */
function aiRateLimiter(req, res, next) {
    const now = Date.now();
    pruneExpiredEntries(now);
    const clientId = req.ip ?? req.socket.remoteAddress ?? 'unknown-client';
    const existing = requestsByClient.get(clientId);
    const entry = !existing || existing.resetAt <= now
        ? { count: 0, resetAt: now + WINDOW_MS }
        : existing;
    entry.count += 1;
    requestsByClient.set(clientId, entry);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
    if (entry.count > MAX_REQUESTS) {
        res.setHeader('Retry-After', retryAfterSeconds);
        return res.status(429).json({
            error: `Rate limit reached. Try again in ${retryAfterSeconds} seconds.`,
        });
    }
    next();
}
exports.aiRateLimiter = aiRateLimiter;
//# sourceMappingURL=rateLimiter.js.map