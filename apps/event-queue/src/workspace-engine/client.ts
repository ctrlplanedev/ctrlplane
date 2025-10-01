import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";

import { ReleaseTargetService } from "./gen/release_targets_pb.js";
import { getUrl } from "./url.js";

const createTransport = async (workspaceId: string) => {
  const baseUrl = await getUrl(workspaceId);
  const transport = createGrpcTransport({ baseUrl });
  return transport;
};

export const releaseTargetClient = async (workspaceId: string) => {
  const transport = await createTransport(workspaceId);

  const releaseTarget = createClient(ReleaseTargetService, transport);

  return { releaseTarget };
};
