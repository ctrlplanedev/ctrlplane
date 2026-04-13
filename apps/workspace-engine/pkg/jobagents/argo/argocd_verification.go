package argo

import (
	"fmt"
	"strings"

	"workspace-engine/pkg/oapi"
)

// Verifications returns the ArgoCD application health check spec built from
// the agent config and dispatch context. The dispatch context is used to
// render the application template and determine the specific application
// name to query.
func (a *ArgoApplication) Verifications(
	config oapi.JobAgentConfig,
	dispatchCtx *oapi.DispatchContext,
) ([]oapi.VerificationMetricSpec, error) {
	serverAddr, ok := config["serverUrl"].(string)
	if !ok || serverAddr == "" {
		return nil, nil
	}
	apiKey, ok := config["apiKey"].(string)
	if !ok || apiKey == "" {
		return nil, nil
	}
	template, ok := config["template"].(string)
	if !ok || template == "" {
		return nil, nil
	}

	app, err := TemplateApplication(dispatchCtx, template)
	if err != nil {
		return nil, fmt.Errorf("render application template: %w", err)
	}
	MakeApplicationK8sCompatible(app)

	baseURL := serverAddr
	if !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}
	appURL := fmt.Sprintf("%s/api/v1/applications/%s", baseURL, app.Name)

	method := oapi.GET
	timeout := "5s"
	headers := map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s", apiKey),
	}
	var provider oapi.MetricProvider
	if err := provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:     appURL,
		Method:  &method,
		Timeout: &timeout,
		Headers: &headers,
		Type:    oapi.Http,
	}); err != nil {
		return nil, fmt.Errorf("build argocd health check provider: %w", err)
	}

	successThreshold := 1
	failureCondition := "result.statusCode != 200 || result.json.status.health.status == 'Degraded' || result.json.status.health.status == 'Missing'"
	spec := oapi.VerificationMetricSpec{
		Name:             "argocd-application-health",
		IntervalSeconds:  60,
		Count:            10,
		SuccessThreshold: &successThreshold,
		SuccessCondition: "result.statusCode == 200 && result.json.status.sync.status == 'Synced' && result.json.status.health.status == 'Healthy'",
		FailureCondition: &failureCondition,
		Provider:         provider,
	}
	return []oapi.VerificationMetricSpec{spec}, nil
}
