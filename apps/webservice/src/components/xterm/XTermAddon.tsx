import type { SessionInput } from "@ctrlplane/validators/session";
import type { IDisposable, ITerminalAddon, Terminal } from "@xterm/xterm";

import { sessionOutput } from "@ctrlplane/validators/session";

interface IAttachOptions {
  ws: WebSocket;
  sessionId: string;
  targetId: string;
  bidirectional?: boolean;
}

export class AttachAddon implements ITerminalAddon {
  private _socket: WebSocket;
  private _bidirectional: boolean;
  private _disposables: IDisposable[] = [];

  constructor(private options: IAttachOptions) {
    this._socket = options.ws;
    this._socket.binaryType = "arraybuffer";
    this._bidirectional = options.bidirectional ?? true;
  }

  public activate(terminal: Terminal): void {
    this._disposables.push(
      addSocketListener(this._socket, "message", (ev) => {
        const data: ArrayBuffer | string = ev.data;
        const stringData =
          typeof data === "string" ? ev.data : new TextDecoder().decode(data);
        const obj = JSON.parse(stringData);
        const output = sessionOutput.parse(obj);
        terminal.write(output.data);
      }),
    );

    if (this._bidirectional) {
      this._disposables.push(terminal.onData((data) => this._sendData(data)));
      this._disposables.push(
        terminal.onBinary((data) => this._sendBinary(data)),
      );
    }

    this._disposables.push(
      addSocketListener(this._socket, "close", () => this.dispose()),
    );
    this._disposables.push(
      addSocketListener(this._socket, "error", () => this.dispose()),
    );
  }

  public dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
  }

  private _sendData(data: string): void {
    if (!this._checkOpenSocket()) {
      return;
    }

    const input: SessionInput = {
      type: "session.input",
      sessionId: this.options.sessionId,
      targetId: this.options.targetId,
      data,
    };

    this._socket.send(JSON.stringify(input));
  }

  private _sendBinary(data: string): void {
    if (!this._checkOpenSocket()) return;

    const buffer = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) buffer[i] = data.charCodeAt(i) & 255;

    const input: SessionInput = {
      type: "session.input",
      targetId: this.options.targetId,
      sessionId: this.options.sessionId,
      data: String.fromCharCode.apply(null, Array.from(buffer)),
    };

    this._socket.send(JSON.stringify(input));
  }

  private _checkOpenSocket(): boolean {
    switch (this._socket.readyState) {
      case WebSocket.OPEN:
        return true;
      case WebSocket.CONNECTING:
        throw new Error("Attach addon was loaded before socket was open");
      case WebSocket.CLOSING:
        console.warn("Attach addon socket is closing");
        return false;
      case WebSocket.CLOSED:
        throw new Error("Attach addon socket is closed");
      default:
        throw new Error("Unexpected socket state");
    }
  }
}

function addSocketListener<K extends keyof WebSocketEventMap>(
  socket: WebSocket,
  type: K,
  handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
): IDisposable {
  socket.addEventListener(type, handler);
  return {
    dispose: () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!handler) {
        // Already disposed
        return;
      }
      socket.removeEventListener(type, handler);
    },
  };
}
