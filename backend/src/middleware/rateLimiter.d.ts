import { NextFunction, Request, Response } from 'express';
/**
 * Protects the embedding and LLM routes from bursts without adding a database
 * dependency. Limits are scoped per client IP and reset every minute.
 */
export declare function aiRateLimiter(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=rateLimiter.d.ts.map