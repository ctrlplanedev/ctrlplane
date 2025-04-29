"use client";

import React, { useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import colors from "tailwindcss/colors";

import { Button } from "@ctrlplane/ui/button";

const defaultBash = `echo "Releasing {{ .release.version }} on {{ .resource.name }}"
`;

const defaultPowerShell = `Write-Host "Releasing $([string]{{ .release.version }}) on $([string]{{ .resource.name }})"
`;

export const JobAgentScriptConfig: React.FC<{
  type: "shell" | "powershell";
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  disabled?: boolean;
}> = ({ type, value, onChange, disabled = false }) => {
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
    <div className="w-full space-y-4 p-2">
      <Editor
        height="500px"
        defaultLanguage={type}
        value={value.script}
        theme="vs-dark-custom"
        onChange={(v) => onChange({ script: v })}
      />
      <Button type="submit" disabled={disabled}>
        Save
      </Button>
    </div>
  );
};
