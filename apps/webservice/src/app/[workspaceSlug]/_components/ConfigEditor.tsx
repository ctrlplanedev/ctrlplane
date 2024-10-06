"use client";

import React, { useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import colors from "tailwindcss/colors";

import { Card } from "@ctrlplane/ui/card";

export const ConfigEditor: React.FC<{
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}> = ({ readOnly, value, onChange }) => {
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
  return (
    <Card>
      <div className="p-2">
        <Editor
          height="200px"
          defaultLanguage="yaml"
          value={value}
          theme="vs-dark-custom"
          onChange={(v) => onChange?.(v ?? "")}
          options={{ readOnly }}
        />
      </div>
    </Card>
  );
};
