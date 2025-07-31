export class WorkspaceEngine {
  constructor() {}

  async readMessage(message: unknown) {
    console.log(message);
    return Promise.resolve();
  }
}
