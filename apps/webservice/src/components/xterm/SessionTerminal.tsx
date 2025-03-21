/* eslint-disable react-compiler/react-compiler */
"use client";
"use no memo";

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttachAddon } from "@xterm/addon-attach";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";

import "@xterm/xterm/css/xterm.css";

import type { WebSocketLike } from "react-use-websocket/dist/lib/types";
import { useDebounce, useSize } from "react-use";
import { ReadyState } from "react-use-websocket";

export const useSessionTerminal = (
  terminalRef: MutableRefObject<Terminal | null>,
  getWebsocket: () => WebSocketLike | null,
  readyState: ReadyState,
) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [fitAddon] = useState(new FitAddon());

  const reloadTerminal = useCallback(() => {
    if (readyState !== ReadyState.OPEN) return;
    if (divRef.current == null) return;

    const ws = getWebsocket();
    if (ws == null) return;

    terminalRef.current?.dispose();

    const terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      disableStdin: false,
      fontSize: 14,
    });
    terminal.open(divRef.current);
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new SearchAddon());
    terminal.loadAddon(new ClipboardAddon());
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new AttachAddon(getWebsocket() as WebSocket));
    terminal.loadAddon(new Unicode11Addon());
    terminal.loadAddon(new WebglAddon());
    terminal.unicode.activeVersion = "11";
    terminalRef.current = terminal;
    return terminal;
  }, [fitAddon, getWebsocket, readyState, terminalRef]);

  useEffect(() => {
    if (divRef.current == null) return;
    if (readyState !== ReadyState.OPEN) return;
    terminalRef.current?.dispose();
    reloadTerminal();
    fitAddon.fit();
  }, [fitAddon, readyState, reloadTerminal, terminalRef]);

  return { terminalRef, divRef, fitAddon, reloadTerminal };
};

const SocketTerminal: React.FC<{
  terminalRef: MutableRefObject<Terminal | null>;
  getWebSocket: () => WebSocketLike | null;
  onResize?: (size: {
    width: number;
    height: number;
    cols: number;
    rows: number;
  }) => void;
  readyState: ReadyState;
  sessionId: string;
}> = ({ getWebSocket, readyState, onResize, terminalRef }) => {
  const { divRef, fitAddon } = useSessionTerminal(
    terminalRef,
    getWebSocket,
    readyState,
  );

  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    const term = terminalRef.current;
    if (term == null) return;

    term.focus();
    fitAddon.fit();
    setTimeout(() => {
      const { cols, rows } = term;
      onResize?.({ width, height, cols, rows });
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getWebSocket, terminalRef, fitAddon, readyState]);

  const [sized, { width, height }] = useSize(
    () => (
      <div className="h-full w-full">
        <div ref={divRef} className="h-full w-full" />
      </div>
    ),
    { width: 100, height: 100 },
  );

  useDebounce(
    () => {
      const term = terminalRef.current;
      if (term == null) return;
      fitAddon.fit();
      setTimeout(() => {
        const { cols, rows } = term;
        onResize?.({ width, height, cols, rows });
      }, 0);
    },
    250,
    [width, height],
  );

  return sized;
};

export default SocketTerminal;
