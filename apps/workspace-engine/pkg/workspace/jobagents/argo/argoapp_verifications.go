package argo

import (
	"context"
	"fmt"
	"strings"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification"
)

type ArgoApplicationVerification struct {
	verifications *verification.Manager

	appName   string
	serverUrl string
	apiKey    string

	job *oapi.Job
}

func newArgoApplicationVerification(verifications *verification.Manager, job *oapi.Job, appName, serverUrl, apiKey string) *ArgoApplicationVerification {
	return &ArgoApplicationVerification{
		verifications: verifications,
		job:           job,
		appName:       appName,
		serverUrl:     serverUrl,
		apiKey:        apiKey,
	}
}

func (v *ArgoApplicationVerification) StartVerification(ctx context.Context, job *oapi.Job) error {
	appURL := v.buildAppURL()

	provider, err := v.buildMetricProvider(appURL)
	if err != nil {
		return fmt.Errorf("failed to build metric provider: %w", err)
	}

	metricSpec := v.buildMetricSpec(provider)
	return v.verifications.StartVerification(ctx, v.job, []oapi.VerificationMetricSpec{metricSpec})
}

func (v *ArgoApplicationVerification) buildAppURL() string {
	baseURL := v.serverUrl
	if !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}
	return fmt.Sprintf("%s/api/v1/applications/%s", baseURL, v.appName)
}

func (v *ArgoApplicationVerification) buildMetricProvider(appURL string) (oapi.MetricProvider, error) {
	method := oapi.GET
	timeout := "5s"
	headers := map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s", v.apiKey),
	}
	provider := oapi.MetricProvider{}
	err := provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:     appURL,
		Method:  &method,
		Timeout: &timeout,
		Headers: &headers,
		Type:    oapi.Http,
	})
	return provider, err
}

func (v *ArgoApplicationVerification) buildMetricSpec(provider oapi.MetricProvider) oapi.VerificationMetricSpec {
	successThreshold := 1
	failureCondition := "result.statusCode != 200 || result.json.status.health.status == 'Degraded' || result.json.status.health.status == 'Missing'"
	return oapi.VerificationMetricSpec{
		Name:             fmt.Sprintf("%s-argocd-application-health", v.appName),
		IntervalSeconds:  60,
		Count:            10,
		SuccessThreshold: &successThreshold,
		SuccessCondition: "result.statusCode == 200 && result.json.status.sync.status == 'Synced' && result.json.status.health.status == 'Healthy'",
		FailureCondition: &failureCondition,
		Provider:         provider,
	}
}
