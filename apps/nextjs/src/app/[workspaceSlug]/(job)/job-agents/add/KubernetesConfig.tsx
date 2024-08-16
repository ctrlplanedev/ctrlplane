"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

export const KubernetesJobDeploy: React.FC = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kubernetes job agent config</CardTitle>
        <CardDescription>
          Configure a kubernetes job agent to dispatch your runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre>helm repo add ctrlplane https://charts.ctrlplane.dev</pre>
        <pre>
          <p>helm upgrade --install</p>
          <p className="pl-10">--set workspace={workspaceSlug}</p>
          <p className="pl-10">
            --set name=
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-[200px] bg-transparent placeholder:italic placeholder:text-red-400"
              placeholder="JOB AGENT NAME"
            />
          </p>
          <p className="pl-10">
            --set apiKey=
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent placeholder:italic placeholder:text-red-400"
              placeholder="API KEY"
            />
          </p>
          <p className="pl-10">job agent ctrlplane/agent</p>
        </pre>
      </CardContent>
    </Card>
  );
};
