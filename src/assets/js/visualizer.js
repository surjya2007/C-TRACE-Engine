// ========================================
// C-TRACE
// ADVANCED EXECUTION VISUALIZER
// PHASE 6.8 — SCOPE & MEMORY INSPECTOR
// ========================================


// ========================================
// DOM ELEMENTS
// ========================================

const currentStepElement = document.getElementById("currentStep");
const executedLinesElement = document.getElementById("executedLines");
const programStatusElement = document.getElementById("programStatus");

const variablesContent = document.getElementById("variablesContent");
const timelineContent = document.getElementById("timelineContent");
const explanationContent = document.getElementById("explanationContent");

// MEMORY INSPECTOR
const memoryContent = document.getElementById("memoryContent");

const activeFunctionNameElement =
    document.getElementById("activeFunctionName");

const functionStackContent =
    document.getElementById("functionStackContent");

const functionStackCountElement =
    document.getElementById("functionStackCount");

const functionParametersElement =
    document.getElementById("functionParameters");

const functionReturnValueElement =
    document.getElementById("functionReturnValue");


// ========================================
// VISUALIZER STATE
// ========================================

let currentDecorations = [];
let previousVariables = {};
let activeStepIndex = -1;


// ========================================
// HTML ESCAPE
// ========================================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ========================================
// VARIABLE NORMALIZATION
// ========================================

function normalizeVariable(variable) {

    if (
        variable !== null &&
        typeof variable === "object" &&
        !Array.isArray(variable) &&
        Object.prototype.hasOwnProperty.call(variable, "value")
    ) {

        return {
            type: variable.type || "variable",
            value: variable.value
        };

    }

    return {
        type: Array.isArray(variable) ? "array" : "variable",
        value: variable
    };

}


// ========================================
// FORMAT VARIABLE VALUE
// ========================================

function formatValue(value, type = "variable") {

    if (type === "char") {

        const character = String.fromCharCode(Number(value));

        return `'${escapeHTML(character)}'`;

    }

    if (type === "float" || type === "double") {

        return escapeHTML(Number(value));

    }

    if (typeof value === "number") {

        return escapeHTML(value);

    }

    return escapeHTML(value);

}


// ========================================
// DETECT VARIABLE CHANGES
// ========================================

function hasVariableChanged(previous, current) {

    if (Array.isArray(previous) || Array.isArray(current)) {

        if (
            !Array.isArray(previous) ||
            !Array.isArray(current)
        ) {
            return true;
        }

        if (previous.length !== current.length) {
            return true;
        }

        return current.some(
            (value, index) => value !== previous[index]
        );

    }

    return previous !== current;

}


// ========================================
// DETECT ARRAY CELL CHANGES
// ========================================

function hasArrayCellChanged(previous, current, index) {

    if (!Array.isArray(previous)) {
        return true;
    }

    return previous[index] !== current[index];

}


// ========================================
// DETECT ACTIVE ARRAY ACCESS
// ========================================

function getActiveArrayAccess(statement, variables) {

    if (!statement) return null;

    const matches = [
        ...statement.matchAll(
            /([a-zA-Z_]\w*)\s*\[\s*([^\]]+)\s*\]/g
        )
    ];

    for (const match of matches) {

        const name = match[1];
        const indexExpression = match[2].trim();

        const array = variables[name];

        if (!Array.isArray(array)) continue;

        let index;

        if (/^\d+$/.test(indexExpression)) {

            index = Number(indexExpression);

        }

        else if (
            Object.prototype.hasOwnProperty.call(
                variables,
                indexExpression
            )
        ) {

            index = Number(variables[indexExpression]);

        }

        else {

            continue;

        }

        if (
            Number.isInteger(index) &&
            index >= 0 &&
            index < array.length
        ) {

            return {
                name,
                index
            };

        }

    }

    return null;

}


// ========================================
// RENDER ARRAY MEMORY
// ========================================

function renderArrayMemory(
    name,
    values,
    previousValues,
    activeArrayAccess = null
) {

    const cells = values.map((value, index) => {

        const changed = hasArrayCellChanged(
            previousValues,
            values,
            index
        );

        const isAccessed =
            activeArrayAccess?.name === name &&
            activeArrayAccess?.index === index;

        const classes = [
            "memory-cell",
            changed ? "memory-cell-updated" : "",
            isAccessed ? "memory-cell-accessed" : ""
        ].filter(Boolean).join(" ");

        return `

            <div class="${classes}">

                <div class="memory-index">
                    ${index}
                </div>

                <div class="memory-value">
                    ${formatValue(value)}
                </div>

                <div class="memory-address">
                    ${escapeHTML(name)}[${index}]
                </div>

            </div>

        `;

    }).join("");


    return `

        <div class="memory-array">

            <div class="memory-array-header">

                <div class="memory-array-title">

                    <span class="memory-array-icon">▦</span>

                    <span>${escapeHTML(name)}</span>

                </div>

                <span class="memory-array-count">
                    ${values.length} ELEMENTS
                </span>

            </div>

            <div class="memory-array-cells">

                ${cells}

            </div>

            <div class="memory-array-footer">

                <span>Memory Layout</span>

                <span>${values.length} slots allocated</span>

            </div>

        </div>

    `;

}


// ========================================
// RENDER SCALAR VARIABLE
// ========================================

function renderScalarVariable(name, variable, previousValue) {

    const value = variable.value;

    const changed = hasVariableChanged(
        previousValue,
        value
    );

    const changeClass = previousValue === undefined
        ? "variable-new"
        : changed
            ? "variable-updated"
            : "";

    return `

        <div class="variable-item ${changeClass}">

            <div class="variable-info">

                <div class="variable-name-row">

                    <span class="variable-name">
                        ${escapeHTML(name)}
                    </span>

                    <span class="variable-type">
                        ${escapeHTML(variable.type)}
                    </span>

                </div>

                <div class="variable-address">
                    Variable storage
                </div>

            </div>

            <div class="variable-value">
                ${formatValue(value, variable.type)}
            </div>

        </div>

    `;

}


// ========================================
// RENDER VARIABLE INSPECTOR
// ========================================

export function renderVariables(
    variables = {},
    activeArrayAccess = null
) {

    if (!variablesContent) return;

    const entries = Object.entries(variables);

    if (entries.length === 0) {

        previousVariables = {};

        variablesContent.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">📦</div>

                <p>No variables declared yet.</p>

                <span>Variables will appear here during execution.</span>

            </div>

        `;

        return;

    }

    const newPreviousVariables = {};

    variablesContent.innerHTML = entries.map(([name, rawVariable]) => {

        const variable = normalizeVariable(rawVariable);

        const value = variable.value;

        const previousEntry = previousVariables[name];

        const previousValue = previousEntry
            ? previousEntry.value
            : undefined;

        newPreviousVariables[name] = {
            type: variable.type,
            value: Array.isArray(value)
                ? [...value]
                : value
        };

        if (Array.isArray(value)) {

            return renderArrayMemory(
                name,
                value,
                previousValue,
                activeArrayAccess
            );

        }

        return renderScalarVariable(
            name,
            variable,
            previousValue
        );

    }).join("");

    previousVariables = newPreviousVariables;

}


// ========================================
// MEMORY VALUE RENDERER
// ========================================

function renderMemoryValue(name, rawVariable) {

    const variable = normalizeVariable(rawVariable);

    const value = variable.value;

    if (Array.isArray(value)) {

        return `

            <div class="memory-variable memory-variable-array">

                <div class="memory-variable-heading">

                    <span class="memory-variable-name">
                        ${escapeHTML(name)}
                    </span>

                    <span class="memory-variable-type">
                        ${escapeHTML(variable.type)}
                    </span>

                </div>

                <div class="memory-variable-array-values">

                    ${value.map((item, index) => `

                        <div class="memory-variable-array-cell">

                            <span>[${index}]</span>

                            <strong>
                                ${formatValue(item)}
                            </strong>

                        </div>

                    `).join("")}

                </div>

            </div>

        `;

    }

    return `

        <div class="memory-variable">

            <div class="memory-variable-heading">

                <span class="memory-variable-name">
                    ${escapeHTML(name)}
                </span>

                <span class="memory-variable-type">
                    ${escapeHTML(variable.type)}
                </span>

            </div>

            <strong class="memory-variable-value">
                ${formatValue(value, variable.type)}
            </strong>

        </div>

    `;

}


// ========================================
// RENDER MEMORY SECTION
// ========================================

function renderMemorySection(title, variables, icon) {

    const entries = Object.entries(variables || {});

    return `

        <div class="memory-section">

            <div class="memory-section-heading">

                <div class="memory-section-title">

                    <span>${icon}</span>

                    <strong>${escapeHTML(title)}</strong>

                </div>

                <span class="memory-section-count">
                    ${entries.length} ${entries.length === 1 ? "VARIABLE" : "VARIABLES"}
                </span>

            </div>

            <div class="memory-section-content">

                ${entries.length > 0

                    ? entries.map(([name, variable]) =>
                        renderMemoryValue(name, variable)
                    ).join("")

                    : `

                        <div class="memory-empty-section">
                            No variables in this section.
                        </div>

                    `

                }

            </div>

        </div>

    `;

}


// ========================================
// RENDER MEMORY INSPECTOR
// ========================================

export function renderMemoryInspector(memory) {

    if (!memoryContent) return;

    if (!memory) {

        memoryContent.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">🧠</div>

                <p>Memory snapshot unavailable.</p>

                <span>Memory information will appear during execution.</span>

            </div>

        `;

        return;

    }


    const globals = memory.globals || {};

    const frames = Array.isArray(memory.frames)
        ? memory.frames
        : [];

    const activeFunction = memory.activeFunction || "—";

    const stackDepth = Number(memory.stackDepth) || 0;

    const totalVariables = Number(memory.totalVariables) || 0;


    // MEMORY OVERVIEW

    const overview = `

        <div class="memory-overview">

            <div class="memory-stat-card">

                <span class="memory-stat-icon">▤</span>

                <div>

                    <strong>${stackDepth}</strong>

                    <span>STACK DEPTH</span>

                </div>

            </div>

            <div class="memory-stat-card">

                <span class="memory-stat-icon">◈</span>

                <div>

                    <strong>${totalVariables}</strong>

                    <span>TOTAL VARIABLES</span>

                </div>

            </div>

            <div class="memory-stat-card">

                <span class="memory-stat-icon">ƒ</span>

                <div>

                    <strong>${frames.length}</strong>

                    <span>ACTIVE FRAMES</span>

                </div>

            </div>

        </div>

    `;


    // GLOBAL MEMORY

    const globalSection = renderMemorySection(
        "Global Scope",
        globals,
        "🌐"
    );


    // STACK FRAMES

    const frameSections = frames.length > 0

        ? frames.map((frame, index) => {

            const isActive = Boolean(frame.isActive);

            const parameters = frame.parameters || {};

            const locals = frame.locals || {};

            return `

                <div class="memory-frame ${isActive ? "memory-frame-active" : ""}">

                    <div class="memory-frame-header">

                        <div class="memory-frame-title">

                            <span class="memory-frame-icon">ƒ</span>

                            <div>

                                <strong>
                                    ${escapeHTML(frame.functionName || "Unknown Function")}()
                                </strong>

                                <span>
                                    Stack Frame ${frame.frameIndex ?? index}
                                </span>

                            </div>

                        </div>

                        <span class="memory-frame-badge">
                            ${isActive ? "ACTIVE" : "CALLER"}
                        </span>

                    </div>

                    ${renderMemorySection(
                        "Parameters",
                        parameters,
                        "↳"
                    )}

                    ${renderMemorySection(
                        "Local Variables",
                        locals,
                        "◉"
                    )}

                </div>

            `;

        }).join("")

        : `

            <div class="memory-empty-section">
                No active stack frames.
            </div>

        `;


    memoryContent.innerHTML = `

        <div class="memory-inspector">

            ${overview}

            <div class="memory-active-function">

                <span>ACTIVE EXECUTION CONTEXT</span>

                <strong>
                    ${escapeHTML(activeFunction)}()
                </strong>

            </div>

            ${globalSection}

            <div class="memory-stack-heading">

                <span>▤</span>

                <strong>CALL STACK MEMORY</strong>

                <span>${frames.length} FRAMES</span>

            </div>

            <div class="memory-frames">

                ${frameSections}

            </div>

        </div>

    `;

}


// ========================================
// FUNCTION ARGUMENT EXTRACTION
// ========================================

function getFunctionArguments(statement) {

    if (!statement) return [];

    const match = statement.match(
        /^[a-zA-Z_]\w*\s*\((.*)\)$/
    );

    if (!match || !match[1].trim()) {
        return [];
    }

    const argumentsList = [];

    let current = "";
    let depth = 0;

    for (const character of match[1]) {

        if (character === "(") depth++;
        if (character === ")") depth--;

        if (character === "," && depth === 0) {

            argumentsList.push(current.trim());
            current = "";

        } else {

            current += character;

        }

    }

    if (current.trim()) {
        argumentsList.push(current.trim());
    }

    return argumentsList;

}


// ========================================
// FIND FUNCTION CALL INFORMATION
// ========================================

function getFunctionCallInformation(steps, index, stack) {

    const currentFunction = stack[stack.length - 1];

    if (!currentFunction) {
        return null;
    }

    for (let i = index; i >= 0; i--) {

        const step = steps[i];

        if (
            step.event === "function-call" &&
            step.functionName === currentFunction &&
            Array.isArray(step.callStack) &&
            step.callStack.length === stack.length &&
            step.callStack.every(
                (name, position) => name === stack[position]
            )
        ) {

            return step;

        }

    }

    return null;

}


// ========================================
// FIND RETURN VALUE
// ========================================

function getFunctionReturnInformation(steps, index, stack) {

    for (let i = index; i >= 0; i--) {

        const step = steps[i];

        if (
            step.event === "function-return" &&
            Array.isArray(step.callStack) &&
            step.callStack.length === stack.length + 1 &&
            step.callStack
                .slice(0, stack.length)
                .every(
                    (name, position) => name === stack[position]
                )
        ) {

            const match = step.explanation.match(
                /returned\s+(.+)\.$/i
            );

            return match ? match[1] : "Returned";

        }

    }

    return null;

}


// ========================================
// RENDER FUNCTION CALL STACK
// ========================================

export function renderFunctionCallStack(
    steps = [],
    index = -1
) {

    if (
        !functionStackContent ||
        !activeFunctionNameElement
    ) {
        return;
    }

    if (
        !Array.isArray(steps) ||
        index < 0 ||
        index >= steps.length
    ) {

        resetFunctionCallStack();

        return;

    }

    const step = steps[index];

    const stack = Array.isArray(step.callStack)
        ? step.callStack
        : step.functionName
            ? [step.functionName]
            : [];

    const activeFunction =
        stack.length > 0
            ? stack[stack.length - 1]
            : step.functionName || "—";


    // ACTIVE FUNCTION

    activeFunctionNameElement.textContent =
        `${activeFunction}()`;


    // STACK COUNT

    if (functionStackCountElement) {

        functionStackCountElement.textContent =
            `${stack.length} ${stack.length === 1 ? "FRAME" : "FRAMES"}`;

    }


    // EMPTY STACK

    if (stack.length === 0) {

        functionStackContent.innerHTML = `

            <div class="function-stack-empty">

                <span>ƒ</span>

                <p>No active function calls.</p>

                <small>Run a program to inspect its call stack.</small>

            </div>

        `;

        if (functionParametersElement) {
            functionParametersElement.textContent = "—";
        }

        if (functionReturnValueElement) {
            functionReturnValueElement.textContent = "—";
        }

        return;

    }


    // FUNCTION FRAMES

    functionStackContent.innerHTML = stack.map(
        (functionName, frameIndex) => {

            const isActive =
                frameIndex === stack.length - 1;

            return `

                <div class="function-stack-frame ${isActive ? "active" : ""}">

                    <div class="function-frame-icon">
                        ƒ
                    </div>

                    <div class="function-frame-info">

                        <span class="function-frame-name">
                            ${escapeHTML(functionName)}()
                        </span>

                        <span class="function-frame-meta">
                            Stack Frame ${frameIndex + 1}
                        </span>

                    </div>

                    <span class="function-frame-status">
                        ${isActive ? "ACTIVE" : "CALLER"}
                    </span>

                </div>

            `;

        }
    ).join("");


    // FUNCTION PARAMETERS

    const callInformation = getFunctionCallInformation(
        steps,
        index,
        stack
    );

    if (functionParametersElement) {

        if (callInformation) {

            const args = getFunctionArguments(
                callInformation.statement
            );

            functionParametersElement.textContent =
                args.length > 0
                    ? args.join(", ")
                    : "No parameters";

        } else {

            functionParametersElement.textContent = "—";

        }

    }


    // FUNCTION RETURN VALUE

    if (functionReturnValueElement) {

        const returnValue = getFunctionReturnInformation(
            steps,
            index,
            stack
        );

        functionReturnValueElement.textContent =
            returnValue ?? "—";

    }

}


// ========================================
// RESET FUNCTION CALL STACK
// ========================================

function resetFunctionCallStack() {

    if (activeFunctionNameElement) {
        activeFunctionNameElement.textContent = "—";
    }

    if (functionStackCountElement) {
        functionStackCountElement.textContent = "0 FRAMES";
    }

    if (functionStackContent) {

        functionStackContent.innerHTML = `

            <div class="function-stack-empty">

                <span>ƒ</span>

                <p>No active function calls.</p>

                <small>Run a program to inspect its call stack.</small>

            </div>

        `;

    }

    if (functionParametersElement) {
        functionParametersElement.textContent = "—";
    }

    if (functionReturnValueElement) {
        functionReturnValueElement.textContent = "—";
    }

}


// ========================================
// RENDER EXECUTION TIMELINE
// ========================================

export function renderTimeline(
    steps = [],
    activeIndex = -1,
    onSelectStep = null
) {

    if (!timelineContent) return;

    if (steps.length === 0) {

        timelineContent.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">🧭</div>

                <p>No execution steps yet.</p>

                <span>Run a program to generate the timeline.</span>

            </div>

        `;

        return;

    }

    timelineContent.innerHTML = steps.map((step, index) => {

        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;

        const statusClass = isActive
            ? "active"
            : isCompleted
                ? "completed"
                : "pending";

        const marker = isCompleted
            ? "✓"
            : index + 1;

        return `

            <button

                class="timeline-step ${statusClass}"

                data-step-index="${index}"

                type="button"

                aria-current="${isActive ? "step" : "false"}"

                title="Go to line ${step.lineNumber}"

            >

                <span class="timeline-marker">
                    ${marker}
                </span>

                <span class="timeline-details">

                    <span class="timeline-title">
                        Step ${step.step}
                    </span>

                    <span class="timeline-code">
                        ${escapeHTML(step.statement)}
                    </span>

                    <span class="timeline-line">
                        <span class="timeline-line-dot"></span>
                        Line ${step.lineNumber}
                    </span>

                </span>

                <span class="timeline-status">
                    ${isActive ? "●" : isCompleted ? "✓" : "○"}
                </span>

            </button>

        `;

    }).join("");


    if (typeof onSelectStep === "function") {

        timelineContent.querySelectorAll("[data-step-index]").forEach(button => {

            button.addEventListener("click", () => {

                const index = Number(button.dataset.stepIndex);

                onSelectStep(index);

            });

        });

    }

}


// ========================================
// RENDER STEP EXPLANATION
// ========================================

export function renderExplanation(step) {

    if (!explanationContent) return;

    if (!step) {

        explanationContent.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">💡</div>

                <p>Waiting for execution.</p>

                <span>Detailed explanations will appear here.</span>

            </div>

        `;

        return;

    }

    explanationContent.innerHTML = `

        <div class="explanation-card">

            <div class="explanation-heading">

                <span class="explanation-icon">💡</span>

                <span>
                    Step ${step.step} Explanation
                </span>

            </div>

            <div class="explanation-code">
                ${escapeHTML(step.statement)}
            </div>

            <p class="explanation-text">
                ${escapeHTML(step.explanation)}
            </p>

            <div class="explanation-metadata">

                <span>
                    📍 Source Line: ${step.lineNumber}
                </span>

                <span>
                    ⚡ Step: ${step.step}
                </span>

            </div>

        </div>

    `;

}


// ========================================
// EXECUTION PROGRESS
// ========================================

export function updateExecutionProgress(
    steps = [],
    index = -1
) {

    const totalSteps = steps.length;

    const completedSteps = index >= 0
        ? index + 1
        : 0;

    if (currentStepElement) {

        currentStepElement.textContent =
            `${completedSteps} / ${totalSteps}`;

    }

    if (executedLinesElement) {

        const executedLines = new Set(
            steps
                .slice(0, completedSteps)
                .map(step => step.lineNumber)
        );

        executedLinesElement.textContent =
            executedLines.size;

    }

    if (programStatusElement) {

        let status = "Ready";

        if (totalSteps > 0 && index >= 0) {

            status = index === totalSteps - 1
                ? "Completed"
                : "Running";

        }

        programStatusElement.textContent = status;

        programStatusElement.dataset.status =
            status.toLowerCase();

    }

}


// ========================================
// MONACO EDITOR LINE HIGHLIGHT
// ========================================

export function highlightCurrentLine(editor, lineNumber) {

    if (!editor || !lineNumber) return;

    currentDecorations = editor.deltaDecorations(

        currentDecorations,

        [

            {

                range: {

                    startLineNumber: lineNumber,

                    startColumn: 1,

                    endLineNumber: lineNumber,

                    endColumn: 1

                },

                options: {

                    isWholeLine: true,

                    className: "execution-current-line",

                    linesDecorationsClassName:
                        "execution-line-marker",

                    overviewRuler: {

                        color: "#a78bfa",

                        position: 1

                    }

                }

            }

        ]

    );

    editor.revealLineInCenterIfOutsideViewport(lineNumber);

}


// ========================================
// CLEAR EDITOR HIGHLIGHT
// ========================================

export function clearEditorHighlight(editor) {

    if (!editor) return;

    currentDecorations = editor.deltaDecorations(
        currentDecorations,
        []
    );

}


// ========================================
// RENDER COMPLETE EXECUTION STEP
// ========================================

export function renderExecutionStep(
    steps,
    index,
    editor,
    onSelectStep = null
) {

    if (!Array.isArray(steps) || steps.length === 0) return;

    if (index < 0 || index >= steps.length) return;

    const step = steps[index];

    activeStepIndex = index;


    // ARRAY ACCESS

    const activeArrayAccess = getActiveArrayAccess(
        step.statement,
        step.variables
    );


    // VARIABLE INSPECTOR

    renderVariables(
        step.variables,
        activeArrayAccess
    );


    // MEMORY INSPECTOR

    renderMemoryInspector(
        step.memory
    );


    // FUNCTION CALL STACK

    renderFunctionCallStack(
        steps,
        index
    );


    // EXPLANATION

    renderExplanation(step);


    // TIMELINE

    renderTimeline(
        steps,
        index,
        onSelectStep
    );


    // PROGRESS

    updateExecutionProgress(
        steps,
        index
    );


    // EDITOR HIGHLIGHT

    highlightCurrentLine(
        editor,
        step.lineNumber
    );

}


// ========================================
// RESET MEMORY INSPECTOR
// ========================================

function resetMemoryInspector() {

    if (!memoryContent) return;

    memoryContent.innerHTML = `

        <div class="empty-state">

            <div class="empty-state-icon">🧠</div>

            <p>No memory snapshot yet.</p>

            <span>Run a program to inspect memory and scope.</span>

        </div>

    `;

}


// ========================================
// RESET VISUALIZER
// ========================================

export function resetVisualizer(editor) {

    activeStepIndex = -1;

    previousVariables = {};

    renderVariables({});

    renderExplanation(null);

    renderTimeline([]);

    updateExecutionProgress([], -1);

    resetFunctionCallStack();

    resetMemoryInspector();

    clearEditorHighlight(editor);

}


// ========================================
// INITIALIZATION
// ========================================

console.log(

    "%c C-TRACE MEMORY INSPECTOR ",

    "background: #805bff; color: white; padding: 8px; font-weight: bold;"

);

console.log(
    "Scope and memory visualization initialized successfully."
);