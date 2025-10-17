import type * as schema from "@ctrlplane/db/schema";
import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import type { GoEventPayload, GoMessage } from "../events.js";
import { createSpanWrapper } from "../../span.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";

const getOapiJobAgent = (
  jobAgent: schema.JobAgent,
): WorkspaceEngine["schemas"]["JobAgent"] => ({
  id: jobAgent.id,
  workspaceId: jobAgent.workspaceId,
  name: jobAgent.name,
  type: jobAgent.type,
  config: jobAgent.config,
});

const convertJobAgentToGoEvent = (
  jobAgent: schema.JobAgent,
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId: jobAgent.workspaceId,
  eventType,
  data: getOapiJobAgent(jobAgent),
  timestamp: Date.now(),
});

export const dispatchJobAgentCreated = createSpanWrapper(
  "dispatchJobAgentCreated",
  async (span: Span, jobAgent: schema.JobAgent) => {
    span.setAttribute("job-agent.id", jobAgent.id);
    span.setAttribute("job-agent.workspaceId", jobAgent.workspaceId);
    span.setAttribute("job-agent.name", jobAgent.name);
    span.setAttribute("job-agent.type", jobAgent.type);
    span.setAttribute(
      "job-agent.config",
      JSON.stringify(jobAgent.config, null, 2),
    );

    await sendGoEvent(
      convertJobAgentToGoEvent(jobAgent, Event.JobAgentCreated),
    );
  },
);

export const dispatchJobAgentUpdated = createSpanWrapper(
  "dispatchJobAgentUpdated",
  async (span: Span, jobAgent: schema.JobAgent) => {
    span.setAttribute("job-agent.id", jobAgent.id);
    span.setAttribute("job-agent.workspaceId", jobAgent.workspaceId);
    span.setAttribute("job-agent.name", jobAgent.name);
    span.setAttribute("job-agent.type", jobAgent.type);
    span.setAttribute(
      "job-agent.config",
      JSON.stringify(jobAgent.config, null, 2),
    );

    await sendGoEvent(
      convertJobAgentToGoEvent(jobAgent, Event.JobAgentUpdated),
    );
  },
);

export const dispatchJobAgentDeleted = createSpanWrapper(
  "dispatchJobAgentDeleted",
  async (span: Span, jobAgent: schema.JobAgent) => {
    span.setAttribute("job-agent.id", jobAgent.id);
    span.setAttribute("job-agent.workspaceId", jobAgent.workspaceId);
    span.setAttribute("job-agent.name", jobAgent.name);
    span.setAttribute("job-agent.type", jobAgent.type);
    span.setAttribute(
      "job-agent.config",
      JSON.stringify(jobAgent.config, null, 2),
    );

    await sendGoEvent(
      convertJobAgentToGoEvent(jobAgent, Event.JobAgentDeleted),
    );
  },
);
