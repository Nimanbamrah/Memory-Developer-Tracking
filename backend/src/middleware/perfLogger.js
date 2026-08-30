"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.perfLogger = void 0;
const express_1 = require("express");
function perfLogger(req, res, next) {
    // Initialize high-resolution tracker using process.hrtime.bigint()
    res.locals.perf = {
        start: process.hrtime.bigint()
    };
    // Intercept response finish event to print final telemetry diagnostics
    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const totalDurationMs = Number(end - res.locals.perf.start) / 1e6;
        if (req.path === '/api/chat') {
            console.log(`\n==============  COGNITIVE LATENCY REPORT ==============`);
            console.log(` Inbound Target:    ${req.method} ${req.path}`);
            console.log(` Embedding Vector:   ${res.locals.perf.embeddingTime?.toFixed(2) || '0.00'} ms`);
            console.log(` Vector DB Search:   ${res.locals.perf.dbSearchTime?.toFixed(2) || '0.00'} ms`);
            console.log(` Gemini LLM Render:  ${res.locals.perf.llmTime?.toFixed(2) || '0.00'} ms`);
            console.log(` Total Pipeline:     ${totalDurationMs.toFixed(2)} ms`);
            console.log(`=========================================================\n`);
        }
    });
    next();
}
exports.perfLogger = perfLogger;
//# sourceMappingURL=perfLogger.js.map