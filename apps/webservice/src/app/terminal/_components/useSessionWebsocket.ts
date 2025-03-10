import { useState } from "react";
import useWebSocket from "react-use-websocket";

export const useSessionWebsocket = (sessionId: string) => {
  const [terminalContent, setTerminalContent] = useState("");
  const { getWebSocket, readyState } = useWebSocket(
    `/api/v1/resources/proxy/session/${sessionId}`,
    {
      shouldReconnect: () => true,
      onMessage: (e) => {
        const decoder = new TextDecoder();
        const text: string =
          e.data instanceof ArrayBuffer
            ? decoder.decode(e.data)
            : // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              e.data.toString();
        setTerminalContent((prev) => {
          // eslint-disable-next-line no-control-regex
          const newContent = prev + text.replace(/\x1B\[[0-9;]*m/g, "");
          return newContent.slice(-1000);
        });
      },
    },
  );

  const [isLoading, setIsLoading] = useState(false);
  const prompt = async (prompt: string) => {
    setIsLoading(true);
    const res = await fetch("/api/v1/ai/command", {
      method: "POST",
      body: JSON.stringify({ prompt, history: terminalContent }),
    });

    const { text } = await res.json();

    const ws = getWebSocket();
    if (ws && "send" in ws) {
      const ctrlUSequence = new Uint8Array([0x15]); // Ctrl+U to delete line
      ws.send(ctrlUSequence);
      ws.send(text);
    }
    setIsLoading(false);
  };

  return { terminalContent, readyState, getWebSocket, isLoading, prompt };
};
