import {
  CreateRoleCommand,
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { TRPCError } from "@trpc/server";
import { auth } from "google-auth-library";
import { google } from "googleapis";
import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  resourceProvider,
  resourceProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const iamClient = new IAMClient({
  region: "us-east-1",
  credentials: defaultProvider(),
});

const stsClient = new STSClient({
  region: "us-east-1",
  credentials: defaultProvider(),
});

export const integrationsRouter = createTRPCRouter({
  google: createTRPCRouter({
    createServiceAccount: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) => {
        const ws = await ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, input))
          .then(takeFirstOrNull);

        if (ws == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });

        if (ws.googleServiceAccountEmail !== null)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Google service account already exists.",
          });

        const projectId = await auth.getProjectId();

        const sa = await google.iam("v1").projects.serviceAccounts.create({
          name: `projects/${projectId}`,
          auth,
          requestBody: {
            accountId: `ctrlplane-${ws.slug}`,
            serviceAccount: {
              displayName: `Workspace ${ws.slug}`,
              description: `Service account for ${ws.slug} (${ws.id})`,
            },
          },
        });

        if (sa.data.email == null)
          throw new Error("No email server account response");

        return ctx.db
          .update(workspace)
          .set({
            googleServiceAccountEmail: sa.data.email,
          })
          .where(eq(workspace.id, input))
          .returning()
          .then(takeFirst);
      }),

    deleteServiceAccount: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) => {
        const ws = await ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, input))
          .then(takeFirstOrNull);

        if (ws == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });

        if (ws.googleServiceAccountEmail == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Google service account does not exist.",
          });

        const existingGoogleProviders = await ctx.db
          .select()
          .from(resourceProvider)
          .innerJoin(
            resourceProviderGoogle,
            eq(resourceProvider.id, resourceProviderGoogle.resourceProviderId),
          )
          .where(eq(resourceProvider.workspaceId, input));

        if (existingGoogleProviders.length > 0)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Cannot delete Google service account while active resource providers exist.",
          });

        const projectId = await auth.getProjectId();

        await google.iam("v1").projects.serviceAccounts.delete({
          name: `projects/${projectId}/serviceAccounts/${ws.googleServiceAccountEmail}`,
          auth,
        });

        return ctx.db
          .update(workspace)
          .set({
            googleServiceAccountEmail: null,
          })
          .where(eq(workspace.id, input))
          .returning()
          .then(takeFirst);
      }),
  }),

  aws: createTRPCRouter({
    createAwsRole: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) => {
        const ws = await ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, input))
          .then(takeFirstOrNull);

        if (ws == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });

        if (ws.awsRoleArn !== null)
          throw new TRPCError({
            code: "CONFLICT",
            message: "AWS Role Arn already defined.",
          });

        const { Arn: currentArn, Account: accountId } = await stsClient.send(
          new GetCallerIdentityCommand({}),
        );

        if (currentArn == null || accountId == null) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get AWS account details",
          });
        }

        const isSSORole = currentArn.includes("AWSReservedSSO");

        const roleName = `ctrlplane-${ws.slug}`;

        const [, currentRoleName] = currentArn.split("/");

        const assumeRolePolicyDocument = isSSORole
          ? {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: {
                    AWS: `arn:aws:iam::${accountId}:root`,
                  },
                  Action: "sts:AssumeRole",
                  Condition: {
                    ArnLike: {
                      "aws:PrincipalArn": [
                        `arn:aws:iam::${accountId}:role/aws-reserved/sso.amazonaws.com/*/${currentRoleName}`,
                      ],
                    },
                  },
                },
              ],
            }
          : {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: {
                    AWS: currentArn,
                  },
                  Action: "sts:AssumeRole",
                },
              ],
            };

        const createRoleResponse = await iamClient.send(
          new CreateRoleCommand({
            RoleName: roleName,
            Description: `Role for ${ws.slug} (${ws.id})`,
            AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
          }),
        );

        if (
          createRoleResponse.Role?.Arn == null ||
          createRoleResponse.$metadata.httpStatusCode !== 200
        )
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create AWS role",
          });

        const policyDocument = {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["sts:AssumeRole"],
              Resource: "*",
            },
          ],
        };

        const putPolicyResponse = await iamClient.send(
          new PutRolePolicyCommand({
            RoleName: roleName,
            PolicyName: `${roleName}-ctrlplane-policy`,
            PolicyDocument: JSON.stringify(policyDocument),
          }),
        );

        if (putPolicyResponse.$metadata.httpStatusCode !== 200)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create AWS role policy",
          });

        return ctx.db
          .update(workspace)
          .set({
            awsRoleArn: createRoleResponse.Role.Arn,
          })
          .where(eq(workspace.id, input))
          .returning()
          .then(takeFirst);
      }),

    deleteAwsRole: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) => {
        const ws = await ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, input))
          .then(takeFirstOrNull);

        if (ws == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });

        if (ws.awsRoleArn == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "AWS Role does not exist.",
          });

        const roleName = `ctrlplane-${ws.slug}`;

        await iamClient.send(
          new DeleteRolePolicyCommand({
            RoleName: roleName,
            PolicyName: `${roleName}-ctrlplane-policy`,
          }),
        );

        await iamClient.send(
          new DeleteRoleCommand({
            RoleName: roleName,
          }),
        );

        return ctx.db
          .update(workspace)
          .set({
            awsRoleArn: null,
          })
          .where(eq(workspace.id, input))
          .returning()
          .then(takeFirst);
      }),
  }),
});
