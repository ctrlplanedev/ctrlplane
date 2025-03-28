import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";
import { Releases } from "../releases.js";

/**
 * Webhook response structure
 */
export type WebhookResponse = {
  /**
   * Whether the deployment is allowed
   */
  allowed: boolean;

  /**
   * Reason message (used when denied)
   */
  reason?: string;

  /**
   * Additional metadata returned by the webhook
   */
  metadata?: Record<string, unknown>;
};

/**
 * Function that calls external webhooks and returns the result
 */
export type WebhookCaller = (
  url: string,
  payload: Record<string, unknown>,
  options?: WebhookCallerOptions,
) => Promise<WebhookResponse>;

/**
 * Options for webhook calls
 */
export type WebhookCallerOptions = {
  /**
   * HTTP method for the webhook call
   */
  method?: "POST" | "GET";

  /**
   * Request timeout in milliseconds
   */
  timeoutMs?: number;

  /**
   * Additional headers to include
   */
  headers?: Record<string, string>;
};

/**
 * Default webhook caller implementation
 */
export const defaultWebhookCaller: WebhookCaller = async (
  url: string,
  payload: Record<string, unknown>,
  options?: WebhookCallerOptions,
): Promise<WebhookResponse> => {
  const { method = "POST", timeoutMs = 5000, headers = {} } = options ?? {};

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: method === "POST" ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        allowed: false,
        reason: `Webhook failed with status ${response.status}`,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      allowed: Boolean(data.allowed),
      reason: typeof data.reason === "string" ? data.reason : undefined,
      metadata:
        typeof data.metadata === "object" && data.metadata
          ? (data.metadata as Record<string, unknown>)
          : undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        allowed: false,
        reason: `Webhook error: ${error.message}`,
      };
    }
    return {
      allowed: false,
      reason: "Unknown webhook error",
    };
  }
};

/**
 * Options for configuring the WebhookCheckRule
 */
export type WebhookCheckRuleOptions = {
  /**
   * URL of the webhook endpoint to call
   */
  webhookUrl: string;

  /**
   * Custom function to call webhooks
   */
  webhookCaller?: WebhookCaller;

  /**
   * Additional static webhook options
   */
  webhookOptions?: WebhookCallerOptions;

  /**
   * Function to prepare the webhook payload
   * Default creates a payload with context and release info
   */
  preparePayload?: (
    context: DeploymentResourceContext,
    release: Release,
  ) => Record<string, unknown>;

  /**
   * Cache results for this many seconds
   * Default: 60 seconds
   */
  cacheResultsSeconds?: number;

  /**
   * Whether to block deployment if webhook is unreachable
   * Default: true
   */
  blockOnFailure?: boolean;
};

/**
 * A rule that validates deployments through external webhooks.
 *
 * This rule calls a configured webhook endpoint for each release, allowing
 * external systems to approve or deny deployments based on their own criteria.
 *
 * @example
 * ```ts
 * // Call approval webhook before deployments
 * new WebhookCheckRule({
 *   webhookUrl: "https://deployment-approvals.example.com/check",
 *   webhookOptions: {
 *     headers: {
 *       "X-API-Key": process.env.APPROVAL_API_KEY
 *     },
 *     timeoutMs: 10000
 *   },
 *   blockOnFailure: true
 * });
 * ```
 */
export class WebhookCheckRule implements DeploymentResourceRule {
  public readonly name = "WebhookCheckRule";
  private webhookCaller: WebhookCaller;
  private cacheResultsSeconds: number;
  private blockOnFailure: boolean;
  private resultCache = new Map<
    string,
    { result: DeploymentResourceRuleResult; timestamp: number }
  >();

  constructor(private options: WebhookCheckRuleOptions) {
    this.webhookCaller = options.webhookCaller ?? defaultWebhookCaller;
    this.cacheResultsSeconds = options.cacheResultsSeconds ?? 60;
    this.blockOnFailure = options.blockOnFailure ?? true;
  }

  /**
   * Generate a cache key for a deployment and release
   */
  private getCacheKey(
    context: DeploymentResourceContext,
    release: Release,
  ): string {
    return `${context.deployment.id}:${context.resource.id}:${release.id}`;
  }

  /**
   * Prepare the payload to send to the webhook
   */
  private preparePayload(
    context: DeploymentResourceContext,
    release: Release,
  ): Record<string, unknown> {
    if (this.options.preparePayload) {
      return this.options.preparePayload(context, release);
    }

    // Default payload includes context and release information
    return {
      deployment: {
        id: context.deployment.id,
        name: context.deployment.name,
      },
      resource: {
        id: context.resource.id,
        name: context.resource.name,
      },
      release: {
        id: release.id,
        version: release.version.tag,
        metadata: release.version.metadata,
      },
      desiredReleaseId: context.desiredReleaseId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Filters releases based on webhook responses
   * @param ctx - Context containing information about the deployment and resource
   * @param releases - List of releases to filter
   * @returns Promise resolving to the filtered list of releases and optional reason if blocked
   */
  async filter(
    ctx: DeploymentResourceContext,
    releases: Releases,
  ): Promise<DeploymentResourceRuleResult> {
    const now = Date.now();
    const allowedReleases: Release[] = [];
    const deniedReleases: { release: Release; reason: string }[] = [];

    for (const release of releases.getAll()) {
      const cacheKey = this.getCacheKey(ctx, release);
      const cached = this.resultCache.get(cacheKey);

      // Use cached result if available and not expired
      if (cached && now - cached.timestamp < this.cacheResultsSeconds * 1000) {
        const isAllowed = cached.result.allowedReleases.some(
          (r) => r.id === release.id,
        );
        if (isAllowed) {
          allowedReleases.push(release);
        } else {
          deniedReleases.push({
            release,
            reason: cached.result.reason ?? "Denied by webhook (cached)",
          });
        }
        continue;
      }

      // Prepare webhook payload
      const payload = this.preparePayload(ctx, release);

      // Call webhook
      try {
        const response = await this.webhookCaller(
          this.options.webhookUrl,
          payload,
          this.options.webhookOptions,
        );

        if (response.allowed) {
          allowedReleases.push(release);
          this.resultCache.set(cacheKey, {
            result: { allowedReleases: Releases.from(release) },
            timestamp: now,
          });
        } else {
          const reason =
            response.reason ?? "Denied by webhook (no reason provided)";
          deniedReleases.push({ release, reason });
          this.resultCache.set(cacheKey, {
            result: {
              allowedReleases: Releases.empty(),
              reason,
            },
            timestamp: now,
          });
        }
      } catch (error) {
        // Handle webhook call failures
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const reason = `Webhook call failed: ${errorMessage}`;

        if (this.blockOnFailure) {
          deniedReleases.push({ release, reason });
          this.resultCache.set(cacheKey, {
            result: {
              allowedReleases: Releases.empty(),
              reason,
            },
            timestamp: now,
          });
        } else {
          // If not blocking on failure, allow the release
          allowedReleases.push(release);
          this.resultCache.set(cacheKey, {
            result: {
              allowedReleases: Releases.from(release),
              reason: `Warning: ${reason} (deployment allowed because blockOnFailure=false)`,
            },
            timestamp: now,
          });
        }
      }
    }

    // If no releases are allowed, return the reason from the first denied release
    if (allowedReleases.length === 0 && deniedReleases.length > 0) {
      const firstDenied = deniedReleases[0];
      return {
        allowedReleases: Releases.empty(),
        reason: firstDenied?.reason ?? "Denied by webhook",
      };
    }

    return { allowedReleases: Releases.from(allowedReleases) };
  }
}
