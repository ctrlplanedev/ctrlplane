package argo

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"
)

const (
	planLabelKey     = "ctrlplane.dev/plan"
	planCreatedAtKey = "ctrlplane.dev/plan-created-at"
	planTTL          = 30 * time.Minute
)

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

func (a *ArgoApplication) Plan(
	ctx context.Context,
	dispatchCtx *oapi.DispatchContext,
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
	tmpName := planAppName(originalName)
	tmpApp := prepareTmpApp(proposedApp, tmpName)

	if err := a.upserter.UpsertApplication(ctx, serverAddr, apiKey, tmpApp); err != nil {
		return nil, fmt.Errorf("create temporary plan application: %w", err)
	}
	defer func() {
		if err := a.deleter.DeleteApplication(context.Background(), serverAddr, apiKey, tmpName); err != nil {
			log.Warn("Failed to delete temporary plan application", "app", tmpName, "error", err)
		}
	}()

	if err := a.waitForManifests(ctx, serverAddr, apiKey, tmpName); err != nil {
		return nil, fmt.Errorf("wait for temporary app manifests: %w", err)
	}

	proposedManifests, err := a.manifestGetter.GetManifests(ctx, serverAddr, apiKey, tmpName)
	if err != nil {
		return nil, fmt.Errorf("get proposed manifests: %w", err)
	}

	currentManifests, err := a.manifestGetter.GetManifests(ctx, serverAddr, apiKey, originalName)
	if err != nil {
		return nil, fmt.Errorf("get current manifests: %w", err)
	}

	sort.Strings(currentManifests)
	sort.Strings(proposedManifests)

	current := strings.Join(currentManifests, "---\n")
	proposed := strings.Join(proposedManifests, "---\n")

	hasChanges := current != proposed
	contentHash := sha256.Sum256([]byte(current + proposed))

	return &types.PlanResult{
		ContentHash: hex.EncodeToString(contentHash[:]),
		Current:     current,
		Proposed:    proposed,
		HasChanges:  hasChanges,
	}, nil
}

func (a *ArgoApplication) waitForManifests(
	ctx context.Context,
	serverAddr, apiKey, name string,
) error {
	return retry.Do(
		func() error {
			manifests, err := a.manifestGetter.GetManifests(ctx, serverAddr, apiKey, name)
			if err != nil {
				return err
			}
			if len(manifests) == 0 {
				return fmt.Errorf("no manifests available yet for %s", name)
			}
			return nil
		},
		retry.Attempts(15),
		retry.Delay(2*time.Second),
		retry.MaxDelay(10*time.Second),
		retry.DelayType(retry.BackOffDelay),
		retry.OnRetry(func(n uint, err error) {
			log.Warn("Waiting for plan manifests",
				"app", name,
				"attempt", n+1,
				"error", err)
		}),
		retry.Context(ctx),
	)
}
