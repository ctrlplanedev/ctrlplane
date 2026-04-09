package argo

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/argoproj/argo-cd/v3/pkg/apis/application/v1alpha1"
	"github.com/charmbracelet/log"
	"workspace-engine/pkg/jobagents/types"
	"workspace-engine/pkg/oapi"
)

const (
	planLabelKey     = "ctrlplane.dev/plan"
	planCreatedAtKey = "ctrlplane.dev/plan-created-at"
	planTTL          = 30 * time.Minute
)

var _ types.Plannable = (*ArgoCDPlanner)(nil)

// ArgoCDPlanner computes a dry-run diff by creating a temporary ArgoCD
// application, comparing its rendered manifests to the current application,
// and cleaning up. It implements [types.Plannable].
type ArgoCDPlanner struct {
	upserter       ApplicationUpserter
	deleter        ApplicationDeleter
	manifestGetter ManifestGetter
}

// NewArgoCDPlanner creates an ArgoCDPlanner with the given dependencies.
func NewArgoCDPlanner(
	upserter ApplicationUpserter,
	deleter ApplicationDeleter,
	manifestGetter ManifestGetter,
) *ArgoCDPlanner {
	return &ArgoCDPlanner{
		upserter:       upserter,
		deleter:        deleter,
		manifestGetter: manifestGetter,
	}
}

func (p *ArgoCDPlanner) Type() string {
	return "argo-cd"
}

const manifestTimeout = 60 * time.Second

type argoPlanState struct {
	TmpAppName     string     `json:"tmpAppName"`
	ManifestChecks int        `json:"manifestChecks"`
	FirstCheckedAt *time.Time `json:"firstCheckedAt,omitempty"`
	LastCheckedAt  *time.Time `json:"lastCheckedAt,omitempty"`
}

func planAppName(originalName string) string {
	h := sha256.Sum256([]byte(originalName + time.Now().String()))
	return fmt.Sprintf("%s-plan-%s", originalName, hex.EncodeToString(h[:4]))
}

func prepareTmpApp(app *v1alpha1.Application, tmpName string) *v1alpha1.Application {
	tmp := app.DeepCopy()
	tmp.Name = tmpName
	tmp.ResourceVersion = ""

	if tmp.Labels == nil {
		tmp.Labels = map[string]string{}
	}
	tmp.Labels[planLabelKey] = "true"
	if tmp.Annotations == nil {
		tmp.Annotations = map[string]string{}
	}
	tmp.Annotations[planCreatedAtKey] = time.Now().UTC().Format(time.RFC3339)

	tmp.Spec.SyncPolicy = &v1alpha1.SyncPolicy{Automated: nil}
	tmp.Operation = nil
	return tmp
}

func (p *ArgoCDPlanner) deleteTmpApp(ctx context.Context, serverAddr, apiKey, name string) {
	if err := p.deleter.DeleteApplication(ctx, serverAddr, apiKey, name); err != nil {
		log.Warn("Failed to delete temporary plan application", "app", name, "error", err)
	}
}

func (p *ArgoCDPlanner) Plan(
	ctx context.Context,
	dispatchCtx *oapi.DispatchContext,
	state json.RawMessage,
) (*types.PlanResult, error) {
	serverAddr, apiKey, template, err := ParseJobAgentConfig(
		dispatchCtx.JobAgentConfig,
	)
	if err != nil {
		return nil, err
	}

	proposedApp, err := TemplateApplication(dispatchCtx, template)
	if err != nil {
		return nil, err
	}

	MakeApplicationK8sCompatible(proposedApp)
	originalName := proposedApp.Name

	var s argoPlanState
	if state != nil {
		if err := json.Unmarshal(state, &s); err != nil {
			return nil, fmt.Errorf("unmarshal plan state: %w", err)
		}
	}
	if s.TmpAppName == "" {
		s.TmpAppName = planAppName(originalName)
	}

	tmpApp := prepareTmpApp(proposedApp, s.TmpAppName)
	if err := p.upserter.UpsertApplication(ctx, serverAddr, apiKey, tmpApp); err != nil {
		return nil, fmt.Errorf("upsert temporary plan application: %w", err)
	}

	now := time.Now()

	proposedManifests, manifestErr := p.manifestGetter.GetManifests(
		ctx,
		serverAddr,
		apiKey,
		s.TmpAppName,
	)
	if manifestErr != nil || len(proposedManifests) == 0 {
		if s.FirstCheckedAt == nil {
			s.FirstCheckedAt = &now
		}
		s.LastCheckedAt = &now
		s.ManifestChecks++

		elapsed := now.Sub(*s.FirstCheckedAt)
		if elapsed >= manifestTimeout {
			p.deleteTmpApp(ctx, serverAddr, apiKey, s.TmpAppName)
			if manifestErr != nil {
				return nil, fmt.Errorf(
					"get proposed manifests after %s (%d checks): %w",
					elapsed.Round(time.Second),
					s.ManifestChecks,
					manifestErr,
				)
			}
			return nil, fmt.Errorf(
				"no manifests found after %s (%d checks)",
				elapsed.Round(time.Second),
				s.ManifestChecks,
			)
		}

		retryState, err := json.Marshal(s)
		if err != nil {
			return nil, fmt.Errorf("marshal plan state: %w", err)
		}

		msg := fmt.Sprintf(
			"Waiting for manifests to render (check %d, %s elapsed)",
			s.ManifestChecks,
			elapsed.Round(time.Second),
		)
		if manifestErr != nil {
			msg = fmt.Sprintf(
				"Retrying manifest fetch (check %d, %s elapsed): %s",
				s.ManifestChecks,
				elapsed.Round(time.Second),
				manifestErr.Error(),
			)
		}
		return &types.PlanResult{
			State:   retryState,
			Message: msg,
		}, nil
	}
	defer p.deleteTmpApp(ctx, serverAddr, apiKey, s.TmpAppName)

	currentManifests, err := p.manifestGetter.GetManifests(ctx, serverAddr, apiKey, originalName)
	if err != nil {
		return nil, fmt.Errorf("get current manifests: %w", err)
	}

	sort.Strings(currentManifests)
	sort.Strings(proposedManifests)

	current := strings.Join(currentManifests, "---\n")
	proposed := strings.Join(proposedManifests, "---\n")

	hasChanges := current != proposed
	contentHash := sha256.Sum256([]byte(current + proposed))

	completedAt := time.Now()
	return &types.PlanResult{
		ContentHash: hex.EncodeToString(contentHash[:]),
		Current:     current,
		Proposed:    proposed,
		HasChanges:  hasChanges,
		CompletedAt: &completedAt,
	}, nil
}
