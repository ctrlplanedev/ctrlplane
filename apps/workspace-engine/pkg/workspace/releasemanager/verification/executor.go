package verification

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
)

// MeasurementExecutor handles taking measurements for verification metrics.
// It is responsible for building provider context and executing the measurement,
// but not for storing results (that's the recorder's job).
type MeasurementExecutor struct {
	store *store.Store
}

// NewMeasurementExecutor creates a new measurement executor
func NewMeasurementExecutor(store *store.Store) *MeasurementExecutor {
	return &MeasurementExecutor{store: store}
}

// Execute takes a single measurement for the given metric.
// The metric is passed directly - no store lookup required.
// Returns the measurement result or an error if measurement failed.
func (e *MeasurementExecutor) Execute(
	ctx context.Context,
	metric *oapi.VerificationMetricStatus,
	releaseID string,
) (oapi.VerificationMeasurement, error) {
	log.Debug("Executing measurement",
		"metric_name", metric.Name,
		"release_id", releaseID)

	// Build provider context from the release
	providerCtx, err := e.BuildProviderContext(releaseID)
	if err != nil {
		return oapi.VerificationMeasurement{}, fmt.Errorf("failed to build provider context: %w", err)
	}

	// Take measurement using the Measure function
	return metrics.Measure(ctx, metric, providerCtx)
}

// BuildProviderContext creates the context needed for metric providers.
// It gathers release, resource, environment, deployment, and variables from the store.
func (e *MeasurementExecutor) BuildProviderContext(releaseID string) (*provider.ProviderContext, error) {
	release, ok := e.store.Releases.Get(releaseID)
	if !ok {
		return nil, fmt.Errorf("release not found: %s", releaseID)
	}

	// Get the resource
	resource, _ := e.store.Resources.Get(release.ReleaseTarget.ResourceId)

	// Get the environment
	environment, _ := e.store.Environments.Get(release.ReleaseTarget.EnvironmentId)

	// Get the deployment
	deployment, _ := e.store.Deployments.Get(release.Version.DeploymentId)

	// Get variables from release
	variables := make(map[string]any)
	for k, v := range release.Variables {
		variables[k] = v
	}

	return &provider.ProviderContext{
		Release:     release,
		Resource:    resource,
		Environment: environment,
		Version:     &release.Version,
		Target:      &release.ReleaseTarget,
		Deployment:  deployment,
		Variables:   variables,
	}, nil
}
