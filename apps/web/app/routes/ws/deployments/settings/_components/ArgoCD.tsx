import type { UseFormReturn } from "react-hook-form";
import Editor from "@monaco-editor/react";
import yaml from "js-yaml";
import { z } from "zod";

import { useTheme } from "~/components/ThemeProvider";
import { FormField } from "~/components/ui/form";

// Example default ArgoCD Application YAML config shown if the config is empty
const DEFAULT_CONFIG = {
  apiVersion: "argoproj.io/v1alpha1",
  kind: "Application",
  metadata: {
    name: "{{.Resource.Name}}-application",
    namespace: "argocd",
    labels: {
      "app.kubernetes.io/name": "{{.Resource.Name}}",
      environment: "{{.Environment.Name}}",
      deployment: "{{.Deployment.Name}}",
      resource: "{{.Resource.Name}}",
    },
  },
  spec: {
    project: "default",
    source: {
      repoURL: "https://github.com/YOUR_ORG/YOUR_REPO.git",
      path: "YOUR_PATH_IN_REPO",
      targetRevision: "HEAD",
      helm: {
        releaseName: "{{.Resource.Name}}",
      },
    },
    destination: {
      name: "{{.Resource.Identifier}}",
      namespace: "default",
    },
    syncPolicy: {
      automated: {
        prune: true,
        selfHeal: true,
      },
      syncOptions: ["CreateNamespace=true"],
    },
  },
};

const formSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: z.record(z.any()),
});

function getConfigString(config: Record<string, any>): string {
  const template = config.template ?? "";
  if (template && template.trim()) return template;
  return yaml.dump(DEFAULT_CONFIG);
}

type Form = UseFormReturn<z.infer<typeof formSchema>>;

type ArgoCDConfigProps = { form: Form };

export function ArgoCDConfig({ form }: ArgoCDConfigProps) {
  const { theme } = useTheme();

  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.register({ id: "helm" });
    monaco.languages.setMonarchTokensProvider("helm", {
      tokenizer: {
        root: [
          [/\{\{-?\s*/, "delimiter.template"],
          [/\s*-?\}\}/, "delimiter.template"],
          [/\$[a-zA-Z_]\w*/, "variable.template"],
          [/\.[a-zA-Z_]\w*/, "variable.predefined.template"],
          [
            /\b(if|else|end|with|range|define|template|block|and|or|not)\b/,
            "keyword.template",
          ],
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/'([^'\\]|\\.)*$/, "string.invalid"],
          [/"/, "string", "@string_double"],
          [/'/, "string", "@string_single"],
          [/\d+/, "number"],
          [/^[\w-]+:/, "key"],
          [/#.*$/, "comment"],
        ],
        string_double: [
          [/[^\\"]+/, "string"],
          [/"/, "string", "@pop"],
        ],
        string_single: [
          [/[^\\']+/, "string"],
          [/'/, "string", "@pop"],
        ],
      },
    });

    monaco.languages.setLanguageConfiguration("helm", {
      comments: {
        lineComment: "#",
      },
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
    });

    monaco.editor.defineTheme("helm-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        {
          token: "delimiter.template",
          foreground: "C792EA",
          fontStyle: "bold",
        },
        { token: "variable.template", foreground: "82AAFF" },
        { token: "variable.predefined.template", foreground: "89DDFF" },
        { token: "keyword.template", foreground: "C792EA", fontStyle: "bold" },
        { token: "key", foreground: "FFCB6B" },
        { token: "string", foreground: "C3E88D" },
        { token: "number", foreground: "F78C6C" },
        { token: "comment", foreground: "546E7A", fontStyle: "italic" },
      ],
      colors: {},
    });

    monaco.editor.defineTheme("helm-light", {
      base: "vs",
      inherit: true,
      rules: [
        {
          token: "delimiter.template",
          foreground: "7C4DFF",
          fontStyle: "bold",
        },
        { token: "variable.template", foreground: "0277BD" },
        { token: "variable.predefined.template", foreground: "00838F" },
        { token: "keyword.template", foreground: "7C4DFF", fontStyle: "bold" },
        { token: "key", foreground: "F76D47" },
        { token: "string", foreground: "22863A" },
        { token: "number", foreground: "E5534B" },
        { token: "comment", foreground: "90A4AE", fontStyle: "italic" },
      ],
      colors: {},
    });
  };

  return (
    <FormField
      control={form.control}
      name="jobAgentConfig"
      render={({ field: { value, onChange } }) => {
        const configString = getConfigString(value);

        const handleChange = (newValue: string) =>
          onChange({ template: newValue });

        return (
          <div className="border">
            <Editor
              language="helm"
              theme={theme === "dark" ? "helm-dark" : "helm-light"}
              beforeMount={handleEditorWillMount}
              options={{
                minimap: { enabled: false },
              }}
              value={configString}
              onChange={(newValue) => handleChange(newValue ?? "")}
              height="600px"
            />
          </div>
        );
      }}
    />
  );
}
