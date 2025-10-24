/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api";
import React, { useCallback, useEffect, useRef } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";

// ==========================================
// AUTOCOMPLETE CONFIGURATION
// ==========================================
// Modify these to customize autocomplete behavior

interface CompletionKeyword {
  label: string;
  kind: Monaco.languages.CompletionItemKind;
  insertText: string;
  insertTextRules?: number;
  documentation?: string;
  detail?: string;
}

interface HoverKeyword {
  word: string;
  title: string;
  description: string;
}

interface ObjectField {
  label: string;
  type: string;
  documentation: string;
  isString?: boolean; // Whether this field supports string methods
}

interface CELObject {
  name: string;
  enabled: boolean;
  documentation: string;
  fields: ObjectField[];
}

interface CompletionConfig {
  triggerCharacters: string[];
  keywords: CompletionKeyword[];
  objects: CELObject[];
}

interface HoverConfig {
  keywords: HoverKeyword[];
}

// ==========================================
// OBJECT DEFINITIONS
// ==========================================
// Toggle enabled/disabled to control which objects appear in autocomplete

const CEL_OBJECTS: CELObject[] = [
  {
    name: "resource",
    enabled: true,
    documentation: "Target resource for deployment operations",
    fields: [
      {
        label: "name",
        type: "string",
        documentation: "The name of the resource",
        isString: true,
      },
      {
        label: "kind",
        type: "string",
        documentation: "The kind/type of the resource",
        isString: true,
      },
      {
        label: "version",
        type: "string",
        documentation: "The version of the resource",
        isString: true,
      },
      {
        label: "identifier",
        type: "string",
        documentation: "Unique identifier for the resource",
        isString: true,
      },
      {
        label: "config",
        type: "record<string, any>",
        documentation: "Configuration data for the resource",
      },
      {
        label: "metadata",
        type: "record<string, string>",
        documentation: "Key-value metadata for the resource",
      },
      {
        label: "jobAgentId",
        type: "string",
        documentation: "ID of the job agent associated with this resource",
        isString: true,
      },
      {
        label: "createdAt",
        type: "Timestamp",
        documentation: "Timestamp when the resource was created",
      },
      {
        label: "updatedAt",
        type: "Timestamp",
        documentation: "Timestamp when the resource was last updated",
      },
    ],
  },
  {
    name: "environment",
    enabled: true,
    documentation: "Deployment environment configuration",
    fields: [
      {
        label: "id",
        type: "string",
        documentation: "Unique identifier for the environment",
        isString: true,
      },
      {
        label: "name",
        type: "string",
        documentation: "Name of the environment",
        isString: true,
      },
      {
        label: "description",
        type: "string",
        documentation: "Description of the environment",
        isString: true,
      },
    ],
  },
  {
    name: "deployment",
    enabled: true,
    documentation: "Current deployment context",
    fields: [
      {
        label: "id",
        type: "string",
        documentation: "Unique identifier for the deployment",
        isString: true,
      },
      {
        label: "name",
        type: "string",
        documentation: "Name of the deployment",
        isString: true,
      },
      {
        label: "version",
        type: "string",
        documentation: "Version being deployed",
        isString: true,
      },
    ],
  },
];

// Define your autocomplete suggestions here
const COMPLETION_CONFIG: CompletionConfig = {
  triggerCharacters: [".", ":", "/", " ", "(", "["],
  objects: CEL_OBJECTS,
  keywords: [
    // General CEL Functions
    {
      label: "size",
      kind: 2, // Function
      insertText: "size($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Returns the size of a string, list, map, or bytes",
      detail: "size(collection) → int",
    },

    // List Functions
    {
      label: "all",
      kind: 1,
      insertText: "all($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Tests whether all elements satisfy a condition",
      detail: "list.all(var, bool) → bool",
    },
    {
      label: "exists",
      kind: 1,
      insertText: "exists($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Tests whether any element satisfies a condition",
      detail: "list.exists(var, bool) → bool",
    },
    {
      label: "exists_one",
      kind: 1,
      insertText: "exists_one($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Tests whether exactly one element satisfies a condition",
      detail: "list.exists_one(var, bool) → bool",
    },
    {
      label: "filter",
      kind: 1,
      insertText: "filter($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Filters list elements by condition",
      detail: "list.filter(var, bool) → list",
    },
    {
      label: "map",
      kind: 1,
      insertText: "map($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Transforms each element of a list",
      detail: "list.map(var, expr) → list",
    },

    // Map Functions
    {
      label: "has",
      kind: 1,
      insertText: "has($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Tests whether a map contains a key",
      detail: "map.has(key) → bool",
    },

    // Type Conversion Functions
    {
      label: "int",
      kind: 2, // Function
      insertText: "int($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to int",
      detail: "int(value) → int",
    },
    {
      label: "uint",
      kind: 2,
      insertText: "uint($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to uint",
      detail: "uint(value) → uint",
    },
    {
      label: "double",
      kind: 2,
      insertText: "double($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to double",
      detail: "double(value) → double",
    },
    {
      label: "bool",
      kind: 2,
      insertText: "bool($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to bool",
      detail: "bool(value) → bool",
    },
    {
      label: "string",
      kind: 2,
      insertText: "string($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to string",
      detail: "string(value) → string",
    },
    {
      label: "bytes",
      kind: 2,
      insertText: "bytes($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to bytes",
      detail: "bytes(value) → bytes",
    },
    {
      label: "timestamp",
      kind: 2,
      insertText: "timestamp($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to timestamp",
      detail: "timestamp(value) → timestamp",
    },
    {
      label: "duration",
      kind: 2,
      insertText: "duration($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to duration",
      detail: "duration(value) → duration",
    },
    {
      label: "now",
      kind: 2,
      insertText: "now()",
      documentation: "Returns the current timestamp",
      detail: "now() → timestamp",
    },
    {
      label: "dyn",
      kind: 2,
      insertText: "dyn($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Converts to dynamic type",
      detail: "dyn(value) → dyn",
    },
    {
      label: "type",
      kind: 2,
      insertText: "type($0)",
      insertTextRules: 4, // InsertAsSnippet
      documentation: "Returns the type of a value",
      detail: "type(value) → type",
    },
  ],
};

// Define your hover documentation here
const HOVER_CONFIG: HoverConfig = {
  keywords: [
    // Resource object and fields
    {
      word: "resource",
      title: "resource",
      description:
        "The resource object with fields: kind, version, identifier, config, metadata, jobAgentId, createdAt, updatedAt",
    },
    {
      word: "kind",
      title: "kind",
      description: "The kind/type of the resource (string)",
    },
    {
      word: "version",
      title: "version",
      description: "The version of the resource (string)",
    },
    {
      word: "identifier",
      title: "identifier",
      description: "Unique identifier for the resource (string)",
    },
    {
      word: "config",
      title: "config",
      description: "Configuration data for the resource (record<string, any>)",
    },
    {
      word: "metadata",
      title: "metadata",
      description:
        "Key-value metadata for the resource (record<string, string>)",
    },
    {
      word: "jobAgentId",
      title: "jobAgentId",
      description: "ID of the job agent associated with this resource (string)",
    },
    {
      word: "createdAt",
      title: "createdAt",
      description: "Timestamp when the resource was created (Timestamp)",
    },
    {
      word: "updatedAt",
      title: "updatedAt",
      description: "Timestamp when the resource was last updated (Timestamp)",
    },
    // String method keywords
    {
      word: "toInt",
      title: "toInt",
      description: "Converts the string to an integer (string.toInt() → int)",
    },
    {
      word: "toDouble",
      title: "toDouble",
      description:
        "Converts the string to a double (string.toDouble() → double)",
    },
    // CEL function keywords
    {
      word: "now",
      title: "now",
      description: "Returns the current timestamp (now() → timestamp)",
    },
    {
      word: "size",
      title: "size",
      description: "Returns the size of a collection (size(collection) → int)",
    },
    {
      word: "type",
      title: "type",
      description: "Returns the type of a value (type(value) → type)",
    },
    {
      word: "duration",
      title: "duration",
      description:
        "Creates a duration from a string (duration(string) → duration)",
    },
    {
      word: "timestamp",
      title: "timestamp",
      description:
        "Creates a timestamp from a string (timestamp(string) → timestamp)",
    },
  ],
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate object keywords from enabled CEL objects
 */
function generateObjectKeywords(objects: CELObject[]): CompletionKeyword[] {
  return objects
    .filter((obj) => obj.enabled)
    .map((obj) => ({
      label: obj.name,
      kind: 5, // Variable
      insertText: obj.name,
      documentation: obj.documentation,
      detail: `{ ${obj.fields.map((f) => `${f.label}: ${f.type}`).join(", ")} }`,
    }));
}

/**
 * Generate string method suggestions
 */
function generateStringMethods(
  monaco: any,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  const MethodKind = monaco.languages.CompletionItemKind.Method;

  return [
    // Extended strings library, Version 1
    {
      label: "charAt",
      kind: MethodKind,
      insertText: "charAt($0)",
      insertTextRules: 4,
      documentation: "Returns the character at the specified index",
      detail: "string.charAt(int) → string",
      range,
    },
    {
      label: "indexOf",
      kind: MethodKind,
      insertText: "indexOf($0)",
      insertTextRules: 4,
      documentation: "Returns the index of the first occurrence of a substring",
      detail: "string.indexOf(string) → int",
      range,
    },
    {
      label: "lastIndexOf",
      kind: MethodKind,
      insertText: "lastIndexOf($0)",
      insertTextRules: 4,
      documentation: "Returns the index of the last occurrence of a substring",
      detail: "string.lastIndexOf(string) → int",
      range,
    },
    {
      label: "lowerAscii",
      kind: MethodKind,
      insertText: "lowerAscii()",
      documentation: "Converts ASCII characters to lowercase",
      detail: "string.lowerAscii() → string",
      range,
    },
    {
      label: "upperAscii",
      kind: MethodKind,
      insertText: "upperAscii()",
      documentation: "Converts ASCII characters to uppercase",
      detail: "string.upperAscii() → string",
      range,
    },
    {
      label: "replace",
      kind: MethodKind,
      insertText: "replace($0)",
      insertTextRules: 4,
      documentation: "Replaces all occurrences of a substring",
      detail: "string.replace(string, string) → string",
      range,
    },
    {
      label: "split",
      kind: MethodKind,
      insertText: "split($0)",
      insertTextRules: 4,
      documentation: "Splits a string by a separator",
      detail: "string.split(string) → list",
      range,
    },
    {
      label: "join",
      kind: MethodKind,
      insertText: "join($0)",
      insertTextRules: 4,
      documentation: "Joins a list of strings with a separator",
      detail: "list.join(string) → string",
      range,
    },
    {
      label: "substring",
      kind: MethodKind,
      insertText: "substring($0)",
      insertTextRules: 4,
      documentation: "Returns a substring",
      detail: "string.substring(int, int) → string",
      range,
    },
    {
      label: "trim",
      kind: MethodKind,
      insertText: "trim()",
      documentation: "Removes whitespace from both ends of a string",
      detail: "string.trim() → string",
      range,
    },
    // Standard CEL string methods
    {
      label: "contains",
      kind: MethodKind,
      insertText: "contains($0)",
      insertTextRules: 4,
      documentation: "Tests whether the string contains a substring",
      detail: "string.contains(string) → bool",
      range,
    },
    {
      label: "startsWith",
      kind: MethodKind,
      insertText: "startsWith($0)",
      insertTextRules: 4,
      documentation: "Tests whether the string starts with a prefix",
      detail: "string.startsWith(string) → bool",
      range,
    },
    {
      label: "endsWith",
      kind: MethodKind,
      insertText: "endsWith($0)",
      insertTextRules: 4,
      documentation: "Tests whether the string ends with a suffix",
      detail: "string.endsWith(string) → bool",
      range,
    },
    {
      label: "matches",
      kind: MethodKind,
      insertText: "matches($0)",
      insertTextRules: 4,
      documentation: "Tests whether the string matches a regular expression",
      detail: "string.matches(string) → bool",
      range,
    },
    {
      label: "size",
      kind: MethodKind,
      insertText: "size()",
      documentation: "Returns the length of the string",
      detail: "string.size() → int",
      range,
    },
    // Type conversion methods
    {
      label: "toInt",
      kind: MethodKind,
      insertText: "toInt()",
      documentation: "Converts the string to an integer",
      detail: "string.toInt() → int",
      range,
    },
    {
      label: "toDouble",
      kind: MethodKind,
      insertText: "toDouble()",
      documentation: "Converts the string to a double (floating point number)",
      detail: "string.toDouble() → double",
      range,
    },
  ];
}

/**
 * Generate field suggestions for an object
 */
function generateObjectFields(
  monaco: any,
  object: CELObject,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  const PropertyKind = monaco.languages.CompletionItemKind.Property;

  return object.fields.map((field) => ({
    label: field.label,
    kind: PropertyKind,
    insertText: field.label,
    documentation: field.documentation,
    detail: field.type,
    range,
  }));
}

/**
 * Check if text matches an object field pattern
 */
function matchObjectField(
  textBeforeCursor: string,
  objects: CELObject[],
): { object: CELObject; field?: string } | null {
  for (const object of objects) {
    if (!object.enabled) continue;

    // Match object.field pattern
    const fieldRegex = new RegExp(`\\b${object.name}\\.(\\w*)$`);
    const match = fieldRegex.exec(textBeforeCursor);

    if (match) {
      return { object, field: match[1] };
    }
  }
  return null;
}

/**
 * Check if text matches a string field pattern (for string methods)
 */
function matchStringField(
  textBeforeCursor: string,
  objects: CELObject[],
): boolean {
  for (const object of objects) {
    if (!object.enabled) continue;

    const stringFields = object.fields
      .filter((f) => f.isString)
      .map((f) => f.label);
    if (stringFields.length === 0) continue;

    const fieldsPattern = stringFields.join("|");
    const stringFieldRegex = new RegExp(
      `\\b${object.name}\\.(${fieldsPattern})\\.(\\w*)$`,
    );

    if (stringFieldRegex.test(textBeforeCursor)) {
      return true;
    }
  }
  return false;
}

// ==========================================
// HOOKS
// ==========================================

/**
 * Hook to register completion provider with Monaco
 */
function useCompletionProvider(
  monaco: any,
  language: string,
  config: CompletionConfig,
) {
  useEffect(() => {
    if (!monaco) return;

    const provider: Monaco.languages.CompletionItemProvider = {
      triggerCharacters: config.triggerCharacters,
      provideCompletionItems: (model, position) => {
        // Get the word being typed to provide proper replacement range
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: position.column,
        };

        const lineText = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineText.substring(0, position.column - 1);

        // Check if accessing a string field (e.g., resource.identifier.)
        if (matchStringField(textBeforeCursor, config.objects)) {
          return { suggestions: generateStringMethods(monaco, range) };
        }

        // Check if accessing an object field (e.g., resource.)
        const objectMatch = matchObjectField(textBeforeCursor, config.objects);
        if (objectMatch) {
          return {
            suggestions: generateObjectFields(
              monaco,
              objectMatch.object,
              range,
            ),
          };
        }

        // Default: show object keywords + CEL functions
        const objectKeywords = generateObjectKeywords(config.objects);
        const allKeywords = [...objectKeywords, ...config.keywords];
        const suggestions = allKeywords.map((keyword) => ({
          ...keyword,
          range,
        }));

        return { suggestions };
      },
    };

    const disposable = monaco.languages.registerCompletionItemProvider(
      language,
      provider,
    );

    return () => {
      disposable.dispose();
    };
  }, [monaco, language, config]);
}

/**
 * Hook to register hover provider with Monaco
 */
function useHoverProvider(monaco: any, language: string, config: HoverConfig) {
  useEffect(() => {
    if (!monaco) return;

    const keywordMap = new Map(config.keywords.map((k) => [k.word, k]));

    const provider: Monaco.languages.HoverProvider = {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return { contents: [] };

        const keyword = keywordMap.get(word.word);
        if (!keyword) return { contents: [] };

        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [
            { value: `**${keyword.title}** — Ctrlplane helper` },
            { value: keyword.description },
          ],
        };
      },
    };

    const disposable = monaco.languages.registerHoverProvider(
      language,
      provider,
    );

    return () => {
      disposable.dispose();
    };
  }, [monaco, language, config]);
}

/**
 * Hook to register inline completion provider (ghost text)
 */
function useInlineCompletions(monaco: any, language: string) {
  useEffect(() => {
    if (!monaco) return;

    const provider = {
      provideInlineCompletions: (
        model: any,
        position: any,
        _context: any,
        _token: any,
      ) => {
        const items: any[] = [];

        // Look-ahead: suggest next token on the same line
        const lineText = model.getLineContent(position.lineNumber);
        const afterCursor = lineText.slice(position.column - 1);
        const nextTokenMatch = /^[\s]*([\w$.-]+)(.*)$/.exec(afterCursor);

        if (nextTokenMatch?.[1]) {
          const nextToken = nextTokenMatch[1];
          items.push({
            insertText: nextToken,
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column,
            ),
          });

          // Also suggest with trailing punctuation
          const tail = nextTokenMatch[2] || "";
          const punctMatch = /^\s*([,);\]])/.exec(tail);
          if (punctMatch?.[1]) {
            const punct = punctMatch[1];
            items.push({
              insertText: nextToken + punct,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column,
              ),
            });
          }
        }

        // Context-aware: suggest completions from earlier in the file
        const word = model.getWordUntilPosition(position);
        if (word?.word && word.word.length > 2) {
          const fullText = model.getValue();
          const re = new RegExp(
            `\\b${escapeRegExp(word.word)}([/._-][A-Za-z0-9_-]+)?`,
            "g",
          );
          const seen = new Set<string>();
          let m: RegExpExecArray | null;
          let safety = 0;

          while ((m = re.exec(fullText)) != null && safety < 50) {
            safety++;
            const candidate = m[0];
            if (
              candidate &&
              !seen.has(candidate) &&
              candidate.length > word.word.length
            ) {
              seen.add(candidate);
              items.push({
                insertText: candidate.slice(word.word.length),
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column,
                ),
              });
            }
          }
        }

        return { items, dispose: () => {} };
      },
      freeInlineCompletions: () => {},
    };

    const disposable = monaco.languages.registerInlineCompletionsProvider(
      language,
      provider,
    );

    return () => {
      disposable.dispose();
    };
  }, [monaco, language]);
}

/**
 * Hook to configure editor options on mount
 */
function useEditorSetup() {
  const handleMount: OnMount = useCallback((editor, _monacoInstance) => {
    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: "off",
      // Enable suggestions for custom completions
      suggestOnTriggerCharacters: true,
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true,
      },
      // Disable word-based suggestions (default JS IntelliSense)
      wordBasedSuggestions: "off",
      parameterHints: { enabled: false },
      // Keep custom inline suggestions enabled
      inlineSuggest: { enabled: true },
      tabCompletion: "on",
      renderWhitespace: "selection",
      smoothScrolling: true,
    });
  }, []);

  return handleMount;
}

// ==========================================
// MAIN COMPONENT
// ==========================================

/**
 * CelExpressionInput
 * - Monaco editor with custom autocomplete and hover docs
 * - Inline ghost-text suggestions
 * - Easy to customize via COMPLETION_CONFIG and HOVER_CONFIG
 */
export default function CelExpressionInput({
  language = "cel",
  value,
  onChange,
  height = "60vh",
  placeholder,
}: {
  language?: string;
  value?: string;
  onChange?: (v?: string) => void;
  height?: string | number;
  placeholder?: string;
}) {
  const monaco = useMonaco();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const handleMount = useEditorSetup();

  // Register CEL language with JavaScript-like syntax highlighting
  React.useEffect(() => {
    if (!monaco) return;

    // Register CEL language if not already registered
    const languages = monaco.languages.getLanguages();
    if (!languages.find((lang) => lang.id === "cel")) {
      monaco.languages.register({ id: "cel" });

      // Set up JavaScript-like syntax highlighting
      monaco.languages.setMonarchTokensProvider("cel", {
        tokenizer: {
          root: [
            [/"([^"\\]|\\.)*$/, "string.invalid"], // non-terminated string
            [/'([^'\\]|\\.)*$/, "string.invalid"], // non-terminated string
            [/"/, "string", "@string_double"],
            [/'/, "string", "@string_single"],
            [/\d+\.\d+/, "number.float"],
            [/\d+/, "number"],
            [/[{}()[\]]/, "@brackets"],
            [/[<>](?!@symbols)/, "@brackets"],
            [/@symbols/, "delimiter"],
            [/[a-zA-Z_]\w*/, "identifier"],
          ],
          string_double: [
            [/[^\\"]+/, "string"],
            [/\\./, "string.escape"],
            [/"/, "string", "@pop"],
          ],
          string_single: [
            [/[^\\']+/, "string"],
            [/\\./, "string.escape"],
            [/'/, "string", "@pop"],
          ],
        },
        symbols: /[=><!~?:&|+\-*/^%]+/,
      });
    }
  }, [monaco]);

  // Register all Monaco providers
  useCompletionProvider(monaco, language, COMPLETION_CONFIG);
  useHoverProvider(monaco, language, HOVER_CONFIG);
  useInlineCompletions(monaco, language);

  return (
    <div className="w-full">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange?.(v)}
        onMount={(editor, monacoInstance) => {
          editorRef.current = editor;
          handleMount(editor, monacoInstance);

          // Add placeholder support
          if (placeholder) {
            const placeholderDecorations = editor.createDecorationsCollection(
              [],
            );

            const updatePlaceholder = () => {
              const model = editor.getModel();
              if (model && model.getValue() === "") {
                placeholderDecorations.set([
                  {
                    range: new monacoInstance.Range(1, 1, 1, 1),
                    options: {
                      after: {
                        content: placeholder,
                        inlineClassName: "placeholder-text",
                      },
                      showIfCollapsed: true,
                    },
                  },
                ]);
              } else {
                placeholderDecorations.clear();
              }
            };

            updatePlaceholder();
            editor.onDidChangeModelContent(updatePlaceholder);
          }
        }}
        options={{
          // Enable inline suggestions
          inlineSuggest: { enabled: true },
          // Configure suggestion behavior
          acceptSuggestionOnEnter: "smart",
          suggestSelection: "first",
        }}
      />
      <style>{`
        .placeholder-text {
          opacity: 0.5;
          color: #6b7280;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

// ==========================================
// UTILITIES
// ==========================================

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
