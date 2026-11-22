// ========================================
// C-TRACE
// MONACO EDITOR ENGINE
// ========================================

import * as monaco from "monaco-editor";

import editorWorker from
    "monaco-editor/esm/vs/editor/editor.worker?worker";

import tsWorker from
    "monaco-editor/esm/vs/language/typescript/ts.worker?worker";


window.MonacoEnvironment = {

    getWorker(_, label) {

        if (label === "typescript" || label === "javascript") {
            return new tsWorker();
        }

        return new editorWorker();
    }

};


// ========================================
// DEFAULT C PROGRAM
// ========================================

export const sampleCode = `#include <stdio.h>

int main() {
    int a = 10;
    int b = 20;
    int sum = a + b;

    printf("Sum = %d", sum);

    return 0;
}`;


// ========================================
// CUSTOM THEME
// ========================================

monaco.editor.defineTheme("ctrace-dark", {

    base: "vs-dark",
    inherit: true,

    rules: [

        { token: "keyword", foreground: "C792EA" },
        { token: "number", foreground: "F78C6C" },
        { token: "string", foreground: "C3E88D" },
        { token: "comment", foreground: "697098" },
        { token: "type", foreground: "82AAFF" },
        { token: "identifier", foreground: "D6DEEB" }

    ],

    colors: {

        "editor.background": "#0D0D16",
        "editor.foreground": "#D6DEEB",

        "editorLineNumber.foreground": "#55556D",
        "editorLineNumber.activeForeground": "#A78BFA",

        "editorCursor.foreground": "#A78BFA",

        "editor.selectionBackground": "#51408066",
        "editor.lineHighlightBackground": "#171725",

        "editorIndentGuide.background1": "#252538",
        "editorIndentGuide.activeBackground1": "#805BFF"

    }

});


// ========================================
// EDITOR CONTAINER
// ========================================

const container = document.getElementById("monacoEditor");

if (!container) {
    throw new Error("Monaco Editor container not found.");
}


// ========================================
// CREATE MONACO EDITOR
// ========================================

export const cEditor = monaco.editor.create(container, {

    value: sampleCode,

    language: "c",
    theme: "ctrace-dark",

    automaticLayout: true,

    fontSize: 14,
    fontFamily: "'Cascadia Code', 'Consolas', monospace",
    fontLigatures: true,

    lineNumbers: "on",
    lineNumbersMinChars: 3,

    minimap: {
        enabled: true
    },

    scrollBeyondLastLine: false,
    smoothScrolling: true,

    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",

    tabSize: 4,
    insertSpaces: true,

    wordWrap: "on",

    folding: true,

    bracketPairColorization: {
        enabled: true
    },

    guides: {
        indentation: true,
        bracketPairs: true
    },

    suggestOnTriggerCharacters: true,
    quickSuggestions: true,

    padding: {
        top: 18,
        bottom: 18
    }

});


// ========================================
// CURSOR POSITION
// ========================================

function updateCursorPosition() {

    const position = cEditor.getPosition();

    if (!position) return;

    const cursor = document.getElementById("cursorPosition");

    if (cursor) {

        cursor.textContent =
            `Ln ${position.lineNumber}, Col ${position.column}`;

    }

}

cEditor.onDidChangeCursorPosition(updateCursorPosition);


// ========================================
// C AUTOCOMPLETION
// ========================================

monaco.languages.registerCompletionItemProvider("c", {

    provideCompletionItems() {

        const suggestions = [

            {
                label: "printf",
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'printf("${1:Hello World}");',
                insertTextRules:
                    monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Print formatted output."
            },

            {
                label: "scanf",
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'scanf("%d", &${1:variable});',
                insertTextRules:
                    monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "Read formatted input."
            },

            {
                label: "main",
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: "int main() {\n\t$0\n\treturn 0;\n}",
                insertTextRules:
                    monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: "C program entry point."
            },

            {
                label: "for",
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText:
                    "for (int i = 0; i < ${1:10}; i++) {\n\t$0\n}",
                insertTextRules:
                    monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            },

            {
                label: "while",
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText:
                    "while (${1:condition}) {\n\t$0\n}",
                insertTextRules:
                    monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            },

            {
                label: "include",
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: "#include <${1:stdio.h}>"
            }

        ];

        return {
            suggestions
        };

    }

});


// ========================================
// EDITOR FORMAT SHORTCUT
// ========================================

cEditor.addAction({

    id: "ctrace-format",

    label: "Format C Code",

    keybindings: [

        monaco.KeyMod.Shift |
        monaco.KeyMod.Alt |
        monaco.KeyCode.KeyF

    ],

    run: () => {

        alert("Advanced C code formatting will be added in a future phase.");

    }

});


// ========================================
// WINDOW RESIZE
// ========================================

window.addEventListener("resize", () => {

    cEditor.layout();

});


console.log("C-TRACE Monaco Editor initialized.");