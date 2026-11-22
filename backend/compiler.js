import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const COMPILE_TIMEOUT = 15000;
const MAX_OUTPUT = 64 * 1024;

function runProcess(command, args, cwd, timeout) {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, {
            cwd,
            shell: false,
            windowsHide: true
        });

        let stdout = "";
        let stderr = "";
        let finished = false;
        let outputExceeded = false;

        const timer = setTimeout(() => {
            if (!finished) {
                finished = true;
                process.kill();
                reject(new Error("Compilation timed out."));
            }
        }, timeout);

        function collect(stream, destination) {
            stream.on("data", chunk => {
                if (finished) return;

                destination = destination + chunk.toString();

                if (Buffer.byteLength(stdout + stderr) > MAX_OUTPUT) {
                    outputExceeded = true;
                    finished = true;
                    clearTimeout(timer);
                    process.kill();
                }
            });

            return () => destination;
        }

        const getStdout = collect(process.stdout, stdout);
        const getStderr = collect(process.stderr, stderr);

        process.on("error", error => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            reject(error);
        });

        process.on("close", code => {
            if (finished && !outputExceeded) return;

            finished = true;
            clearTimeout(timer);

            if (outputExceeded) {
                reject(new Error("Compiler output exceeded the allowed limit."));
                return;
            }

            resolve({
                stdout: getStdout(),
                stderr: getStderr(),
                exitCode: code
            });
        });
    });
}

export async function compileC(code) {
    const directory = await fs.mkdtemp(
        path.join(os.tmpdir(), "ctrace-")
    );

    const sourcePath = path.join(directory, "main.c");

    const executablePath = path.join(
        directory,
        process.platform === "win32" ? "program.exe" : "program"
    );

    try {
        await fs.writeFile(sourcePath, code, "utf8");

        const result = await runProcess(
            "gcc",
            [
                "-std=c11",
                "-Wall",
                "-Wextra",
                "-O0",
                "-g",
                "main.c",
                "-o",
                executablePath
            ],
            directory,
            COMPILE_TIMEOUT
        );

        if (result.exitCode !== 0) {
            const error = new Error("Compilation failed.");
            error.details = result.stderr || result.stdout;
            throw error;
        }

        return {
            directory,
            executablePath,
            warnings: result.stderr
        };

    } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
    }
}