import type * as schema from "@ctrlplane/db/schema";
import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import type { GoEventPayload, GoMessage } from "../events.js";
import { createSpanWrapper } from "../../span.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";

const getOapiGithubEntity = (
  githubEntity: schema.GithubEntity,
): WorkspaceEngine["schemas"]["GithubEntity"] => ({
  installationId: githubEntity.installationId,
  slug: githubEntity.slug,
});

const convertGithubEntityToGoEvent = (
  githubEntity: schema.GithubEntity,
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId: githubEntity.workspaceId,
  eventType,
  data: getOapiGithubEntity(githubEntity),
  timestamp: Date.now(),
});

export const dispatchGithubEntityCreated = createSpanWrapper(
  "dispatchGithubEntityCreated",
  async (span: Span, githubEntity: schema.GithubEntity) => {
    span.setAttribute(
      "github-entity.installationId",
      githubEntity.installationId,
    );
    span.setAttribute("github-entity.slug", githubEntity.slug);
    span.setAttribute("github-entity.workspaceId", githubEntity.workspaceId);

    await sendGoEvent(
      convertGithubEntityToGoEvent(githubEntity, Event.GithubEntityCreated),
    );
  },
);

export const dispatchGithubEntityUpdated = createSpanWrapper(
  "dispatchGithubEntityUpdated",
  async (span: Span, githubEntity: schema.GithubEntity) => {
    span.setAttribute(
      "github-entity.installationId",
      githubEntity.installationId,
    );
    span.setAttribute("github-entity.slug", githubEntity.slug);
    span.setAttribute("github-entity.workspaceId", githubEntity.workspaceId);

    await sendGoEvent(
      convertGithubEntityToGoEvent(githubEntity, Event.GithubEntityUpdated),
    );
  },
);

export const dispatchGithubEntityDeleted = createSpanWrapper(
  "dispatchGithubEntityDeleted",
  async (span: Span, githubEntity: schema.GithubEntity) => {
    span.setAttribute(
      "github-entity.installationId",
      githubEntity.installationId,
    );
    span.setAttribute("github-entity.slug", githubEntity.slug);
    span.setAttribute("github-entity.workspaceId", githubEntity.workspaceId);

    await sendGoEvent(
      convertGithubEntityToGoEvent(githubEntity, Event.GithubEntityDeleted),
    );
  },
);
