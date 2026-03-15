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
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/charmbracelet/log"
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

type argoPlanState struct {
	TmpAppName string `json:"tmpAppName"`
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

	stateJSON, err := json.Marshal(s)
	if err != nil {
		return nil, fmt.Errorf("marshal plan state: %w", err)
	}

	tmpApp := prepareTmpApp(proposedApp, s.TmpAppName)
	if err := p.upserter.UpsertApplication(ctx, serverAddr, apiKey, tmpApp); err != nil {
		return nil, fmt.Errorf("upsert temporary plan application: %w", err)
	}

	proposedManifests, err := p.manifestGetter.GetManifests(ctx, serverAddr, apiKey, s.TmpAppName)
	if err != nil || len(proposedManifests) == 0 {
		return &types.PlanResult{
			State: stateJSON,
		}, nil
	}

	currentManifests, err := p.manifestGetter.GetManifests(ctx, serverAddr, apiKey, originalName)
	if err != nil {
		p.deleteTmpApp(ctx, serverAddr, apiKey, s.TmpAppName)
		return nil, fmt.Errorf("get current manifests: %w", err)
	}

	sort.Strings(currentManifests)
	sort.Strings(proposedManifests)

	current := strings.Join(currentManifests, "---\n")
	proposed := strings.Join(proposedManifests, "---\n")

	hasChanges := current != proposed
	contentHash := sha256.Sum256([]byte(current + proposed))

	p.deleteTmpApp(ctx, serverAddr, apiKey, s.TmpAppName)

	now := time.Now()
	return &types.PlanResult{
		ContentHash: hex.EncodeToString(contentHash[:]),
		Current:     current,
		Proposed:    proposed,
		HasChanges:  hasChanges,
		CompletedAt: &now,
	}, nil
}
