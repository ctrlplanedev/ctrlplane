"use client";

import React, { useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import colors from "tailwindcss/colors";

import { Input } from "@ctrlplane/ui/input";

import { useMatchSorterWithSearch } from "~/app/[workspaceSlug]/_components/useMatchSorter";

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

const defaultManifest = `apiVersion: batch/v1
kind: Job
metadata:
  name: {{ release.version }}-{{ target.name }} # Unique ID for the jobExecution
  namespace: ctrlplane
spec:
  ttlSecondsAfterFinished: 120
  backoffLimit: 4
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: example
        image: busybox
        args:
        - /bin/sh
        - -c
        - |
          echo "Hello Kubernetes! Releasing {{ release.version }} on {{ target.name }}"
          SLEEP_TIME=$(shuf -i 60-180 -n 1)
          echo "Sleeping for $SLEEP_TIME seconds."
          sleep $SLEEP_TIME
          echo "Completed sleep."
`;

export const ConfigureJobAgentKubernetesJob: React.FC<{
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}> = ({ value, onChange }) => {
  useEffect(() => {
    if (value.manifest == null) {
      onChange({ manifest: defaultManifest });
    }
  }, [value, onChange]);
  return (
    <div className="p-2">
      <Editor
        height="500px"
        defaultLanguage="yaml"
        value={value.manifest}
        theme="vs-dark-custom"
        onChange={(v) => onChange({ manifest: v })}
      />
    </div>
  );
};

const variableOptions = [
  { key: "release.version", description: "Release Version" },
  { key: "release.id", description: "Release ID" },
  { key: "target.name", description: "Target Name" },
  { key: "target.id", description: "Target ID" },
  { key: "environment.name", description: "Environment Name" },
  { key: "environment.id", description: "Environment" },
  { key: "system.name", description: "System Name" },
  { key: "system.id", description: "System ID" },
  { key: "workspace.name", description: "Workspace Name" },
  { key: "workspace.id", description: "Workspace ID" },
  { key: "execution.id", description: "Execution ID" },
  {
    key: "execution.externalRunId",
    description: "Execution External Run ID",
  },
  { key: "execution.status", description: "Execution Status" },
  { key: "execution.message", description: "Execution Message" },
];

export const VariablesList: React.FC = () => {
  const { search, setSearch, result } = useMatchSorterWithSearch(
    variableOptions,
    { keys: ["key", "description"] },
  );
  return (
    <div>
      <div className="border-b p-6">
        <h3 className="font-semibold">Variables</h3>
      </div>

      <div className="border-b">
        <Input
          className="rounded-none border-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
        />
      </div>
      <div className="p-6">
        <table className="text-sm">
          <tbody>
            {result.map((variable) => (
              <tr key={variable.key}>
                <td className="pr-2">{variable.description}</td>
                <td className="font-mono">{variable.key}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
