"use client";

import type { Resource } from "@ctrlplane/db/schema";
import type { Terminal as XTerminal } from "@xterm/xterm";
import { useRef, useState } from "react";
import { ReadyState } from "react-use-websocket";

import SocketTerminal from "~/components/xterm/SessionTerminal";
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
import { useControllerWebsocket } from "./useControllerWebsocket";
import { useSessionWebsocket } from "./useSessionWebsocket";

const Terminal: React.FC<{
  resource: Resource;
  sessionId: string;
}> = ({ resource, sessionId }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const promptInput = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const { prompt, getWebSocket, readyState, isLoading } =
    useSessionWebsocket(sessionId);

  const { resizeSession } = useControllerWebsocket();

  const handleSubmit = (text: string) => {
    if (text.length === 0) {
      terminalRef.current?.focus();
      return;
    }
    prompt(text);
  };

  return (
    <div className="h-[100vh] w-[100vw]">
      {readyState === ReadyState.OPEN && (
        <>
          <SocketTerminal
            terminalRef={terminalRef}
            getWebSocket={getWebSocket}
            readyState={readyState}
            sessionId={sessionId}
            onResize={({ cols, rows }) =>
              resizeSession(sessionId, resource.id, cols, rows)
            }
          />
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

export default Terminal;