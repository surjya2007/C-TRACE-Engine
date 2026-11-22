// ========================================
// C-TRACE
// PHASE 6.9 — MEMORY CHANGE TRACKING
// ========================================

const OPERATORS = [
    "==", "!=", "<=", ">=", "&&", "||",
    "++", "--", "+=", "-=", "*=", "/=",
    "+", "-", "*", "/", "%", "<", ">", "!",
    "=", "(", ")", "{", "}", "[", "]", ";", ","
];

const MAX_ITERATIONS = 1000;
const MAX_CALL_DEPTH = 50;


// ========================================
// VARIABLE SNAPSHOTS
// ========================================

function cloneValue(value) {
    return Array.isArray(value) ? [...value] : value;
}

function cloneVariables(variables) {
    const snapshot = {};

    for (const [name, value] of Object.entries(variables)) {
        snapshot[name] = cloneValue(value);
    }

    return snapshot;
}

function getOwnVariables(variables) {
    return cloneVariables(variables);
}

function getVisibleVariables(variables) {
    const result = {};
    let current = variables;

    while (current && current !== Object.prototype) {
        for (const [name, value] of Object.entries(current)) {
            if (!(name in result)) {
                result[name] = cloneValue(value);
            }
        }

        current = Object.getPrototypeOf(current);
    }

    return result;
}


// ========================================
// TOKENIZER
// ========================================

function tokenize(code) {
    const tokens = [];
    let i = 0;
    let line = 1;

    while (i < code.length) {
        const char = code[i];

        if (char === "\n") {
            line++;
            i++;
            continue;
        }

        if (/\s/.test(char)) {
            i++;
            continue;
        }

        if (char === "#" && (i === 0 || code[i - 1] === "\n")) {
            while (i < code.length && code[i] !== "\n") i++;
            continue;
        }

        if (char === "/" && code[i + 1] === "/") {
            while (i < code.length && code[i] !== "\n") i++;
            continue;
        }

        if (char === "/" && code[i + 1] === "*") {
            i += 2;

            while (i < code.length) {
                if (code[i] === "\n") line++;

                if (code[i] === "*" && code[i + 1] === "/") {
                    i += 2;
                    break;
                }

                i++;
            }

            continue;
        }

        if (char === '"') {
            const startLine = line;
            let value = "";
            i++;

            while (i < code.length && code[i] !== '"') {
                if (code[i] === "\\" && i + 1 < code.length) {
                    value += code[i] + code[i + 1];
                    i += 2;
                    continue;
                }

                if (code[i] === "\n") line++;

                value += code[i++];
            }

            if (i >= code.length) {
                throw new Error("Unterminated string literal.");
            }

            i++;

            tokens.push({
                type: "string",
                value,
                line: startLine
            });

            continue;
        }

        if (char === "'") {
            const startLine = line;
            let value = "";
            i++;

            while (i < code.length && code[i] !== "'") {
                if (code[i] === "\\" && i + 1 < code.length) {
                    value += code[i] + code[i + 1];
                    i += 2;
                } else {
                    value += code[i++];
                }
            }

            if (i >= code.length) {
                throw new Error("Unterminated character literal.");
            }

            i++;

            tokens.push({
                type: "char",
                value,
                line: startLine
            });

            continue;
        }

        if (/[0-9]/.test(char)) {
            let value = "";

            while (i < code.length && /[0-9.]/.test(code[i])) {
                value += code[i++];
            }

            tokens.push({
                type: "number",
                value,
                line
            });

            continue;
        }

        if (/[a-zA-Z_]/.test(char)) {
            let value = "";

            while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
                value += code[i++];
            }

            tokens.push({
                type: "identifier",
                value,
                line
            });

            continue;
        }

        const operator = OPERATORS.find(op =>
            code.startsWith(op, i)
        );

        if (operator) {
            tokens.push({
                type: "operator",
                value: operator,
                line
            });

            i += operator.length;
            continue;
        }

        i++;
    }

    return tokens;
}


// ========================================
// TOKEN UTILITIES
// ========================================

function tokensToText(tokens) {
    return tokens.map(token => {
        if (token.type === "string") {
            return `"${token.value}"`;
        }

        if (token.type === "char") {
            return `'${token.value}'`;
        }

        return token.value;
    }).join(" ");
}

function splitArguments(text) {
    const result = [];
    let current = "";
    let depth = 0;
    let insideString = false;
    let insideChar = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"' && text[i - 1] !== "\\") {
            insideString = !insideString;
        }

        if (char === "'" && text[i - 1] !== "\\") {
            insideChar = !insideChar;
        }

        if (!insideString && !insideChar) {
            if (char === "(" || char === "[") depth++;
            if (char === ")" || char === "]") depth--;

            if (char === "," && depth === 0) {
                result.push(current.trim());
                current = "";
                continue;
            }
        }

        current += char;
    }

    if (current.trim()) {
        result.push(current.trim());
    }

    return result;
}


// ========================================
// PROGRAM PARSER
// ========================================

function parseProgram(code) {
    const tokens = tokenize(code);
    let position = 0;

    const functions = {};
    const globals = [];

    function peek(offset = 0) {
        return tokens[position + offset];
    }

    function consume() {
        return tokens[position++];
    }

    function expect(value) {
        if (peek()?.value !== value) {
            throw new Error(`Expected '${value}'.`);
        }

        consume();
    }

    function collectUntil(delimiter) {
        const result = [];
        let depth = 0;

        while (position < tokens.length) {
            const token = peek();

            if (token.value === delimiter && depth === 0) {
                break;
            }

            if (token.value === "(" || token.value === "[") {
                depth++;
            }

            if (token.value === ")" || token.value === "]") {
                depth--;
            }

            result.push(consume());
        }

        return result;
    }

    function parseBlock() {
        expect("{");

        const body = [];

        while (
            position < tokens.length &&
            peek()?.value !== "}"
        ) {
            body.push(parseStatement());
        }

        expect("}");

        return body;
    }

    function parseCondition() {
        expect("(");

        const condition = tokensToText(
            collectUntil(")")
        );

        expect(")");

        return condition;
    }

    function parseStatement() {
        const token = peek();

        if (!token) return null;

        if (token.value === "{") {
            return {
                type: "block",
                line: token.line,
                body: parseBlock()
            };
        }

        if (token.value === "if") {
            const line = consume().line;
            const condition = parseCondition();
            const consequent = parseStatement();

            let alternate = null;

            if (peek()?.value === "else") {
                consume();
                alternate = parseStatement();
            }

            return {
                type: "if",
                line,
                condition,
                consequent,
                alternate
            };
        }

        if (token.value === "for") {
            const line = consume().line;

            expect("(");

            const initialization = tokensToText(
                collectUntil(";")
            );

            expect(";");

            const condition = tokensToText(
                collectUntil(";")
            );

            expect(";");

            const update = tokensToText(
                collectUntil(")")
            );

            expect(")");

            return {
                type: "for",
                line,
                initialization,
                condition,
                update,
                body: parseStatement()
            };
        }

        if (token.value === "while") {
            const line = consume().line;
            const condition = parseCondition();

            return {
                type: "while",
                line,
                condition,
                body: parseStatement()
            };
        }

        if (token.value === "do") {
            const line = consume().line;
            const body = parseStatement();

            expect("while");

            const condition = parseCondition();

            expect(";");

            return {
                type: "doWhile",
                line,
                condition,
                body
            };
        }

        const line = token.line;
        const statement = collectUntil(";");

        expect(";");

        return {
            type: "statement",
            line,
            code: tokensToText(statement)
        };
    }

    while (position < tokens.length) {
        const returnType = peek();
        const name = peek(1);
        const openingParenthesis = peek(2);

        const isFunction =
            returnType?.type === "identifier" &&
            ["int", "void", "float", "double", "char"].includes(returnType.value) &&
            name?.type === "identifier" &&
            openingParenthesis?.value === "(";

        if (isFunction) {
            const line = returnType.line;

            consume();
            consume();
            consume();

            const parameterTokens = collectUntil(")");
            expect(")");

            const parameters = [];

            if (
                parameterTokens.length &&
                parameterTokens[0].value !== "void"
            ) {
                const parameterGroups = [];
                let current = [];

                for (const token of parameterTokens) {
                    if (token.value === ",") {
                        if (current.length) {
                            parameterGroups.push(current);
                        }

                        current = [];
                    } else {
                        current.push(token);
                    }
                }

                if (current.length) {
                    parameterGroups.push(current);
                }

                for (const group of parameterGroups) {
                    const identifier = [...group]
                        .reverse()
                        .find(token => token.type === "identifier");

                    if (!identifier) {
                        throw new Error(
                            `Invalid parameter in function '${name.value}'.`
                        );
                    }

                    parameters.push(identifier.value);
                }
            }

            if (peek()?.value === ";") {
                consume();
                continue;
            }

            if (peek()?.value !== "{") {
                throw new Error(
                    `Expected function body for '${name.value}'.`
                );
            }

            if (functions[name.value]) {
                throw new Error(
                    `Duplicate function definition: ${name.value}`
                );
            }

            functions[name.value] = {
                name: name.value,
                returnType: returnType.value,
                parameters,
                line,
                body: parseBlock()
            };

            continue;
        }

        const line = peek().line;
        const globalTokens = collectUntil(";");

        if (globalTokens.length === 0) {
            throw new Error("Invalid global declaration.");
        }

        expect(";");

        globals.push({
            type: "statement",
            line,
            code: tokensToText(globalTokens)
        });
    }

    if (!functions.main) {
        throw new Error("Could not find main() function.");
    }

    return {
        functions,
        globals
    };
}


// ========================================
// EXPRESSION EVALUATOR
// ========================================

function evaluateExpression(expression, variables, callFunction) {
    const tokens = tokenize(expression);
    let position = 0;

    function peek() {
        return tokens[position]?.value;
    }

    function consume() {
        return tokens[position++];
    }

    function expect(value) {
        if (peek() !== value) {
            throw new Error(`Expected '${value}'.`);
        }

        consume();
    }

    function primary() {
        const token = consume();

        if (!token) {
            throw new Error("Invalid expression.");
        }

        if (token.value === "(") {
            const result = logicalOr();
            expect(")");
            return result;
        }

        if (token.value === "!") {
            return !primary();
        }

        if (token.value === "-") {
            return -Number(primary());
        }

        if (token.value === "+") {
            return Number(primary());
        }

        if (token.type === "number") {
            return Number(token.value);
        }

        if (token.type === "char") {
            return token.value.charCodeAt(0);
        }

        if (token.type === "string") {
            return token.value
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t");
        }

        if (token.type === "identifier") {
            if (token.value === "true") return 1;
            if (token.value === "false") return 0;

            if (peek() === "(") {
                consume();

                const args = [];

                if (peek() !== ")") {
                    while (true) {
                        args.push(logicalOr());

                        if (peek() !== ",") break;

                        consume();
                    }
                }

                expect(")");

                return callFunction(token.value, args, token.line);
            }

            if (!(token.value in variables)) {
                throw new Error(
                    `Undefined variable: ${token.value}`
                );
            }

            const variable = variables[token.value];

            if (peek() === "[") {
                if (!Array.isArray(variable)) {
                    throw new Error(
                        `${token.value} is not an array.`
                    );
                }

                consume();

                const index = logicalOr();

                expect("]");

                if (
                    !Number.isInteger(Number(index)) ||
                    index < 0 ||
                    index >= variable.length
                ) {
                    throw new Error(
                        `Array index out of bounds: ${token.value}[${index}]`
                    );
                }

                return variable[Number(index)];
            }

            if (Array.isArray(variable)) {
                throw new Error(
                    `Array '${token.value}' requires an index.`
                );
            }

            return variable;
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    function multiplication() {
        let left = primary();

        while (["*", "/", "%"].includes(peek())) {
            const operator = consume().value;
            const right = primary();

            if (operator === "*") left *= right;
            if (operator === "/") left /= right;
            if (operator === "%") left %= right;
        }

        return left;
    }

    function addition() {
        let left = multiplication();

        while (["+", "-"].includes(peek())) {
            const operator = consume().value;
            const right = multiplication();

            if (operator === "+") left += right;
            if (operator === "-") left -= right;
        }

        return left;
    }

    function comparison() {
        let left = addition();

        while (
            ["==", "!=", "<", ">", "<=", ">="].includes(peek())
        ) {
            const operator = consume().value;
            const right = addition();

            switch (operator) {
                case "==": left = left === right; break;
                case "!=": left = left !== right; break;
                case "<": left = left < right; break;
                case ">": left = left > right; break;
                case "<=": left = left <= right; break;
                case ">=": left = left >= right; break;
            }
        }

        return left;
    }

    function logicalAnd() {
        let left = comparison();

        while (peek() === "&&") {
            consume();
            const right = comparison();

            left = Boolean(left) && Boolean(right);
        }

        return left;
    }

    function logicalOr() {
        let left = logicalAnd();

        while (peek() === "||") {
            consume();
            const right = logicalAnd();

            left = Boolean(left) || Boolean(right);
        }

        return left;
    }

    const result = logicalOr();

    if (position < tokens.length) {
        throw new Error(`Unexpected token: ${peek()}`);
    }

    return result;
}


// ========================================
// PRINTF SUPPORT
// ========================================

function formatPrintf(code, variables, callFunction) {
    const match = code.match(
        /printf\s*\(\s*"((?:\\.|[^"\\])*)"\s*(?:,\s*(.*))?\s*\)/
    );

    if (!match) return null;

    const format = match[1];

    const args = match[2]
        ? splitArguments(match[2])
        : [];

    let index = 0;

    return format.replace(
        /%[diufcs]/g,
        specifier => {
            const argument = args[index++];

            if (!argument) return specifier;

            const value = evaluateExpression(
                argument,
                variables,
                callFunction
            );

            if (specifier === "%c") {
                return String.fromCharCode(Number(value));
            }

            if (specifier === "%f") {
                return Number(value).toFixed(6);
            }

            if (specifier === "%s") {
                return String(value);
            }

            return String(Math.trunc(Number(value)));
        }
    ).replace(/\\n/g, "\n")
     .replace(/\\t/g, "\t");
}


// ========================================
// EXECUTION TRACE ENGINE
// ========================================

export function createExecutionTrace(code) {
    const parsedProgram = parseProgram(code);

    const functions = parsedProgram.functions;
    const globalDeclarations = parsedProgram.globals;

    const steps = [];

    let programOutput = "";

    const callStack = [];
    const runtimeFrames = [];

    const globalVariables = {};

    // ========================================
    // PHASE 6.9 — MEMORY CHANGE TRACKER
    // ========================================

    let previousMemorySnapshot = null;

    function getMemoryEntries(memory) {
        const entries = {};

        for (const [name, value] of Object.entries(memory.globals)) {
            entries[`global.${name}`] = cloneValue(value);
        }

        memory.frames.forEach((frame, index) => {
            const prefix = `frame.${frame.functionName}.${index}`;

            for (const [name, value] of Object.entries(frame.parameters)) {
                entries[`${prefix}.parameter.${name}`] =
                    cloneValue(value);
            }

            for (const [name, value] of Object.entries(frame.locals)) {
                entries[`${prefix}.local.${name}`] =
                    cloneValue(value);
            }
        });

        return entries;
    }

    function detectMemoryChanges(currentMemory) {
        const currentEntries = getMemoryEntries(currentMemory);

        const previousEntries = previousMemorySnapshot
            ? getMemoryEntries(previousMemorySnapshot)
            : {};

        const changes = [];

        // NEW AND UPDATED VARIABLES

        for (const [path, currentValue] of Object.entries(currentEntries)) {
            const existsPreviously =
                Object.prototype.hasOwnProperty.call(
                    previousEntries,
                    path
                );

            if (!existsPreviously) {
                changes.push({
                    name: path,
                    type: "new",
                    previousValue: null,
                    currentValue: cloneValue(currentValue)
                });

                continue;
            }

            const previousValue = previousEntries[path];

            if (
                JSON.stringify(previousValue) !==
                JSON.stringify(currentValue)
            ) {
                changes.push({
                    name: path,
                    type: "updated",
                    previousValue: cloneValue(previousValue),
                    currentValue: cloneValue(currentValue)
                });
            }
        }

        // REMOVED VARIABLES

        for (const [path, previousValue] of Object.entries(previousEntries)) {
            if (
                !Object.prototype.hasOwnProperty.call(
                    currentEntries,
                    path
                )
            ) {
                changes.push({
                    name: path,
                    type: "removed",
                    previousValue: cloneValue(previousValue),
                    currentValue: null
                });
            }
        }

        // SAVE CURRENT SNAPSHOT

        previousMemorySnapshot = {
            globals: cloneVariables(currentMemory.globals),

            frames: currentMemory.frames.map(frame => ({
                ...frame,
                parameters: cloneVariables(frame.parameters),
                locals: cloneVariables(frame.locals)
            }))
        };

        return changes;
    }


    // ========================================
    // MEMORY SNAPSHOT
    // ========================================

    function createMemorySnapshot() {
        const frames = runtimeFrames.map((frame, index) => {
            const ownVariables = getOwnVariables(frame.variables);

            const parameters = {};
            const locals = {};

            for (const name of Object.keys(ownVariables)) {
                if (frame.parameters.includes(name)) {
                    parameters[name] = cloneValue(
                        ownVariables[name]
                    );
                } else {
                    locals[name] = cloneValue(
                        ownVariables[name]
                    );
                }
            }

            return {
                frameIndex: index + 1,
                functionName: frame.name,
                isActive: index === runtimeFrames.length - 1,
                parameters,
                locals,
                variableCount: Object.keys(ownVariables).length
            };
        });

        return {
            globals: cloneVariables(globalVariables),

            frames,

            activeFunction: runtimeFrames.length
                ? runtimeFrames[runtimeFrames.length - 1].name
                : null,

            stackDepth: frames.length,

            totalVariables:
                Object.keys(globalVariables).length +
                frames.reduce(
                    (total, frame) => total + frame.variableCount,
                    0
                )
        };
    }


    // ========================================
    // ADD EXECUTION STEP
    // ========================================

    function addStep(
        line,
        statement,
        explanation,
        variables,
        output = null,
        event = "execution"
    ) {
        if (output !== null) {
            programOutput += output;
        }

        const visible = getVisibleVariables(variables);

        // Capture memory only once per step.
        const memorySnapshot = createMemorySnapshot();

        // Detect changes against the previous step.
        const memoryChanges = detectMemoryChanges(memorySnapshot);

        steps.push({
            step: steps.length + 1,
            lineNumber: line,
            statement,

            variables: cloneVariables(visible),

            memory: memorySnapshot,

            memoryChanges,

            output: programOutput,
            programOutput,

            explanation,

            functionName: callStack.length
                ? callStack[callStack.length - 1]
                : "Global Scope",

            callStack: [...callStack],

            event
        });
    }


    // ========================================
    // FUNCTION CALL HANDLER
    // ========================================

    function callFunction(name, args, line, parentVariables) {
        const fn = functions[name];

        if (!fn) {
            throw new Error(`Undefined function: ${name}`);
        }

        if (name === "main") {
            throw new Error(
                "main() cannot be called from this visualizer."
            );
        }

        if (callStack.length >= MAX_CALL_DEPTH) {
            throw new Error(
                "Maximum function call depth exceeded."
            );
        }

        if (args.length !== fn.parameters.length) {
            throw new Error(
                `Function '${name}' expects ${fn.parameters.length} arguments, but received ${args.length}.`
            );
        }

        const localVariables = Object.create(parentVariables);

        fn.parameters.forEach((parameter, index) => {
            localVariables[parameter] = args[index];
        });

        const frame = {
            name,
            variables: localVariables,
            parameters: [...fn.parameters]
        };

        callStack.push(name);
        runtimeFrames.push(frame);

        addStep(
            line,
            `${name}(${args.join(", ")})`,
            `Calling function '${name}' with arguments: ${args.join(", ")}.`,
            localVariables,
            null,
            "function-call"
        );

        let returnValue = 0;

        try {
            executeNodes(fn.body, localVariables);
        } catch (signal) {
            if (signal && signal.type === "return") {
                returnValue = signal.value;
            } else {
                throw signal;
            }
        } finally {
            addStep(
                fn.line,
                `return from ${name}`,
                `Function '${name}' finished and returned ${returnValue}.`,
                localVariables,
                null,
                "function-return"
            );

            runtimeFrames.pop();
            callStack.pop();
        }

        return returnValue;
    }


    // ========================================
    // ARRAY DECLARATION
    // ========================================

    function executeArrayDeclaration(statement, variables) {
        const text = statement.code.trim();

        const match = text.match(
            /^(int|float|double|char)\s+([a-zA-Z_]\w*)\s*\[\s*(\d+)\s*\]\s*(?:=\s*\{(.*)\})?$/
        );

        if (!match) return false;

        const type = match[1];
        const name = match[2];
        const size = Number(match[3]);
        const initializer = match[4];

        if (size <= 0 || size > 10000) {
            throw new Error(`Invalid array size: ${size}`);
        }

        let values = [];

        if (initializer !== undefined) {
            values = splitArguments(initializer).map(item =>
                evaluateExpression(
                    item,
                    variables,
                    (name, args, line) =>
                        callFunction(name, args, line, variables)
                )
            );

            if (values.length > size) {
                throw new Error(
                    `Too many initializers for array '${name}'.`
                );
            }
        }

        while (values.length < size) {
            values.push(0);
        }

        if (type === "int" || type === "char") {
            values = values.map(value =>
                Math.trunc(Number(value))
            );
        }

        variables[name] = values;

        addStep(
            statement.line,
            text + ";",
            `Declared array '${name}' with ${size} elements: [${values.join(", ")}].`,
            variables,
            null,
            "array-declaration"
        );

        return true;
    }


    // ========================================
    // ARRAY ASSIGNMENT
    // ========================================

    function executeArrayAssignment(statement, variables) {
        const text = statement.code.trim();

        const match = text.match(
            /^([a-zA-Z_]\w*)\s*\[\s*(.+?)\s*\]\s*(=|\+=|-=|\*=|\/=)\s*(.+)$/
        );

        if (!match) return false;

        const name = match[1];
        const indexExpression = match[2];
        const operator = match[3];
        const valueExpression = match[4];

        if (!(name in variables) || !Array.isArray(variables[name])) {
            throw new Error(`Undefined array: ${name}`);
        }

        const evaluate = expression =>
            evaluateExpression(
                expression,
                variables,
                (fnName, args, line) =>
                    callFunction(fnName, args, line, variables)
            );

        const index = Number(evaluate(indexExpression));
        const array = variables[name];

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= array.length
        ) {
            throw new Error(
                `Array index out of bounds: ${name}[${index}]`
            );
        }

        const value = evaluate(valueExpression);

        switch (operator) {
            case "=": array[index] = value; break;
            case "+=": array[index] += value; break;
            case "-=": array[index] -= value; break;
            case "*=": array[index] *= value; break;
            case "/=": array[index] /= value; break;
        }

        addStep(
            statement.line,
            text + ";",
            `Updated ${name}[${index}] to ${array[index]}.`,
            variables,
            null,
            "array-assignment"
        );

        return true;
    }


    // ========================================
    // SIMPLE STATEMENTS
    // ========================================

    function executeSimpleStatement(statement, variables) {
        const text = statement.code.trim();

        if (!text) return;

        const evaluate = expression =>
            evaluateExpression(
                expression,
                variables,
                (name, args, line) =>
                    callFunction(name, args, line, variables)
            );

        if (executeArrayDeclaration(statement, variables)) {
            return;
        }

        if (executeArrayAssignment(statement, variables)) {
            return;
        }

        // RETURN

        const returnMatch = text.match(/^return(?:\s+(.+))?$/);

        if (returnMatch) {
            const value = returnMatch[1]
                ? evaluate(returnMatch[1])
                : 0;

            addStep(
                statement.line,
                text + ";",
                `Returning ${value} from the current function.`,
                variables,
                null,
                "return"
            );

            throw {
                type: "return",
                value
            };
        }

        // VARIABLE DECLARATION

        const declaration = text.match(
            /^(int|float|double|char)\s+([a-zA-Z_]\w*)\s*(?:=\s*(.+))?$/
        );

        if (declaration) {
            const type = declaration[1];
            const name = declaration[2];

            let value = declaration[3]
                ? evaluate(declaration[3])
                : 0;

            if (type === "int" || type === "char") {
                value = Math.trunc(Number(value));
            }

            variables[name] = value;

            addStep(
                statement.line,
                text + ";",
                `Declared ${type} variable '${name}' with value ${value}.`,
                variables,
                null,
                "variable-declaration"
            );

            return;
        }

        // PRINTF

        if (text.startsWith("printf")) {
            const output = formatPrintf(
                text,
                variables,
                (name, args, line) =>
                    callFunction(name, args, line, variables)
            );

            if (output !== null) {
                addStep(
                    statement.line,
                    text + ";",
                    "printf() displays information in the program output.",
                    variables,
                    output,
                    "output"
                );

                return;
            }
        }

        // INCREMENT / DECREMENT

        const increment = text.match(
            /^(\+\+|--)?\s*([a-zA-Z_]\w*)\s*(\+\+|--)?$/
        );

        if (increment) {
            const name = increment[2];
            const operator = increment[1] || increment[3];

            if (!(name in variables)) {
                throw new Error(`Undefined variable: ${name}`);
            }

            if (Array.isArray(variables[name])) {
                throw new Error(
                    `Cannot increment an entire array: ${name}`
                );
            }

            variables[name] += operator === "++" ? 1 : -1;

            addStep(
                statement.line,
                text + ";",
                `Variable '${name}' is now ${variables[name]}.`,
                variables,
                null,
                "variable-update"
            );

            return;
        }

        // VARIABLE ASSIGNMENT

        const assignment = text.match(
            /^([a-zA-Z_]\w*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/
        );

        if (assignment) {
            const name = assignment[1];
            const operator = assignment[2];

            if (!(name in variables)) {
                throw new Error(`Undefined variable: ${name}`);
            }

            if (Array.isArray(variables[name])) {
                throw new Error(
                    `Cannot assign a scalar value to array '${name}'.`
                );
            }

            const value = evaluate(assignment[3]);

            switch (operator) {
                case "=": variables[name] = value; break;
                case "+=": variables[name] += value; break;
                case "-=": variables[name] -= value; break;
                case "*=": variables[name] *= value; break;
                case "/=": variables[name] /= value; break;
            }

            addStep(
                statement.line,
                text + ";",
                `Updated '${name}' to ${variables[name]}.`,
                variables,
                null,
                "variable-update"
            );

            return;
        }

        throw new Error(
            `Unsupported statement at line ${statement.line}: ${text}`
        );
    }


    // ========================================
    // NODE EXECUTION
    // ========================================

    function executeNodes(nodes, variables) {
        for (const node of nodes) {
            executeNode(node, variables);
        }
    }

    function executeNode(node, variables) {
        if (!node) return;

        if (node.type === "block") {
            executeNodes(node.body, variables);
            return;
        }

        if (node.type === "statement") {
            executeSimpleStatement(node, variables);
            return;
        }

        if (node.type === "if") {
            const result = Boolean(
                evaluateExpression(
                    node.condition,
                    variables,
                    (name, args, line) =>
                        callFunction(name, args, line, variables)
                )
            );

            addStep(
                node.line,
                `if (${node.condition})`,
                result
                    ? "Condition TRUE: executing this block."
                    : "Condition FALSE: skipping this block.",
                variables
            );

            if (result) {
                executeNode(node.consequent, variables);
            } else if (node.alternate) {
                if (node.alternate.type !== "if") {
                    addStep(
                        node.alternate.line,
                        "else",
                        "Executing else because the previous condition was false.",
                        variables
                    );
                }

                executeNode(node.alternate, variables);
            }

            return;
        }

        if (node.type === "for") {
            if (node.initialization.trim()) {
                executeSimpleStatement({
                    line: node.line,
                    code: node.initialization
                }, variables);
            }

            let iteration = 0;

            while (true) {
                if (iteration >= MAX_ITERATIONS) {
                    throw new Error(
                        "FOR loop stopped: maximum iterations reached."
                    );
                }

                const result = node.condition.trim()
                    ? Boolean(
                        evaluateExpression(
                            node.condition,
                            variables,
                            (name, args, line) =>
                                callFunction(name, args, line, variables)
                        )
                    )
                    : true;

                addStep(
                    node.line,
                    `for condition: ${node.condition || "true"}`,
                    result
                        ? `Iteration ${iteration + 1}: condition TRUE.`
                        : "Condition FALSE: FOR loop terminated.",
                    variables
                );

                if (!result) break;

                executeNode(node.body, variables);

                if (node.update.trim()) {
                    executeSimpleStatement({
                        line: node.line,
                        code: node.update
                    }, variables);
                }

                iteration++;
            }

            return;
        }

        if (node.type === "while") {
            let iteration = 0;

            while (true) {
                if (iteration >= MAX_ITERATIONS) {
                    throw new Error(
                        "WHILE loop stopped: maximum iterations reached."
                    );
                }

                const result = Boolean(
                    evaluateExpression(
                        node.condition,
                        variables,
                        (name, args, line) =>
                            callFunction(name, args, line, variables)
                    )
                );

                addStep(
                    node.line,
                    `while (${node.condition})`,
                    result
                        ? `WHILE iteration ${iteration + 1}: condition TRUE.`
                        : "Condition FALSE: WHILE loop terminated.",
                    variables
                );

                if (!result) break;

                executeNode(node.body, variables);

                iteration++;
            }

            return;
        }

        if (node.type === "doWhile") {
            let iteration = 0;

            while (true) {
                if (iteration >= MAX_ITERATIONS) {
                    throw new Error(
                        "DO-WHILE loop stopped: maximum iterations reached."
                    );
                }

                executeNode(node.body, variables);

                iteration++;

                const result = Boolean(
                    evaluateExpression(
                        node.condition,
                        variables,
                        (name, args, line) =>
                            callFunction(name, args, line, variables)
                    )
                );

                addStep(
                    node.line,
                    `while (${node.condition})`,
                    result
                        ? `DO-WHILE iteration ${iteration}: condition TRUE.`
                        : "Condition FALSE: DO-WHILE loop terminated.",
                    variables
                );

                if (!result) break;
            }

            return;
        }
    }


    // ========================================
    // GLOBAL VARIABLE INITIALIZATION
    // ========================================

    function initializeGlobals() {
        for (const declaration of globalDeclarations) {
            executeSimpleStatement(declaration, globalVariables);
        }
    }


    // ========================================
    // START EXECUTION
    // ========================================

    try {
        initializeGlobals();

        const mainFunction = functions.main;

        const mainVariables = Object.create(globalVariables);

        const mainFrame = {
            name: "main",
            variables: mainVariables,
            parameters: []
        };

        callStack.push("main");
        runtimeFrames.push(mainFrame);

        addStep(
            mainFunction.line,
            "main()",
            "Program execution started inside main().",
            mainVariables,
            null,
            "function-call"
        );

        try {
            executeNodes(mainFunction.body, mainVariables);
        } catch (signal) {
            if (signal && signal.type === "return") {
                // main() has returned.
            } else {
                throw signal;
            }
        }

        addStep(
            mainFunction.line,
            "Program finished",
            "Execution of main() completed successfully.",
            mainVariables,
            null,
            "program-end"
        );

        if (steps.length <= 1) {
            throw new Error(
                "No executable statements found."
            );
        }

        return steps;

    } catch (error) {
        throw new Error(
            `Visualizer Error: ${error.message || error}`
        );
    }
}