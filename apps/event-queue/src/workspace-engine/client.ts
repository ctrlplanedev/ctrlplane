import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";

import { createSpanWrapper } from "../traces.js";
import { ReleaseTargetService } from "./gen/release_targets_pb.js";
import { getUrl } from "./url.js";

const createTransport = async (workspaceId: string) => {
  const baseUrl = await getUrl(workspaceId);
  const transport = createConnectTransport({
    baseUrl: `http://${baseUrl}`,
    httpVersion: "2",
  });
  return transport;
};

export const client = createSpanWrapper(
  "client",
  async (_, workspaceId: string) => {
    const transport = await createTransport(workspaceId);

    const releaseTarget = createClient(ReleaseTargetService, transport);

    return { releaseTarget };
  },
);
