package deploymentplan

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/go-github/v66/github"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	gh "workspace-engine/pkg/github"
)

const (
	metaGitHubOwner = "github/owner"
	metaGitHubRepo  = "github/repo"
	metaGitSHA      = "git/sha"
)

func planCommentMarker(planID uuid.UUID) string {
	return fmt.Sprintf("<!-- ctrlplane-plan:%s -->", planID)
}

func buildPlanCommentBody(
	marker, baseURL, workspaceSlug string,
	plan db.DeploymentPlan,
) string {
	planURL := fmt.Sprintf(
		"%s/%s/deployments/%s/plans/%s",
		strings.TrimRight(baseURL, "/"),
		workspaceSlug,
		plan.DeploymentID,
		plan.ID,
	)

	var sb strings.Builder
	sb.WriteString(marker)
	sb.WriteString("\n")
	sb.WriteString("### Ctrlplane Deployment Plan\n\n")
	fmt.Fprintf(&sb, "**Version:** `%s`\n\n", plan.VersionTag)
	fmt.Fprintf(&sb, "[View plan →](%s)\n", planURL)
	return sb.String()
}

// MaybeCommentPlanLink posts or updates a PR comment linking to the plan
// detail page. It requires the following keys in plan.VersionMetadata:
//
//   - "github/owner" — GitHub repository owner
//   - "github/repo"  — GitHub repository name
//   - "git/sha"      — commit SHA used to find the associated PR
//
// Returns nil (no-op) if any key is missing, the GitHub bot is not
// configured, or no PR is found for the SHA.
func MaybeCommentPlanLink(
	ctx context.Context,
	plan db.DeploymentPlan,
	workspaceSlug string,
) error {
	ctx, span := tracer.Start(ctx, "MaybeCommentPlanLink")
	defer span.End()

	span.SetAttributes(attribute.String("plan_id", plan.ID.String()))

	owner := plan.VersionMetadata[metaGitHubOwner]
	repo := plan.VersionMetadata[metaGitHubRepo]
	sha := plan.VersionMetadata[metaGitSHA]

	span.SetAttributes(
		attribute.String("github.owner", owner),
		attribute.String("github.repo", repo),
		attribute.String("git.sha", sha),
	)

	if owner == "" || repo == "" || sha == "" {
		span.AddEvent("skipped: missing github metadata")
		return nil
	}

	client, err := gh.CreateClientForRepo(ctx, owner, repo)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "create github client")
		return fmt.Errorf("create github client: %w", err)
	}
	if client == nil {
		span.AddEvent("skipped: github bot not configured")
		return nil
	}

	prNumber, err := findPRForSHA(ctx, client, owner, repo, sha)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "find PR for SHA")
		return fmt.Errorf("find PR for SHA %s: %w", sha, err)
	}
	if prNumber == 0 {
		span.AddEvent("skipped: no PR found for SHA")
		return nil
	}
	span.SetAttributes(attribute.Int("github.pr_number", prNumber))

	marker := planCommentMarker(plan.ID)
	body := buildPlanCommentBody(marker, config.Global.BaseURL, workspaceSlug, plan)

	if err := upsertPlanComment(ctx, client, owner, repo, prNumber, marker, body); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "upsert comment")
		return fmt.Errorf("upsert comment on PR #%d: %w", prNumber, err)
	}

	span.AddEvent("comment upserted")
	return nil
}

func findPRForSHA(
	ctx context.Context,
	client *github.Client,
	owner, repo, sha string,
) (int, error) {
	prs, _, err := client.PullRequests.ListPullRequestsWithCommit(
		ctx, owner, repo, sha, &github.ListOptions{PerPage: 1},
	)
	if err != nil {
		return 0, fmt.Errorf("list PRs for commit %s: %w", sha, err)
	}
	for _, pr := range prs {
		if pr.GetState() == "open" {
			return pr.GetNumber(), nil
		}
	}
	if len(prs) > 0 {
		return prs[0].GetNumber(), nil
	}
	return 0, nil
}

func findMarkerComment(
	ctx context.Context,
	client *github.Client,
	owner, repo string,
	prNumber int,
	marker string,
) (*github.IssueComment, error) {
	opts := &github.IssueListCommentsOptions{
		ListOptions: github.ListOptions{PerPage: 100},
	}
	for {
		comments, resp, err := client.Issues.ListComments(
			ctx, owner, repo, prNumber, opts,
		)
		if err != nil {
			return nil, fmt.Errorf("list comments: %w", err)
		}
		for _, c := range comments {
			if strings.Contains(c.GetBody(), marker) {
				return c, nil
			}
		}
		if resp.NextPage == 0 {
			return nil, nil
		}
		opts.Page = resp.NextPage
	}
}

func upsertPlanComment(
	ctx context.Context,
	client *github.Client,
	owner, repo string,
	prNumber int,
	marker, body string,
) error {
	existing, err := findMarkerComment(ctx, client, owner, repo, prNumber, marker)
	if err != nil {
		return err
	}

	if existing != nil {
		_, _, err := client.Issues.EditComment(
			ctx, owner, repo, existing.GetID(),
			&github.IssueComment{Body: &body},
		)
		if err != nil {
			return fmt.Errorf("edit comment: %w", err)
		}
		return nil
	}

	_, _, err = client.Issues.CreateComment(
		ctx, owner, repo, prNumber,
		&github.IssueComment{Body: &body},
	)
	if err != nil {
		return fmt.Errorf("create comment: %w", err)
	}
	return nil
}
