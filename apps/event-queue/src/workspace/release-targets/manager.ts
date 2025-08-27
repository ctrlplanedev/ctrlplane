type ReleaseTargetManagerOptions = {
  workspaceId: string;
};

export class ReleaseTargetManager {
  constructor(private opts: ReleaseTargetManagerOptions) {}
}
