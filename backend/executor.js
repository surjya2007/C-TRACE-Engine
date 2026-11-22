import { spawn } from "child_process";

const EXECUTION_TIMEOUT = 5000;
const MAX_OUTPUT = 64 * 1024;

export function executeProgram(executablePath, directory) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const process = spawn(executablePath, [], {
            cwd: directory,
            shell: false,
            windowsHide: true
        });

        let stdout = "";
        let stderr = "";
        let finished = false;
        let timedOut = false;
        let outputExceeded = false;

        const timer = setTimeout(() => {
            if (finished) return;

            timedOut = true;
            process.kill();
        }, EXECUTION_TIMEOUT);

        function collect(stream, destination) {
            stream.on("data", chunk => {
                if (finished) return;

                destination += chunk.toString();

                if (Buffer.byteLength(stdout + stderr) > MAX_OUTPUT) {
                    outputExceeded = true;
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
            if (finished) return;

            finished = true;
            clearTimeout(timer);

            resolve({
                stdout: getStdout(),
                stderr: getStderr(),
                exitCode: code,
                executionTimeMs: Date.now() - startTime,
                timedOut,
                outputExceeded
            });
        });
    });
}