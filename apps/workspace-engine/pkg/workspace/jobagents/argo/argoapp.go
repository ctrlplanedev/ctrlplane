package argo

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"

	argocdclient "github.com/argoproj/argo-cd/v2/pkg/apiclient"
	argocdapplication "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"
	"github.com/goccy/go-yaml"
)

var _ types.Dispatchable = &ArgoApplication{}

type ArgoApplication struct {
	store *store.Store
}

func NewArgoApplication(store *store.Store) *ArgoApplication {
	return &ArgoApplication{store: store}
}

func (a *ArgoApplication) Type() string {
	return "argo-application"
}

func (a *ArgoApplication) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   true,
		Deployments: false,
	}
}

func (a *ArgoApplication) Dispatch(ctx context.Context, context types.RenderContext) error {
	jobAgentConfig := context.JobAgentConfig
	serverAddr, apiKey, template, err := a.parseJobAgentConfig(jobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}
	ioCloser, appClient, err := a.getApplicationClient(serverAddr, apiKey)
	if err != nil {
		return fmt.Errorf("failed to create ArgoCD client: %w", err)
	}
	defer ioCloser.Close()

	app, err := a.getTemplatedApplication(context, template)
	if err != nil {
		return fmt.Errorf("failed to generate application from template: %w", err)
	}

	a.makeApplicationK8sCompatible(app)
	return a.upsertApplicationWithRetry(ctx, app, appClient)
}

func (a *ArgoApplication) parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (string, string, string, error) {
	serverAddr, ok := jobAgentConfig["serverUrl"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("serverUrl is required")
	}
	apiKey, ok := jobAgentConfig["apiKey"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("apiKey is required")
	}
	template, ok := jobAgentConfig["template"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("template is required")
	}
	if serverAddr == "" || apiKey == "" || template == "" {
		return "", "", "", fmt.Errorf("missing required fields in job agent config")
	}
	return serverAddr, apiKey, template, nil
}

func (a *ArgoApplication) getApplicationClient(serverAddr, apiKey string) (io.Closer, argocdapplication.ApplicationServiceClient, error) {
	client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
		ServerAddr: serverAddr,
		AuthToken:  apiKey,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create ArgoCD client: %w", err)
	}
	return client.NewApplicationClient()
}

func (a *ArgoApplication) getTemplatedApplication(ctx types.RenderContext, template string) (*v1alpha1.Application, error) {
	t, err := templatefuncs.Parse("argoCDAgentConfig", template)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, ctx.Map()); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	var app v1alpha1.Application
	if err := yaml.Unmarshal(buf.Bytes(), &app); err != nil {
		return nil, fmt.Errorf("failed to unmarshal application: %w", err)
	}
	return &app, nil
}

func (a *ArgoApplication) makeApplicationK8sCompatible(app *v1alpha1.Application) {
	app.ObjectMeta.Name = getK8sCompatibleName(app.ObjectMeta.Name)
	if app.ObjectMeta.Labels != nil {
		for key, value := range app.ObjectMeta.Labels {
			app.ObjectMeta.Labels[key] = getK8sCompatibleName(value)
		}
	}
}

func getK8sCompatibleName(name string) string {
	cleaned := strings.ToLower(name)
	k8sInvalidCharsRegex := regexp.MustCompile(`[^a-z0-9-]`)
	cleaned = k8sInvalidCharsRegex.ReplaceAllString(cleaned, "-")

	if len(cleaned) > 63 {
		cleaned = cleaned[:63]
	}
	cleaned = strings.Trim(cleaned, "-")
	if cleaned == "" {
		return "default"
	}

	return cleaned
}

func (a *ArgoApplication) upsertApplicationWithRetry(ctx context.Context, app *v1alpha1.Application, appClient argocdapplication.ApplicationServiceClient) error {
	upsert := true
	err := retry.Do(
		func() error {
			_, createErr := appClient.Create(ctx, &argocdapplication.ApplicationCreateRequest{
				Application: app,
				Upsert:      &upsert,
			})

			if createErr != nil {
				if isRetryableError(createErr) {
					return createErr
				}

				return retry.Unrecoverable(createErr)
			}
			return nil
		},
		retry.Attempts(5),
		retry.Delay(1*time.Second),
		retry.MaxDelay(10*time.Second),
		retry.DelayType(retry.BackOffDelay),
		retry.OnRetry(func(n uint, err error) {
			log.Warn("Retrying ArgoCD application upsert",
				"attempt", n+1,
				"error", err)
		}),
		retry.Context(ctx),
	)
	return err
}

func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Check for HTTP status codes that indicate transient failures
	return strings.Contains(errStr, "502") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "504") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "temporarily unavailable")
}
