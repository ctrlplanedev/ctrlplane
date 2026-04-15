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
	AgentID    string
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

func agentSectionStart(agentID string) string {
	return fmt.Sprintf("<!-- agent:%s:start -->", agentID)
}

func agentSectionEnd(agentID string) string {
	return fmt.Sprintf("<!-- agent:%s:end -->", agentID)
}

func wrapAgentSection(agentID, content string) string {
	return agentSectionStart(agentID) + "\n" + content + agentSectionEnd(agentID) + "\n"
}

func replaceOrAppendAgentSection(body, agentID, section string) string {
	start := agentSectionStart(agentID)
	end := agentSectionEnd(agentID)

	startIdx := strings.Index(body, start)
	endIdx := strings.Index(body, end)
	if startIdx >= 0 && endIdx >= 0 && endIdx > startIdx {
		return body[:startIdx] + wrapAgentSection(agentID, section) + body[endIdx+len(end):]
	}

	return body + "\n" + wrapAgentSection(agentID, section)
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
// resource. It requires the following keys in DeploymentVersion.Metadata:
//
//   - "github/owner" — GitHub repository owner (e.g. "wandb")
//   - "github/repo"  — GitHub repository name (e.g. "deployments")
//   - "git/sha"      — full commit SHA used to find the associated PR
//
// Returns nil (no-op) if any key is missing, the GitHub bot is not
// configured, or no PR is found for the SHA.
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
		result.AgentID,
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

func upsertComment(
	ctx context.Context,
	client *github.Client,
	owner, repo string,
	prNumber int,
	marker string,
	dispatchCtx *oapi.DispatchContext,
	agentID string,
	newSection string,
) error {
	existing, err := findMarkerComment(ctx, client, owner, repo, prNumber, marker)
	if err != nil {
		return err
	}

	if existing != nil {
		updated := replaceOrAppendAgentSection(existing.GetBody(), agentID, newSection)
		_, _, err := client.Issues.EditComment(
			ctx, owner, repo, existing.GetID(),
			&github.IssueComment{Body: &updated},
		)
		if err != nil {
			return fmt.Errorf("edit comment: %w", err)
		}
		return nil
	}

	wrapped := wrapAgentSection(agentID, newSection)
	body := buildComment(marker, dispatchCtx, []string{wrapped})
	_, _, err = client.Issues.CreateComment(
		ctx, owner, repo, prNumber,
		&github.IssueComment{Body: &body},
	)
	if err != nil {
		return fmt.Errorf("create comment: %w", err)
	}
	return nil
}
