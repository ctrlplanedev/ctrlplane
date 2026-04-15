package deploymentplanresult

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/go-github/v66/github"
	"github.com/pmezard/go-difflib/difflib"
	gh "workspace-engine/pkg/github"
	"workspace-engine/pkg/oapi"
)

const (
	metaGitHubOwner = "github/owner"
	metaGitHubRepo  = "github/repo"
	metaGitSHA      = "git/sha"
)

type prCommentResult struct {
	AgentName  string
	AgentType  string
	Status     string
	HasChanges bool
	Current    string
	Proposed   string
	Message    string
}

func commentMarker(targetID string) string {
	return fmt.Sprintf("<!-- ctrlplane-plan-target:%s -->", targetID)
}

func formatResultSection(r prCommentResult) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "**%s** · `%s`\n", r.AgentName, r.AgentType)

	switch r.Status {
	case "errored":
		fmt.Fprintf(&sb, "> ❌ Error: %s\n", r.Message)
		return sb.String()
	case "unsupported":
		fmt.Fprintf(&sb, "> ⚠️ Agent does not support plan operations\n")
		return sb.String()
	}

	if !r.HasChanges {
		sb.WriteString("> No changes\n")
		return sb.String()
	}

	diff, err := difflib.GetUnifiedDiffString(difflib.UnifiedDiff{
		A:        difflib.SplitLines(r.Current),
		B:        difflib.SplitLines(r.Proposed),
		FromFile: "current",
		ToFile:   "proposed",
		Context:  3,
	})
	if err != nil {
		diff = "Failed to compute diff"
	}

	sb.WriteString("<details>\n<summary>Changes detected</summary>\n\n")
	sb.WriteString("```diff\n")
	sb.WriteString(diff)
	sb.WriteString("```\n")
	sb.WriteString("</details>\n")

	return sb.String()
}

func buildComment(marker string, dispatchCtx *oapi.DispatchContext, sections []string) string {
	var sb strings.Builder
	sb.WriteString(marker)
	sb.WriteString("\n")

	resourceName := "unknown"
	envName := "unknown"
	if dispatchCtx.Resource != nil {
		resourceName = dispatchCtx.Resource.Name
	}
	if dispatchCtx.Environment != nil {
		envName = dispatchCtx.Environment.Name
	}

	fmt.Fprintf(&sb, "#### %s · %s\n\n", resourceName, envName)
	sb.WriteString(strings.Join(sections, "\n"))

	return sb.String()
}

// MaybeCommentOnPR posts or updates a PR comment with plan results for a
// resource. Returns nil if the version metadata lacks GitHub info, the bot
// is not configured, or no PR is found for the SHA.
func MaybeCommentOnPR(
	ctx context.Context,
	dispatchCtx *oapi.DispatchContext,
	targetID string,
	result prCommentResult,
) error {
	if dispatchCtx.Version == nil {
		return nil
	}
	meta := dispatchCtx.Version.Metadata
	owner := meta[metaGitHubOwner]
	repo := meta[metaGitHubRepo]
	sha := meta[metaGitSHA]
	if owner == "" || repo == "" || sha == "" {
		return nil
	}

	client, err := gh.CreateClientForRepo(ctx, owner, repo)
	if err != nil {
		return fmt.Errorf("create github client: %w", err)
	}
	if client == nil {
		return nil
	}

	prNumber, err := findPRForSHA(ctx, client, owner, repo, sha)
	if err != nil {
		return fmt.Errorf("find PR for SHA %s: %w", sha, err)
	}
	if prNumber == 0 {
		return nil
	}

	marker := commentMarker(targetID)
	section := formatResultSection(result)

	if err := upsertComment(
		ctx,
		client,
		owner,
		repo,
		prNumber,
		marker,
		dispatchCtx,
		section,
	); err != nil {
		return fmt.Errorf("upsert comment on PR #%d: %w", prNumber, err)
	}
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

func upsertComment(
	ctx context.Context,
	client *github.Client,
	owner, repo string,
	prNumber int,
	marker string,
	dispatchCtx *oapi.DispatchContext,
	newSection string,
) error {
	comments, _, err := client.Issues.ListComments(
		ctx, owner, repo, prNumber, &github.IssueListCommentsOptions{
			ListOptions: github.ListOptions{PerPage: 100},
		},
	)
	if err != nil {
		return fmt.Errorf("list comments: %w", err)
	}

	for _, c := range comments {
		body := c.GetBody()
		if !strings.Contains(body, marker) {
			continue
		}

		updated := appendSection(body, newSection)
		_, _, err := client.Issues.EditComment(
			ctx, owner, repo, c.GetID(),
			&github.IssueComment{Body: &updated},
		)
		if err != nil {
			return fmt.Errorf("edit comment: %w", err)
		}
		return nil
	}

	body := buildComment(marker, dispatchCtx, []string{newSection})
	_, _, err = client.Issues.CreateComment(
		ctx, owner, repo, prNumber,
		&github.IssueComment{Body: &body},
	)
	if err != nil {
		return fmt.Errorf("create comment: %w", err)
	}
	return nil
}

func appendSection(existingBody, newSection string) string {
	return existingBody + "\n" + newSection
}
