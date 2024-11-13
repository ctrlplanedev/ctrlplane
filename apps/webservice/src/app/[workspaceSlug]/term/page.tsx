"use client";

import type { SessionCreate } from "@ctrlplane/validators/session";
import { useState } from "react";
import dynamic from "next/dynamic";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@ctrlplane/ui/button";

const Terminal = dynamic(
  () => import("./Terminal").then((mod) => mod.SessionTerminal),
  { ssr: false },
);
export default function TermPage() {
  const { sendJsonMessage, readyState } = useWebSocket(
    "/api/v1/target/proxy/controller",
  );
  const [targetId] = useState("f8610471-5077-4fb3-8c93-f82f7301bb2f");

  const [sessionId, setSessionId] = useState("");
  const createSession = () => {
    const sessionId = uuidv4();
    const sessionCreatePayload: SessionCreate = {
      type: "session.create",
      targetId,
      sessionId,
      cols: 80,
      rows: 24,
    };
    sendJsonMessage(sessionCreatePayload);
    setSessionId(sessionId);
  };

  return (
    <div className="h-full w-full">
      <Button onClick={createSession}>Create Session</Button>

      {readyState === ReadyState.OPEN && sessionId !== "" && (
        <Terminal sessionId={sessionId} />
      )}
    </div>
  );
}
