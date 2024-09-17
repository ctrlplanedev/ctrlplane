"use client";

import React, { useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import colors from "tailwindcss/colors";

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
  name: {{ release.version }}-{{ target.name }} # Unique ID for the job
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

export const JobAgentKubernetesConfig: React.FC<{
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
