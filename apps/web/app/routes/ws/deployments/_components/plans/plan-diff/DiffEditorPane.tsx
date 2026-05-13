import { DiffEditor } from "@monaco-editor/react";

import { useTheme } from "~/components/ThemeProvider";

export function DiffEditorPane({
  current,
  proposed,
  view,
}: {
  current: string;
  proposed: string;
  view: "split" | "unified";
}) {
  const { theme } = useTheme();
  return (
    <DiffEditor
      height="100%"
      language="yaml"
      theme={theme === "dark" ? "vs-dark" : "vs"}
      original={current}
      modified={proposed}
      options={{
        readOnly: true,
        renderSideBySide: view === "split",
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        hideUnchangedRegions: {
          enabled: true,
          contextLineCount: 3,
          minimumLineCount: 3,
          revealLineCount: 20,
        },
      }}
    />
  );
}
