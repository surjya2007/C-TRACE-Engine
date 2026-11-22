import express from "express";
import cors from "cors";
import fs from "fs/promises";

import { compileC } from "./compiler.js";
import { executeProgram } from "./executor.js";

const app = express();
const PORT = 3000;

// ========================================
// CORS CONFIGURATION
// ========================================

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ]
}));

app.use(express.json({
    limit: "100kb"
}));

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {

    res.json({
        status: "online",
        application: "C-TRACE Backend",
        compiler: "GCC",
        message: "Backend is running successfully."
    });

});

// ========================================
// COMPILE AND EXECUTE
// ========================================

app.post("/api/run", async (req, res) => {

    const { code } = req.body;

    if (typeof code !== "string" || !code.trim()) {

        return res.status(400).json({
            success: false,
            error: "Please provide valid C code."
        });

    }

    let compilation;

    try {

        console.log("[C-TRACE] Received C program.");

        compilation = await compileC(code);

        console.log("[C-TRACE] Compilation successful.");

        const result = await executeProgram(
            compilation.executablePath,
            compilation.directory
        );

        console.log("[C-TRACE] Execution completed.");

        res.json({
            success: !result.timedOut && !result.outputExceeded,
            output: result.stdout,
            errors: result.stderr,
            exitCode: result.exitCode,
            executionTimeMs: result.executionTimeMs,
            warnings: compilation.warnings,
            timedOut: result.timedOut,
            outputExceeded: result.outputExceeded
        });

    } catch (error) {

        console.error("[C-TRACE ERROR]", error);

        res.json({
            success: false,
            error: error.message,
            details: error.details || ""
        });

    } finally {

        if (compilation?.directory) {

            await fs.rm(
                compilation.directory,
                {
                    recursive: true,
                    force: true
                }
            ).catch(console.error);

        }

    }

});

// ========================================
// UNKNOWN ROUTES
// ========================================

app.use((req, res) => {

    res.status(404).json({
        error: "API endpoint not found."
    });

});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, "127.0.0.1", () => {

    console.log("----------------------------------");
    console.log("       C-TRACE BACKEND");
    console.log("----------------------------------");
    console.log(`Server: http://127.0.0.1:${PORT}`);
    console.log("Compiler: GCC");
    console.log("Status: Running");
    console.log("----------------------------------");

});