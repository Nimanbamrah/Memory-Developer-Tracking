import { Request, Response, NextFunction } from 'express';
export interface PerformanceTracker {
    start: bigint;
    embeddingTime?: number;
    dbSearchTime?: number;
    llmTime?: number;
}
export declare function perfLogger(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=perfLogger.d.ts.map