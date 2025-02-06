"use client";

import React, { useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import colors from "tailwindcss/colors";

const defaultBash = `echo "Releasing {{ .release.version }} on {{ .resource.name }}"
`;

const defaultPowerShell = `Write-Host "Releasing $([string]{{ .release.version }}) on $([string]{{ .resource.name }})"
`;

export const JobAgentScriptConfig: React.FC<{
  type: "shell" | "powershell";
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}> = ({ type, value, onChange }) => {
  useEffect(() => {
    loader.init().then((monaco) => {
      monaco.editor.defineTheme("vs-dark-custom", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": colors.neutral[950],
        },
      });
    });
  }, []);

  useEffect(() => {
    if (value.script == null) {
      onChange({ script: type === "shell" ? defaultBash : defaultPowerShell });
    }
  }, [type, value, onChange]);

  return (
    <div className="p-2">
      <Editor
        height="500px"
        defaultLanguage={type}
        value={value.script}
        theme="vs-dark-custom"
        onChange={(v) => onChange({ script: v })}
      />
    </div>
  );
};
