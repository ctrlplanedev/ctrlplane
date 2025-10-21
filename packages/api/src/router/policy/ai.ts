import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import _ from "lodash-es";
import { z } from "zod";

import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const policyAiRouter = createTRPCRouter({
  generateName: protectedProcedure
    .input(
      z.record(z.string(), z.any()).and(
        z.object({
          workspaceId: z.string().uuid(),
        }),
      ),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .mutation(async ({ input }) => {
      const { text } = await generateText({
        model: openai("gpt-4-turbo"),
        messages: [
          {
            role: "system",
            content: `
                You are a devops engineer assistant that generates names for policies.
                Based on the provided object for a Policy, generate a short title that describes 
                what the policy is about.
                
                The policy configuration can include:
                - Targets: Deployment and environment selectors that determine what this policy applies to
                - Deny Windows: Time windows when deployments are not allowed
                - Version Selector: Rules about which versions can be deployed
                - Approval Requirements: Any approvals needed from users or roles before deployment
                - If there are no targets, that means it won't be applied to any deployments
                - All approval rules are and operations. All conditions must be met before the policy allows a deployment
                
                Generate a concise name that captures the key purpose of the policy based on its configuration.
                The name should be no more than 50 characters.
                `,
          },
          {
            role: "user",
            content: JSON.stringify(
              _.omit(input, [
                "workspaceId",
                "id",
                "description",
                "createdAt",
                "updatedAt",
                "name",
                "enabled",
              ]),
            ),
          },
        ],
      });

      return text
        .trim()
        .replaceAll("`", "")
        .replaceAll("'", "")
        .replaceAll('"', "");
    }),

  generateDescription: protectedProcedure
    .input(
      z.record(z.string(), z.any()).and(
        z.object({
          workspaceId: z.string().uuid(),
        }),
      ),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .mutation(async ({ input }) => {
      const { text } = await generateText({
        model: openai("gpt-4-turbo"),
        messages: [
          {
            role: "system",
            content: `
                You are a devops engineer assistant that generates descriptions for policies.
                Based on the provided object for a Policy, generate a description that explains
                the purpose and configuration. The description should cover:

                - Target deployments and environments
                - Time-based restrictions (deny windows)
                - Version deployment rules and requirements 
                - Required approvals from users or roles
                - If there are no targets, that means it won't be applied to any deployments
                - All approval rules are and operations. All conditions must be met before the 
                  policy allows a deployment
                - Focus on stating active policy configurations. Only describe features with enabled restrictions.

                Keep the description under 60 words and write it in a technical style suitable
                for DevOps engineers and platform users. Focus on being clear and precise about
                the controls and enforcement mechanisms. It is already clear that you are talking
                about the policy in question.

                Do not include phrases like "The policy...", "This policy...".
                `,
          },
          {
            role: "user",
            content: JSON.stringify(
              _.omit(input, [
                "workspaceId",
                "id",
                "createdAt",
                "updatedAt",
                "enabled",
                "priority",
              ]),
            ),
          },
        ],
      });

      return text
        .trim()
        .replaceAll("`", "")
        .replaceAll("'", "")
        .replaceAll('"', "");
    }),
});
