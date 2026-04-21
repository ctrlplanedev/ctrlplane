package deploymentplanresult

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/go-github/v66/github"
	"github.com/google/uuid"
	"github.com/pmezard/go-difflib/difflib"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	gh "workspace-engine/pkg/github"
	"workspace-engine/pkg/oapi"
)

const (
	metaGitHubOwner = "github/owner"
	metaGitHubRepo  = "github/repo"
	metaGitSHA      = "git/sha"
)

// checkRunName returns the GitHub check run name for a given target.
// Names must be stable so we can look up and update an existing check
// on subsequent result completions.
func checkRunName(environmentName, resourceName string) string {
	return fmt.Sprintf("ctrlplane / %s / %s", environmentName, resourceName)
}

// targetDetailsURL returns the ctrlplane UI link for a specific target
// within a plan (used as the check's "Details" link).
func targetDetailsURL(ctx targetContext) string {
	return fmt.Sprintf(
		"%s/%s/deployments/%s/plans/%s?target=%s",
		strings.TrimRight(config.Global.BaseURL, "/"),
		ctx.WorkspaceSlug,
		ctx.DeploymentID,
		ctx.PlanID,
		ctx.TargetID,
	)
}

// targetContext bundles everything needed to render a target's check run.
type targetContext struct {
	TargetID        uuid.UUID
	PlanID          uuid.UUID
	DeploymentID    uuid.UUID
	WorkspaceSlug   string
	EnvironmentName string
	ResourceName    string
	VersionTag      string
	Owner           string
	Repo            string
	SHA             string
}

// targetContextFromRow converts the DB row (plus version metadata) into
// a typed targetContext, extracting GitHub info from version metadata.
func targetContextFromRow(row db.GetTargetContextByResultIDRow) targetContext {
	return targetContext{
		TargetID:        row.TargetID,
		PlanID:          row.PlanID,
		DeploymentID:    row.DeploymentID,
		WorkspaceSlug:   row.WorkspaceSlug,
		EnvironmentName: row.EnvironmentName,
		ResourceName:    row.ResourceName,
		VersionTag:      row.VersionTag,
		Owner:           row.VersionMetadata[metaGitHubOwner],
		Repo:            row.VersionMetadata[metaGitHubRepo],
		SHA:             row.VersionMetadata[metaGitSHA],
	}
}

// hasGitHubMetadata reports whether the target has enough GitHub info
// to post a check run.
func (t targetContext) hasGitHubMetadata() bool {
	return t.Owner != "" && t.Repo != "" && t.SHA != ""
}

// agentResult is a denormalized, template-friendly view of a result row
// with its dispatch context parsed for the agent's name/type.
type agentResult struct {
	AgentName  string
	AgentType  string
	Status     db.DeploymentPlanTargetStatus
	HasChanges *bool
	Current    string
	Proposed   string
	Message    string
}

func agentResultFromRow(row db.ListDeploymentPlanTargetResultsByTargetIDRow) agentResult {
	var dc oapi.DispatchContext
	_ = json.Unmarshal(row.DispatchContext, &dc)

	var hasChanges *bool
	if row.HasChanges.Valid {
		v := row.HasChanges.Bool
		hasChanges = &v
	}

	return agentResult{
		AgentName:  dc.JobAgent.Name,
		AgentType:  dc.JobAgent.Type,
		Status:     row.Status,
		HasChanges: hasChanges,
		Current:    row.Current.String,
		Proposed:   row.Proposed.String,
		Message:    row.Message.String,
	}
}

// aggregate describes the overall state of all agents for one target.
// Used to pick the check run's status, conclusion, and title.
type aggregate struct {
	Total       int
	Completed   int
	Errored     int
	Unsupported int
	Changed     int
	Unchanged   int
}

func aggregateResults(results []agentResult) aggregate {
	var a aggregate
	for _, r := range results {
		a.Total++
		switch r.Status {
		case db.DeploymentPlanTargetStatusCompleted:
			a.Completed++
		case db.DeploymentPlanTargetStatusErrored:
			a.Errored++
		case db.DeploymentPlanTargetStatusUnsupported:
			a.Unsupported++
		}
		if r.HasChanges != nil && *r.HasChanges {
			a.Changed++
		}
		if r.HasChanges != nil && !*r.HasChanges {
			a.Unchanged++
		}
	}
	return a
}

// allDone reports whether every agent for the target has reached a
// terminal state (completed, errored, or unsupported).
func (a aggregate) allDone() bool {
	return a.Total > 0 && a.Completed+a.Errored+a.Unsupported == a.Total
}

// shouldFinalize reports whether the check run should be set to
// "completed" status. We finalize as soon as any agent errors so the
// failure is surfaced on the PR immediately, or when all agents have
// reached a terminal state.
func (a aggregate) shouldFinalize() bool {
	return a.Errored > 0 || a.allDone()
}

// checkStatus returns the GitHub "status" field for the check run.
func (a aggregate) checkStatus() string {
	if a.shouldFinalize() {
		return "completed"
	}
	return "in_progress"
}

// checkConclusion returns the GitHub "conclusion" field. Only
// meaningful when shouldFinalize() is true.
func (a aggregate) checkConclusion() string {
	if a.Errored > 0 {
		return "failure"
	}
	if a.Changed > 0 {
		return "neutral"
	}
	return "success"
}

// checkTitle returns a short, human-readable summary line for the check.
func (a aggregate) checkTitle() string {
	done := a.Completed + a.Errored + a.Unsupported

	if a.Errored > 0 && !a.allDone() {
		return fmt.Sprintf("%d errored (%d/%d agents complete)", a.Errored, done, a.Total)
	}
	if !a.allDone() {
		return fmt.Sprintf("Computing... (%d/%d agents)", done, a.Total)
	}
	if a.Errored > 0 {
		return fmt.Sprintf(
			"%d errored, %d changed, %d unchanged",
			a.Errored,
			a.Changed,
			a.Unchanged,
		)
	}
	if a.Changed > 0 {
		return fmt.Sprintf("%d changed, %d unchanged", a.Changed, a.Unchanged)
	}
	return "No changes"
}

// formatAgentSection renders the markdown block for one agent in the
// check's "text" body — error message, "no changes", or a unified diff.
func formatAgentSection(r agentResult) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "### %s · `%s`\n", r.AgentName, r.AgentType)

	switch r.Status {
	case db.DeploymentPlanTargetStatusErrored:
		fmt.Fprintf(&sb, "\n❌ **Error:** %s\n", r.Message)
		return sb.String()
	case db.DeploymentPlanTargetStatusUnsupported:
		sb.WriteString("\n⚠️ Agent does not support plan operations\n")
		return sb.String()
	case db.DeploymentPlanTargetStatusComputing:
		sb.WriteString("\n⏳ Computing...\n")
		return sb.String()
	}

	if r.HasChanges == nil || !*r.HasChanges {
		sb.WriteString("\nNo changes\n")
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
		diff = "(failed to compute diff)"
	}

	sb.WriteString("\n```diff\n")
	sb.WriteString(diff)
	sb.WriteString("```\n")
	return sb.String()
}

// buildCheckOutput builds the full check output (title + summary + text)
// from the target's current state and all its agents' results.
func buildCheckOutput(
	tc targetContext,
	results []agentResult,
	agg aggregate,
) *github.CheckRunOutput {
	title := agg.checkTitle()

	var summary strings.Builder
	fmt.Fprintf(&summary, "**Version:** `%s`\n\n", tc.VersionTag)
	fmt.Fprintf(&summary, "[View full plan →](%s)\n", targetDetailsURL(tc))

	var text strings.Builder
	for i, r := range results {
		if i > 0 {
			text.WriteString("\n---\n\n")
		}
		text.WriteString(formatAgentSection(r))
	}

	summaryStr := summary.String()
	textStr := text.String()
	return &github.CheckRunOutput{
		Title:   &title,
		Summary: &summaryStr,
		Text:    &textStr,
	}
}

// findCheckRunByName locates an existing check run by name on the given
// commit. Returns nil if no check with that name exists yet.
func findCheckRunByName(
	ctx context.Context,
	client *github.Client,
	owner, repo, sha, name string,
) (*github.CheckRun, error) {
	opts := &github.ListCheckRunsOptions{
		CheckName:   &name,
		ListOptions: github.ListOptions{PerPage: 100},
	}
	for {
		result, resp, err := client.Checks.ListCheckRunsForRef(ctx, owner, repo, sha, opts)
		if err != nil {
			return nil, fmt.Errorf("list check runs: %w", err)
		}
		for _, c := range result.CheckRuns {
			if c.GetName() == name {
				return c, nil
			}
		}
		if resp.NextPage == 0 {
			return nil, nil
		}
		opts.Page = resp.NextPage
	}
}

// upsertCheckRun creates a new check run or updates an existing one
// with the given status/conclusion/output.
func upsertCheckRun(
	ctx context.Context,
	client *github.Client,
	tc targetContext,
	agg aggregate,
	output *github.CheckRunOutput,
) error {
	name := checkRunName(tc.EnvironmentName, tc.ResourceName)
	status := agg.checkStatus()
	detailsURL := targetDetailsURL(tc)

	existing, err := findCheckRunByName(ctx, client, tc.Owner, tc.Repo, tc.SHA, name)
	if err != nil {
		return err
	}

	if existing == nil {
		return createCheckRun(ctx, client, tc, name, status, detailsURL, agg, output)
	}
	return updateCheckRun(ctx, client, tc, existing.GetID(), status, detailsURL, agg, output)
}

func createCheckRun(
	ctx context.Context,
	client *github.Client,
	tc targetContext,
	name, status, detailsURL string,
	agg aggregate,
	output *github.CheckRunOutput,
) error {
	opts := github.CreateCheckRunOptions{
		Name:       name,
		HeadSHA:    tc.SHA,
		Status:     &status,
		DetailsURL: &detailsURL,
		Output:     output,
	}
	if agg.shouldFinalize() {
		conclusion := agg.checkConclusion()
		opts.Conclusion = &conclusion
		completedAt := github.Timestamp{Time: time.Now()}
		opts.CompletedAt = &completedAt
	}
	_, _, err := client.Checks.CreateCheckRun(ctx, tc.Owner, tc.Repo, opts)
	if err != nil {
		return fmt.Errorf("create check run: %w", err)
	}
	return nil
}

func updateCheckRun(
	ctx context.Context,
	client *github.Client,
	tc targetContext,
	checkRunID int64,
	status, detailsURL string,
	agg aggregate,
	output *github.CheckRunOutput,
) error {
	name := checkRunName(tc.EnvironmentName, tc.ResourceName)
	opts := github.UpdateCheckRunOptions{
		Name:       name,
		Status:     &status,
		DetailsURL: &detailsURL,
		Output:     output,
	}
	if agg.shouldFinalize() {
		conclusion := agg.checkConclusion()
		opts.Conclusion = &conclusion
		completedAt := github.Timestamp{Time: time.Now()}
		opts.CompletedAt = &completedAt
	}
	_, _, err := client.Checks.UpdateCheckRun(ctx, tc.Owner, tc.Repo, checkRunID, opts)
	if err != nil {
		return fmt.Errorf("update check run: %w", err)
	}
	return nil
}

// MaybeUpdateTargetCheck rebuilds the target's GitHub check run from
// current DB state and upserts it on the PR's head commit. It silently
// returns when the bot is not configured or required GitHub metadata
// is missing.
func MaybeUpdateTargetCheck(
	ctx context.Context,
	getter Getter,
	resultID uuid.UUID,
) error {
	ctx, span := tracer.Start(ctx, "MaybeUpdateTargetCheck")
	defer span.End()

	span.SetAttributes(attribute.String("result_id", resultID.String()))

	tc, results, err := loadTargetContext(ctx, getter, resultID)
	if err != nil {
		return err
	}
	if !tc.hasGitHubMetadata() {
		span.AddEvent("skipped: missing github metadata")
		return nil
	}

	span.SetAttributes(
		attribute.String("github.owner", tc.Owner),
		attribute.String("github.repo", tc.Repo),
		attribute.String("git.sha", tc.SHA),
		attribute.String("target_id", tc.TargetID.String()),
	)

	client, err := gh.CreateClientForRepo(ctx, tc.Owner, tc.Repo)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "create github client")
		return fmt.Errorf("create github client: %w", err)
	}
	if client == nil {
		span.AddEvent("skipped: github bot not configured")
		return nil
	}

	agg := aggregateResults(results)
	output := buildCheckOutput(tc, results, agg)

	if err := upsertCheckRun(ctx, client, tc, agg, output); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "upsert check run")
		return err
	}

	span.AddEvent("check run upserted")
	return nil
}

// loadTargetContext fetches the target metadata and all its results
// needed to render a check run.
func loadTargetContext(
	ctx context.Context,
	getter Getter,
	resultID uuid.UUID,
) (targetContext, []agentResult, error) {
	row, err := getter.GetTargetContextByResultID(ctx, resultID)
	if err != nil {
		return targetContext{}, nil, fmt.Errorf("get target context: %w", err)
	}
	tc := targetContextFromRow(row)

	rows, err := getter.ListDeploymentPlanTargetResultsByTargetID(ctx, tc.TargetID)
	if err != nil {
		return targetContext{}, nil, fmt.Errorf("list target results: %w", err)
	}

	results := make([]agentResult, len(rows))
	for i, r := range rows {
		results[i] = agentResultFromRow(r)
	}
	return tc, results, nil
}
