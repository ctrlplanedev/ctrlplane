package deploymentplanresult

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/go-github/v66/github"
	"github.com/google/uuid"
	"github.com/pmezard/go-difflib/difflib"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	gh "workspace-engine/pkg/github"
	"workspace-engine/pkg/oapi"
)

const (
	metaGitHubOwner = "github/owner"
	metaGitHubRepo  = "github/repo"
	metaGitSHA      = "git/sha"

	// githubCallTimeout caps how long the full GitHub interaction
	// (client creation + check run upsert) can take before aborting.
	githubCallTimeout = 30 * time.Second

	// maxCheckRunTextBytes is GitHub's hard limit on the check run
	// `output.text` field. We leave a small margin for a truncation
	// sentinel so the API call never fails on size.
	maxCheckRunTextBytes = 65_000
	truncationSentinel   = "\n\n_...output truncated..._\n"
)

// checkRunName returns the GitHub check run name for a given target.
// Names must be stable so we can look up and update an existing check
// on subsequent result completions.
func checkRunName(environmentName, resourceName string) string {
	return fmt.Sprintf("ctrlplane / %s / %s", environmentName, resourceName)
}

// resultDetailsURL returns the ctrlplane UI link for a specific plan
// result (used as the check's "Details" link). The URL opens the diff
// dialog for that result on page load.
func resultDetailsURL(ctx targetContext, resultID uuid.UUID) string {
	return fmt.Sprintf(
		"%s/%s/deployments/%s/plans/%s?resultId=%s",
		strings.TrimRight(config.Global.BaseURL, "/"),
		ctx.WorkspaceSlug,
		ctx.DeploymentID,
		ctx.PlanID,
		resultID,
	)
}

// targetContext bundles everything needed to render a target's check run.
type targetContext struct {
	TargetID        uuid.UUID
	PlanID          uuid.UUID
	DeploymentID    uuid.UUID
	WorkspaceID     uuid.UUID
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
		WorkspaceID:     row.WorkspaceID,
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

// agentResultFromRow builds an agentResult from a DB row. If the row's
// dispatch context cannot be unmarshalled, placeholder values are used
// for the agent's name/type and the parse error is returned so the
// caller can record it on the trace. The returned agentResult is
// always safe to render.
func agentResultFromRow(
	row db.ListDeploymentPlanTargetResultsByTargetIDRow,
) (agentResult, error) {
	var dc oapi.DispatchContext
	parseErr := json.Unmarshal(row.DispatchContext, &dc)

	agentName := dc.JobAgent.Name
	agentType := dc.JobAgent.Type
	if parseErr != nil {
		agentName = "(unknown agent)"
		agentType = "unknown"
	}

	var hasChanges *bool
	if row.HasChanges.Valid {
		v := row.HasChanges.Bool
		hasChanges = &v
	}

	return agentResult{
		AgentName:  agentName,
		AgentType:  agentType,
		Status:     row.Status,
		HasChanges: hasChanges,
		Current:    row.Current.String,
		Proposed:   row.Proposed.String,
		Message:    row.Message.String,
	}, parseErr
}

// validationSummary holds the result of a single plan validation rule.
type validationSummary struct {
	RuleName string
	Severity string
	Passed   bool
	Denials  []string
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
	Additions   int
	Deletions   int

	ValidationErrors   int
	ValidationWarnings int
}

func countDiffLines(current, proposed string) (int, int) {
	a := difflib.SplitLines(current)
	b := difflib.SplitLines(proposed)
	m := difflib.NewMatcher(a, b)
	var adds, dels int
	for _, op := range m.GetOpCodes() {
		switch op.Tag {
		case 'r':
			dels += op.I2 - op.I1
			adds += op.J2 - op.J1
		case 'd':
			dels += op.I2 - op.I1
		case 'i':
			adds += op.J2 - op.J1
		}
	}
	return adds, dels
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
			adds, dels := countDiffLines(r.Current, r.Proposed)
			a.Additions += adds
			a.Deletions += dels
			continue
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
	if a.Errored > 0 || a.ValidationErrors > 0 {
		return "failure"
	}
	if a.Total > 0 && a.Unsupported == a.Total {
		return "skipped"
	}
	if a.Changed > 0 {
		return "neutral"
	}
	return "success"
}

// checkTitle returns a short, human-readable summary line for the check.
func (a aggregate) checkTitle() string {
	done := a.Completed + a.Errored + a.Unsupported

	if !a.allDone() {
		if a.Errored > 0 {
			return fmt.Sprintf(
				"%d errored, %d unsupported (%d/%d agents complete)",
				a.Errored, a.Unsupported, done, a.Total,
			)
		}
		return fmt.Sprintf("Computing... (%d/%d agents)", done, a.Total)
	}

	if a.Total > 0 && a.Unsupported == a.Total {
		return "All agents unsupported"
	}

	diffSummary := fmt.Sprintf("+%d -%d", a.Additions, a.Deletions)
	if a.Errored > 0 {
		return fmt.Sprintf("%s (%d errored)", diffSummary, a.Errored)
	}
	if a.ValidationErrors > 0 {
		return fmt.Sprintf("%s (%d validation failures)", diffSummary, a.ValidationErrors)
	}
	return diffSummary
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

// truncateText trims s to fit within maxBytes (accounting for a trailing
// truncation sentinel). It rolls back to the last valid UTF-8 rune
// boundary so multi-byte characters are never cut in half.
func truncateText(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}

	cutoff := max(maxBytes-len(truncationSentinel), 0)

	// Walk back to a rune boundary so the output remains valid UTF-8.
	for cutoff > 0 && !utf8.RuneStart(s[cutoff]) {
		cutoff--
	}
	return s[:cutoff] + truncationSentinel
}

// formatValidationSection renders the markdown block for plan validation
// results in the check's "text" body.
func formatValidationSection(validations []validationSummary) string {
	if len(validations) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("\n---\n\n## Plan Validations\n\n")

	for _, v := range validations {
		icon := "✅"
		if !v.Passed && v.Severity == "error" {
			icon = "❌"
		} else if !v.Passed && v.Severity == "warning" {
			icon = "⚠️"
		}

		fmt.Fprintf(&sb, "### %s %s (`%s`)\n\n", icon, v.RuleName, v.Severity)

		if v.Passed {
			sb.WriteString("Passed\n\n")
			continue
		}

		for _, msg := range v.Denials {
			fmt.Fprintf(&sb, "- %s\n", msg)
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// buildCheckOutput builds the full check output (title + summary + text)
// from the target's current state and all its agents' results.
func buildCheckOutput(
	tc targetContext,
	resultID uuid.UUID,
	results []agentResult,
	validations []validationSummary,
	agg aggregate,
) *github.CheckRunOutput {
	title := agg.checkTitle()

	var summary strings.Builder
	fmt.Fprintf(&summary, "**Version:** `%s`\n\n", tc.VersionTag)
	fmt.Fprintf(&summary, "[View diff →](%s)\n", resultDetailsURL(tc, resultID))

	var text strings.Builder
	for i, r := range results {
		if i > 0 {
			text.WriteString("\n---\n\n")
		}
		text.WriteString(formatAgentSection(r))
	}

	text.WriteString(formatValidationSection(validations))

	summaryStr := summary.String()
	textStr := truncateText(text.String(), maxCheckRunTextBytes)
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
	resultID uuid.UUID,
	agg aggregate,
	output *github.CheckRunOutput,
) error {
	name := checkRunName(tc.EnvironmentName, tc.ResourceName)
	status := agg.checkStatus()
	detailsURL := resultDetailsURL(tc, resultID)

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

	// Bound GitHub API interactions so a slow GitHub response can't
	// block the reconcile worker's lease.
	ghCtx, cancel := context.WithTimeout(ctx, githubCallTimeout)
	defer cancel()

	client, err := gh.CreateClientForRepo(ghCtx, tc.Owner, tc.Repo)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "create github client")
		return fmt.Errorf("create github client: %w", err)
	}
	if client == nil {
		span.AddEvent("skipped: github bot not configured")
		return nil
	}

	validations, valErr := loadValidationSummaries(ghCtx, getter, tc)
	if valErr != nil {
		span.RecordError(fmt.Errorf("load validation summaries: %w", valErr))
	}

	agg := aggregateResults(results)
	for _, v := range validations {
		if !v.Passed && v.Severity == "error" {
			agg.ValidationErrors++
		} else if !v.Passed && v.Severity == "warning" {
			agg.ValidationWarnings++
		}
	}
	output := buildCheckOutput(tc, resultID, results, validations, agg)

	if err := upsertCheckRun(ghCtx, client, tc, resultID, agg, output); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "upsert check run")
		return err
	}

	span.AddEvent("check run upserted")
	return nil
}

// loadValidationSummaries builds validationSummary entries from the DB
// for a given target, enriched with rule names from the workspace's
// plan validation rules.
func loadValidationSummaries(
	ctx context.Context,
	getter Getter,
	tc targetContext,
) ([]validationSummary, error) {
	dbVals, err := getter.ListPlanTargetResultValidationsByTargetID(ctx, tc.TargetID)
	if err != nil {
		return nil, err
	}
	if len(dbVals) == 0 {
		return nil, nil
	}

	rules, err := getter.ListPlanValidationRulesByWorkspaceID(ctx, tc.WorkspaceID)
	if err != nil {
		return nil, err
	}
	ruleMap := make(map[string]db.ListPlanValidationRulesByWorkspaceIDRow, len(rules))
	for _, r := range rules {
		ruleMap[r.ID.String()] = r
	}

	summaries := make([]validationSummary, 0, len(dbVals))
	for _, v := range dbVals {
		rule, ok := ruleMap[v.RuleID.String()]
		name := v.RuleID.String()
		severity := "error"
		if ok {
			name = rule.Name
			severity = rule.Severity
		}

		var denials []string
		if err := json.Unmarshal(v.Violations, &denials); err != nil {
			denials = nil
		}

		summaries = append(summaries, validationSummary{
			RuleName: name,
			Severity: severity,
			Passed:   v.Passed,
			Denials:  denials,
		})
	}
	return summaries, nil
}

// loadTargetContext fetches the target metadata and all its results
// needed to render a check run. Rows with unparseable dispatch context
// are rendered with placeholder agent names and the parse error is
// recorded on the current span.
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

	span := trace.SpanFromContext(ctx)
	results := make([]agentResult, len(rows))
	for i, r := range rows {
		result, parseErr := agentResultFromRow(r)
		if parseErr != nil {
			span.RecordError(fmt.Errorf(
				"parse dispatch context for result %s: %w",
				r.ID, parseErr,
			))
		}
		results[i] = result
	}
	return tc, results, nil
}
