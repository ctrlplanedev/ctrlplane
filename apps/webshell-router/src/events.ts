interface EventShellData {
  type: "shell/data";
  clientId: string;
  instanceId: string;
  data: string;
}

export const isEventShellData = (event: any): event is EventShellData =>
  event.type === "shell/data";

interface EventShellCreate {
  type: "shell/create";
  clientId: string;
  instanceId: string;
}

export const isEventShellCreate = (event: any): event is EventShellCreate =>
  event.type === "shell/create";
