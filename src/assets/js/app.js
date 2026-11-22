// ========================================
// C-TRACE
// APPLICATION CONTROLLER
// ========================================

import { cEditor, sampleCode } from "./editor.js";

import {
    createExecutionTrace
} from "./execution.js";

import {
    renderExecutionStep,
    resetVisualizer
} from "./visualizer.js";

// ========================================
// DOM ELEMENTS
// ========================================

const clearButton = document.getElementById("clearButton");
const resetButton = document.getElementById("resetButton");
const clearOutput = document.getElementById("clearOutput");

const formatButton = document.getElementById("formatButton");
const themeButton = document.getElementById("themeButton");
const shareButton = document.getElementById("shareButton");

const runButton = document.getElementById("runButton");

const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const autoButton = document.getElementById("autoButton");

const terminalContent = document.getElementById("terminalContent");

// ========================================
// APPLICATION STATE
// ========================================

const API_URL = "http://127.0.0.1:3000/api";

let executionSteps = [];
let currentIndex = -1;
let isRunning = false;
let autoPlayTimer = null;

// ========================================
// TERMINAL
// ========================================

function showTerminalMessage(message, type = "info") {

    if (!terminalContent) return;

    const paragraph = document.createElement("p");

    paragraph.className = "terminal-welcome";

    paragraph.style.color =
        type === "error"
            ? "#ff6b81"
            : type === "success"
                ? "#6ee7b7"
                : "#cbd5e1";

    paragraph.textContent = `➜ ${message}`;

    terminalContent.replaceChildren(paragraph);
}

// ========================================
// APPEND TERMINAL STATUS
// ========================================

function appendTerminalMessage(message, type = "info") {

    if (!terminalContent) return;

    const paragraph = document.createElement("p");

    paragraph.className = "terminal-welcome";

    paragraph.style.color =
        type === "error"
            ? "#ff6b81"
            : type === "success"
                ? "#6ee7b7"
                : "#cbd5e1";

    paragraph.style.marginTop = "12px";

    paragraph.textContent = `➜ ${message}`;

    terminalContent.appendChild(paragraph);
}

// ========================================
// DISPLAY PROGRAM OUTPUT
// ========================================

function showProgramOutput(output, errors = "") {

    if (!terminalContent) return;

    const container = document.createElement("div");

    const heading = document.createElement("p");

    heading.textContent = "➜ Program Output";
    heading.style.color = "#a78bfa";
    heading.style.fontWeight = "bold";

    const outputElement = document.createElement("pre");

    outputElement.textContent = output || "(No output)";
    outputElement.style.whiteSpace = "pre-wrap";
    outputElement.style.color = "#6ee7b7";
    outputElement.style.fontFamily = "monospace";

    container.append(heading, outputElement);

    // Compiler warnings / messages

    if (errors) {

        const errorHeading = document.createElement("p");

        errorHeading.textContent = "➜ Compiler Messages";
        errorHeading.style.color = "#fbbf24";

        const errorElement = document.createElement("pre");

        errorElement.textContent = errors;
        errorElement.style.whiteSpace = "pre-wrap";
        errorElement.style.color = "#fbbf24";

        container.append(errorHeading, errorElement);
    }

    terminalContent.replaceChildren(container);
}

// ========================================
// BUTTON STATES
// ========================================

function updateControls() {

    if (previousButton) {
        previousButton.disabled = currentIndex <= 0;
    }

    if (nextButton) {
        nextButton.disabled =
            executionSteps.length === 0 ||
            currentIndex >= executionSteps.length - 1;
    }

    if (autoButton) {

        autoButton.disabled = executionSteps.length === 0;

        autoButton.textContent = autoPlayTimer
            ? "⏸ Pause"
            : "▶ Auto Play";
    }
}

// ========================================
// STOP AUTO PLAY
// ========================================

function stopAutoPlay() {

    if (autoPlayTimer) {

        clearInterval(autoPlayTimer);

        autoPlayTimer = null;
    }

    updateControls();
}

// ========================================
// DISPLAY EXECUTION STEP
// ========================================

function displayStep(index) {

    if (
        index < 0 ||
        index >= executionSteps.length
    ) {
        return;
    }

    currentIndex = index;

    renderExecutionStep(
        executionSteps,
        currentIndex,
        cEditor,
        selectedIndex => {

            stopAutoPlay();

            displayStep(selectedIndex);
        }
    );

    updateControls();
}

// ========================================
// NEXT STEP
// ========================================

function nextStep() {

    if (currentIndex < executionSteps.length - 1) {

        displayStep(currentIndex + 1);

    } else {

        stopAutoPlay();
    }
}

// ========================================
// PREVIOUS STEP
// ========================================

function previousStep() {

    if (currentIndex > 0) {

        displayStep(currentIndex - 1);
    }
}

// ========================================
// AUTO PLAY
// ========================================

function startAutoPlay() {

    if (executionSteps.length === 0) return;

    if (currentIndex >= executionSteps.length - 1) {

        displayStep(0);
    }

    if (autoPlayTimer) {

        stopAutoPlay();

        return;
    }

    autoPlayTimer = setInterval(() => {

        if (currentIndex >= executionSteps.length - 1) {

            stopAutoPlay();

            return;
        }

        nextStep();

    }, 1200);

    updateControls();
}

// ========================================
// RESET EXECUTION
// ========================================

function resetExecution() {

    stopAutoPlay();

    executionSteps = [];

    currentIndex = -1;

    resetVisualizer(cEditor);

    updateControls();
}

// ========================================
// COMPILE AND EXECUTE USING GCC
// ========================================

async function runProgram() {

    if (isRunning) return;

    const code = cEditor.getValue();

    if (!code.trim()) {

        showTerminalMessage(
            "Your C program is empty.",
            "error"
        );

        return;
    }

    stopAutoPlay();

    resetExecution();

    isRunning = true;

    const originalText = runButton.textContent;

    runButton.disabled = true;

    runButton.textContent = "⏳ Compiling...";

    showTerminalMessage(
        "Sending your C program to GCC..."
    );

    try {

        const response = await fetch(`${API_URL}/run`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ code })

        });

        const result = await response.json();

        // ========================================
        // COMPILATION ERROR
        // ========================================

        if (!response.ok || !result.success) {

            showTerminalMessage(
                result.details ||
                result.error ||
                "Compilation failed.",
                "error"
            );

            return;
        }

        // ========================================
        // DISPLAY ACTUAL GCC OUTPUT
        // ========================================

        showProgramOutput(
            result.output,
            result.warnings
        );

        // ========================================
        // BUILD LOCAL EXECUTION TRACE
        // ========================================

        try {

            executionSteps = createExecutionTrace(code);

            if (executionSteps.length > 0) {

                currentIndex = -1;

                displayStep(0);

                // IMPORTANT:
                // Append status instead of replacing
                // the actual program output.

                appendTerminalMessage(
                    "Compilation successful! Execution trace generated.",
                    "success"
                );

            } else {

                appendTerminalMessage(
                    "Program executed successfully, but no traceable statements were found.",
                    "success"
                );
            }

        } catch (traceError) {

            resetExecution();

            appendTerminalMessage(
                "GCC execution succeeded, but the visualizer cannot trace this syntax yet: " +
                traceError.message,
                "error"
            );
        }

    } catch (error) {

        showTerminalMessage(
            "Unable to connect to the C-TRACE backend. Make sure the backend server is running. " +
            error.message,
            "error"
        );

    } finally {

        isRunning = false;

        runButton.disabled = false;

        runButton.textContent = originalText;

        updateControls();
    }
}

// ========================================
// CLEAR EDITOR
// ========================================

clearButton?.addEventListener("click", () => {

    if (confirm("Clear the entire code editor?")) {

        cEditor.setValue("");

        resetExecution();

        cEditor.focus();

        showTerminalMessage("Editor cleared.");
    }
});

// ========================================
// RESET EDITOR
// ========================================

resetButton?.addEventListener("click", () => {

    if (confirm("Restore the default C program?")) {

        cEditor.setValue(sampleCode);

        cEditor.setPosition({
            lineNumber: 1,
            column: 1
        });

        resetExecution();

        cEditor.focus();

        showTerminalMessage(
            "Default C program restored.",
            "success"
        );
    }
});

// ========================================
// CLEAR OUTPUT
// ========================================

clearOutput?.addEventListener("click", () => {

    showTerminalMessage("Output cleared.");
});

// ========================================
// RUN BUTTON
// ========================================

runButton?.addEventListener("click", runProgram);

// ========================================
// NEXT BUTTON
// ========================================

nextButton?.addEventListener("click", () => {

    stopAutoPlay();

    nextStep();
});

// ========================================
// PREVIOUS BUTTON
// ========================================

previousButton?.addEventListener("click", () => {

    stopAutoPlay();

    previousStep();
});

// ========================================
// AUTO PLAY BUTTON
// ========================================

autoButton?.addEventListener("click", startAutoPlay);

// ========================================
// THEME BUTTON
// ========================================

themeButton?.addEventListener("click", () => {

    document.body.classList.toggle("light-mode");
});

// ========================================
// FORMAT BUTTON
// ========================================

formatButton?.addEventListener("click", () => {

    cEditor.getAction("editor.action.formatDocument")?.run();
});

// ========================================
// SHARE BUTTON
// ========================================

shareButton?.addEventListener("click", async () => {

    try {

        await navigator.clipboard.writeText(
            window.location.href
        );

        alert("Workspace URL copied!");

    } catch {

        alert("Unable to copy the workspace URL.");
    }
});

// ========================================
// NAVIGATION
// ========================================

document.querySelectorAll(".nav-item").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".nav-item").forEach(item => {

            item.classList.remove("active");
        });

        button.classList.add("active");

        const section = button.dataset.panel;

        console.log("Selected section:", section);

        if (section !== "workspace") {

            alert(
                `${button.textContent.trim()} module is coming in a future phase.`
            );
        }
    });
});

// ========================================
// UNSAVED CHANGES
// ========================================

const unsavedDot = document.querySelector(".unsaved-dot");

cEditor.onDidChangeModelContent(() => {

    if (unsavedDot) {

        unsavedDot.style.opacity = "1";
    }
});

// ========================================
// INITIALIZE
// ========================================

resetVisualizer(cEditor);

updateControls();

console.log(
    "%c C-TRACE ",
    "background: #805bff; color: white; padding: 8px; font-weight: bold;"
);

console.log("C-TRACE application ready.");