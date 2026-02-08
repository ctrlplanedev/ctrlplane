package terraformcloud

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification"
)

type TFERunVerification struct {
	verifications *verification.Manager
	job           *oapi.Job
	address       string
	token         string
	runID         string
}

func newTFERunVerification(verifications *verification.Manager, job *oapi.Job, address, token, runID string) *TFERunVerification {
	return &TFERunVerification{
		verifications: verifications,
		job:           job,
		address:       address,
		token:         token,
		runID:         runID,
	}
}

func (v *TFERunVerification) StartVerification(ctx context.Context) error {
	provider, err := v.buildMetricProvider()
	if err != nil {
		return fmt.Errorf("failed to build metric provider: %w", err)
	}

	metricSpec := v.buildMetricSpec(provider)
	return v.verifications.StartVerification(ctx, v.job, []oapi.VerificationMetricSpec{metricSpec})
}

func (v *TFERunVerification) buildMetricProvider() (oapi.MetricProvider, error) {
	provider := oapi.MetricProvider{}
	err := provider.FromTerraformCloudRunMetricProvider(oapi.TerraformCloudRunMetricProvider{
		Address: v.address,
		Token:   v.token,
		RunId:   v.runID,
	})
	return provider, err
}

func (v *TFERunVerification) buildMetricSpec(provider oapi.MetricProvider) oapi.VerificationMetricSpec {
	failureCondition := "result.status == 'canceled' || result.status == 'discarded' || result.status == 'errored'"
	successThreshold := 1
	failureThreshold := 1
	return oapi.VerificationMetricSpec{
		Count:            100,
		IntervalSeconds:  60,
		SuccessCondition: "result.status == 'applied' || result.status == 'planned_and_finished' || result.status == 'planned_and_saved'",
		FailureCondition: &failureCondition,
		SuccessThreshold: &successThreshold,
		FailureThreshold: &failureThreshold,
		Provider:         provider,
	}
}
