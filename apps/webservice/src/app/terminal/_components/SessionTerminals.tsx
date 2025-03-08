"use client";

import type { Terminal } from "@xterm/xterm";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ReadyState } from "react-use-websocket";

import { cn } from "@ctrlplane/ui";

import {
  CommandFooter,
  CommandPrompt,
  CommandPromptCloseButton,
  CommandPromptForm,
  CommandPromptHeader,
  CommandPromptInput,
  CommandPromptLoader,
  CommandPromptSubmitButton,
} from "./CommandPrompt";
import { useTerminalSessions } from "./TerminalSessionsProvider";
import { useSessionWebsocket } from "./useSessionWebsocket";

const SocketTerminal = dynamic(
  () => import("~/components/xterm/SessionTerminal"),
  { ssr: false },
);

const SessionTerminal: React.FC<{ sessionId: string; resourceId: string }> = ({
  sessionId,
  resourceId,
}) => {
  const terminalRef = useRef<Terminal | null>(null);

  const { prompt, getWebSocket, readyState, isLoading } =
    useSessionWebsocket(sessionId);

  const { resizeSession } = useTerminalSessions();

  const promptInput = useRef<HTMLInputElement>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleSubmit = (text: string) => {
    if (text.length === 0) {
      terminalRef.current?.focus();
      return;
    }
    prompt(text);
  };

  return (
    <div className="relative h-full">
      {readyState === ReadyState.OPEN && (
        <>
          <div className="h-[calc(100%-30px)]">
            <SocketTerminal
              terminalRef={terminalRef}
              getWebSocket={getWebSocket}
              readyState={readyState}
              sessionId={sessionId}
              onResize={({ cols, rows }) =>
                resizeSession(sessionId, resourceId, cols, rows)
              }
            />
          </div>
          {!showPrompt && (
            <div className="text-[0.02em] text-neutral-500">
              ⌘K to generate a command
            </div>
          )}
        </>
      )}
      <div
        className={`absolute bottom-0 left-0 right-0 z-40 p-2 ${!showPrompt ? "hidden" : ""}`}
      >
        <CommandPrompt
          onOpen={() => {
            setShowPrompt(true);
            window.requestAnimationFrame(() => {
              promptInput.current?.focus();
            });
          }}
          onClose={() => {
            setShowPrompt(false);
            window.requestAnimationFrame(() => {
              terminalRef.current?.focus();
            });
          }}
          isLoading={isLoading}
        >
          <CommandPromptCloseButton />
          <CommandPromptForm onSubmit={handleSubmit}>
            <CommandPromptHeader>
              <CommandPromptInput ref={promptInput} />
            </CommandPromptHeader>

            <CommandFooter>
              <CommandPromptSubmitButton />
              <CommandPromptLoader />
            </CommandFooter>
          </CommandPromptForm>
        </CommandPrompt>
      </div>
    </div>
  );
};

export const SessionTerminals: React.FC = () => {
  const { sessionIds, activeSessionId } = useTerminalSessions();
  return (
    <>
      {sessionIds.map((s) => (
        <div
          key={s.sessionId}
          className={cn(
            "h-full px-4",
            activeSessionId !== s.sessionId && "hidden",
          )}
        >
          <SessionTerminal {...s} />
        </div>
      ))}
    </>
  );
};
