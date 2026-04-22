package deploymentplanresult

import (
	"encoding/json"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

// --- helpers ---

func completedResult(name string, hasChanges bool, current, proposed string) agentResult {
	return agentResult{
		AgentName:  name,
		AgentType:  "argo-cd",
		Status:     db.DeploymentPlanTargetStatusCompleted,
		HasChanges: &hasChanges,
		Current:    current,
		Proposed:   proposed,
	}
}

func erroredResult(name, msg string) agentResult {
	return agentResult{
		AgentName: name,
		AgentType: "argo-cd",
		Status:    db.DeploymentPlanTargetStatusErrored,
		Message:   msg,
	}
}

func computingResult(name string) agentResult {
	return agentResult{
		AgentName: name,
		AgentType: "argo-cd",
		Status:    db.DeploymentPlanTargetStatusComputing,
	}
}

func unsupportedResult(name string) agentResult {
	return agentResult{
		AgentName: name,
		AgentType: "github-app",
		Status:    db.DeploymentPlanTargetStatusUnsupported,
	}
}

// --- aggregateResults ---

func TestAggregateResults_Counts(t *testing.T) {
	results := []agentResult{
		completedResult("a", true, "old", "new"),
		completedResult("b", false, "same", "same"),
		erroredResult("c", "boom"),
		computingResult("d"),
		unsupportedResult("e"),
	}

	agg := aggregateResults(results)

	assert.Equal(t, 5, agg.Total)
	assert.Equal(t, 2, agg.Completed)
	assert.Equal(t, 1, agg.Errored)
	assert.Equal(t, 1, agg.Unsupported)
	assert.Equal(t, 1, agg.Changed)
	assert.Equal(t, 1, agg.Unchanged)
}

func TestAggregateResults_Empty(t *testing.T) {
	agg := aggregateResults(nil)
	assert.Equal(t, aggregate{}, agg)
	assert.False(t, agg.allDone())
	assert.False(t, agg.shouldFinalize())
}

// --- aggregate state transitions ---

func TestAggregate_AllDone(t *testing.T) {
	tests := []struct {
		name    string
		agg     aggregate
		allDone bool
	}{
		{"empty", aggregate{}, false},
		{"in progress", aggregate{Total: 2, Completed: 1}, false},
		{"all completed", aggregate{Total: 2, Completed: 2}, true},
		{"mixed terminals", aggregate{Total: 3, Completed: 1, Errored: 1, Unsupported: 1}, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.allDone, tc.agg.allDone())
		})
	}
}

func TestAggregate_ShouldFinalize_ImmediateOnError(t *testing.T) {
	// An errored agent should finalize the check even while others are
	// still in progress, so failures surface immediately on the PR.
	agg := aggregate{Total: 3, Errored: 1}
	assert.True(t, agg.shouldFinalize())
	assert.False(t, agg.allDone())
}

func TestAggregate_CheckStatus(t *testing.T) {
	assert.Equal(t, "in_progress", aggregate{Total: 2, Completed: 1}.checkStatus())
	assert.Equal(t, "completed", aggregate{Total: 2, Completed: 2}.checkStatus())
	assert.Equal(t, "completed", aggregate{Total: 3, Errored: 1}.checkStatus())
}

func TestAggregate_CheckConclusion(t *testing.T) {
	tests := []struct {
		name       string
		agg        aggregate
		conclusion string
	}{
		{"any errored -> failure", aggregate{Total: 2, Completed: 1, Errored: 1}, "failure"},
		{"all unsupported -> skipped", aggregate{Total: 2, Unsupported: 2}, "skipped"},
		{"has changes -> neutral", aggregate{Total: 2, Completed: 2, Changed: 1}, "neutral"},
		{"all clean -> success", aggregate{Total: 2, Completed: 2, Unchanged: 2}, "success"},
		{
			"unsupported + success -> success (some agent ran cleanly)",
			aggregate{Total: 2, Completed: 1, Unchanged: 1, Unsupported: 1},
			"success",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.conclusion, tc.agg.checkConclusion())
		})
	}
}

func TestAggregate_CheckTitle(t *testing.T) {
	tests := []struct {
		name  string
		agg   aggregate
		title string
	}{
		{
			"in progress",
			aggregate{Total: 3, Completed: 1},
			"Computing... (1/3 agents)",
		},
		{
			"errored while others still running",
			aggregate{Total: 3, Completed: 1, Errored: 1, Unsupported: 0},
			"1 errored, 0 unsupported (2/3 agents complete)",
		},
		{
			"final errored summary includes unsupported",
			aggregate{Total: 3, Completed: 1, Errored: 1, Unsupported: 1, Changed: 1},
			"1 errored, 1 changed, 0 unchanged, 1 unsupported",
		},
		{
			"final with changes includes unsupported",
			aggregate{Total: 3, Completed: 2, Changed: 1, Unchanged: 1, Unsupported: 1},
			"1 changed, 1 unchanged, 1 unsupported",
		},
		{
			"final no changes with some unsupported",
			aggregate{Total: 3, Completed: 2, Unchanged: 2, Unsupported: 1},
			"No changes (1 unsupported)",
		},
		{
			"final no changes",
			aggregate{Total: 2, Completed: 2, Unchanged: 2},
			"No changes",
		},
		{
			"all unsupported",
			aggregate{Total: 2, Unsupported: 2},
			"All agents unsupported",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.title, tc.agg.checkTitle())
		})
	}
}

func TestTruncateText(t *testing.T) {
	t.Run("short input passes through untouched", func(t *testing.T) {
		in := "hello world"
		assert.Equal(t, in, truncateText(in, maxCheckRunTextBytes))
	})

	t.Run("long input is trimmed with sentinel", func(t *testing.T) {
		in := strings.Repeat("x", maxCheckRunTextBytes+10)
		out := truncateText(in, maxCheckRunTextBytes)
		assert.LessOrEqual(t, len(out), maxCheckRunTextBytes)
		assert.True(t, strings.HasSuffix(out, truncationSentinel))
	})

	t.Run("respects utf-8 rune boundaries", func(t *testing.T) {
		// 'é' is two bytes (C3 A9). Fill with enough 'é' to exceed limit.
		rune2Byte := "é"
		in := strings.Repeat(rune2Byte, maxCheckRunTextBytes)
		out := truncateText(in, maxCheckRunTextBytes)
		assert.True(t, utf8.ValidString(out), "truncated output should be valid UTF-8")
	})
}

// --- formatAgentSection ---

func TestFormatAgentSection_Errored(t *testing.T) {
	s := formatAgentSection(erroredResult("my-agent", "connection refused"))
	assert.Contains(t, s, "### my-agent")
	assert.Contains(t, s, "❌")
	assert.Contains(t, s, "connection refused")
	assert.NotContains(t, s, "```diff")
}

func TestFormatAgentSection_Unsupported(t *testing.T) {
	s := formatAgentSection(unsupportedResult("gha"))
	assert.Contains(t, s, "### gha")
	assert.Contains(t, s, "does not support plan")
	assert.NotContains(t, s, "```diff")
}

func TestFormatAgentSection_Computing(t *testing.T) {
	s := formatAgentSection(computingResult("argo"))
	assert.Contains(t, s, "### argo")
	assert.Contains(t, s, "Computing")
	assert.NotContains(t, s, "```diff")
}

func TestFormatAgentSection_NoChanges(t *testing.T) {
	s := formatAgentSection(completedResult("argo", false, "", ""))
	assert.Contains(t, s, "### argo")
	assert.Contains(t, s, "No changes")
	assert.NotContains(t, s, "```diff")
}

func TestFormatAgentSection_HasChanges_RendersUnifiedDiff(t *testing.T) {
	current := "replicas: 1\n"
	proposed := "replicas: 3\n"
	s := formatAgentSection(completedResult("argo", true, current, proposed))
	assert.Contains(t, s, "```diff")
	assert.Contains(t, s, "--- current")
	assert.Contains(t, s, "+++ proposed")
	assert.Contains(t, s, "-replicas: 1")
	assert.Contains(t, s, "+replicas: 3")
}

// --- buildCheckOutput ---

func TestBuildCheckOutput_IncludesAllSections(t *testing.T) {
	tc := targetContext{
		TargetID:        uuid.New(),
		PlanID:          uuid.New(),
		DeploymentID:    uuid.New(),
		WorkspaceSlug:   "acme",
		EnvironmentName: "prod",
		ResourceName:    "us-east-1",
		VersionTag:      "v1.2.3",
	}
	results := []agentResult{
		completedResult("argo", true, "old\n", "new\n"),
		erroredResult("gha", "boom"),
	}
	agg := aggregateResults(results)

	out := buildCheckOutput(tc, uuid.New(), results, agg)

	require.NotNil(t, out)
	require.NotNil(t, out.Title)
	require.NotNil(t, out.Summary)
	require.NotNil(t, out.Text)

	assert.Contains(t, *out.Summary, "v1.2.3")
	assert.Contains(t, *out.Summary, "/acme/deployments/")
	assert.Contains(t, *out.Summary, tc.PlanID.String())

	assert.Contains(t, *out.Text, "### argo")
	assert.Contains(t, *out.Text, "### gha")
	assert.Contains(t, *out.Text, "```diff")
	assert.Contains(t, *out.Text, "❌")

	// sections separated by ---
	assert.Equal(t, 2, strings.Count(*out.Text, "### "))
}

// --- targetContext / hasGitHubMetadata ---

func TestTargetContextFromRow_ExtractsMetadata(t *testing.T) {
	row := db.GetTargetContextByResultIDRow{
		TargetID:        uuid.New(),
		PlanID:          uuid.New(),
		DeploymentID:    uuid.New(),
		WorkspaceID:     uuid.New(),
		VersionTag:      "v1",
		WorkspaceSlug:   "acme",
		EnvironmentName: "prod",
		ResourceName:    "us-east-1",
		VersionMetadata: map[string]string{
			"github/owner": "wandb",
			"github/repo":  "deployments",
			"git/sha":      "abc123",
		},
	}
	tc := targetContextFromRow(row)

	assert.Equal(t, "wandb", tc.Owner)
	assert.Equal(t, "deployments", tc.Repo)
	assert.Equal(t, "abc123", tc.SHA)
	assert.True(t, tc.hasGitHubMetadata())
}

func TestTargetContext_HasGitHubMetadata(t *testing.T) {
	tests := []struct {
		name string
		tc   targetContext
		ok   bool
	}{
		{"all set", targetContext{Owner: "o", Repo: "r", SHA: "s"}, true},
		{"missing owner", targetContext{Repo: "r", SHA: "s"}, false},
		{"missing repo", targetContext{Owner: "o", SHA: "s"}, false},
		{"missing sha", targetContext{Owner: "o", Repo: "r"}, false},
		{"all empty", targetContext{}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.ok, tc.tc.hasGitHubMetadata())
		})
	}
}

// --- agentResultFromRow ---

func TestAgentResultFromRow_ValidDispatchContext(t *testing.T) {
	dc := oapi.DispatchContext{
		JobAgent: oapi.JobAgent{Name: "my-argo", Type: "argo-cd"},
	}
	raw, err := json.Marshal(dc)
	require.NoError(t, err)

	row := db.ListDeploymentPlanTargetResultsByTargetIDRow{
		ID:              uuid.New(),
		DispatchContext: raw,
		Status:          db.DeploymentPlanTargetStatusCompleted,
		HasChanges:      pgtype.Bool{Bool: true, Valid: true},
		Current:         pgtype.Text{String: "a", Valid: true},
		Proposed:        pgtype.Text{String: "b", Valid: true},
	}

	result, err := agentResultFromRow(row)
	require.NoError(t, err)
	assert.Equal(t, "my-argo", result.AgentName)
	assert.Equal(t, "argo-cd", result.AgentType)
	require.NotNil(t, result.HasChanges)
	assert.True(t, *result.HasChanges)
}

func TestAgentResultFromRow_UnparseableDispatchContext_FallsBackWithPlaceholders(t *testing.T) {
	row := db.ListDeploymentPlanTargetResultsByTargetIDRow{
		ID:              uuid.New(),
		DispatchContext: []byte("not valid json"),
		Status:          db.DeploymentPlanTargetStatusCompleted,
	}

	result, err := agentResultFromRow(row)

	require.Error(t, err)
	assert.Equal(t, "(unknown agent)", result.AgentName)
	assert.Equal(t, "unknown", result.AgentType)
	assert.Equal(t, db.DeploymentPlanTargetStatusCompleted, result.Status)
}

func TestAgentResultFromRow_NullHasChanges(t *testing.T) {
	dc := oapi.DispatchContext{JobAgent: oapi.JobAgent{Name: "x", Type: "y"}}
	raw, _ := json.Marshal(dc)
	row := db.ListDeploymentPlanTargetResultsByTargetIDRow{
		ID:              uuid.New(),
		DispatchContext: raw,
		HasChanges:      pgtype.Bool{Valid: false},
	}

	result, err := agentResultFromRow(row)
	require.NoError(t, err)
	assert.Nil(t, result.HasChanges)
}

// --- url / name helpers ---

func TestCheckRunName(t *testing.T) {
	assert.Equal(t, "ctrlplane / prod / us-east-1", checkRunName("prod", "us-east-1"))
}
