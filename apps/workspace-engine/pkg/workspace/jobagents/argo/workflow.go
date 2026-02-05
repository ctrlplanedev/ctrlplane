package argo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"

	"sigs.k8s.io/yaml"
)

const (
	defaultWorkflowNamespace    = "default"
	maxGenerateNamePrefixLength = 58
)

var _ types.Dispatchable = &ArgoWorkflow{}

type ArgoWorkflow struct {
	store      *store.Store
	httpClient *http.Client
}

func NewArgoWorkflow(store *store.Store) *ArgoWorkflow {
	return &ArgoWorkflow{
		store: store,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func NewArgoWorkflowWithClient(store *store.Store, client *http.Client) *ArgoWorkflow {
	return &ArgoWorkflow{
		store:      store,
		httpClient: client,
	}
}

func (a *ArgoWorkflow) Type() string {
	return "argo-workflows"
}

func (a *ArgoWorkflow) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   true,
		Deployments: true,
	}
}

func (a *ArgoWorkflow) Dispatch(ctx context.Context, dispatchCtx types.DispatchContext) error {
	cfg, err := a.parseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	workflow, namespace, err := a.getTemplatedWorkflow(dispatchCtx, cfg.Template, cfg.Namespace)
	if err != nil {
		return fmt.Errorf("failed to generate workflow from template: %w", err)
	}

	go func() {
		ctx := context.WithoutCancel(ctx)
		if err := a.createWorkflow(ctx, cfg.ServerUrl, cfg.ApiKey, namespace, workflow); err != nil {
			message := fmt.Sprintf("failed to create Argo Workflow: %s", err.Error())
			dispatchCtx.Job.Status = oapi.JobStatusInvalidIntegration
			dispatchCtx.Job.UpdatedAt = time.Now()
			dispatchCtx.Job.Message = &message
			a.store.Jobs.Upsert(ctx, dispatchCtx.Job)
		}
	}()

	return nil
}

type argoWorkflowConfig struct {
	ServerUrl string
	ApiKey    string
	Template  string
	Namespace string
}

func (a *ArgoWorkflow) parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (argoWorkflowConfig, error) {
	serverAddr, ok := jobAgentConfig["serverUrl"].(string)
	if !ok || serverAddr == "" {
		return argoWorkflowConfig{}, fmt.Errorf("serverUrl is required")
	}
	apiKey, ok := jobAgentConfig["apiKey"].(string)
	if !ok || apiKey == "" {
		return argoWorkflowConfig{}, fmt.Errorf("apiKey is required")
	}
	template, ok := jobAgentConfig["template"].(string)
	if !ok || template == "" {
		return argoWorkflowConfig{}, fmt.Errorf("template is required")
	}
	namespace, _ := jobAgentConfig["namespace"].(string)
	return argoWorkflowConfig{
		ServerUrl: serverAddr,
		ApiKey:    apiKey,
		Template:  template,
		Namespace: namespace,
	}, nil
}

func (a *ArgoWorkflow) getTemplatedWorkflow(
	ctx types.DispatchContext,
	template string,
	configNamespace string,
) (map[string]any, string, error) {
	t, err := templatefuncs.Parse("argoWorkflowAgentConfig", template)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, ctx.Map()); err != nil {
		return nil, "", fmt.Errorf("failed to execute template: %w", err)
	}

	var workflow map[string]any
	if err := yaml.Unmarshal(buf.Bytes(), &workflow); err != nil {
		return nil, "", fmt.Errorf("failed to unmarshal workflow: %w", err)
	}
	if workflow == nil {
		return nil, "", fmt.Errorf("workflow template rendered empty")
	}

	apiVersion, ok := workflow["apiVersion"].(string)
	if !ok || apiVersion == "" {
		workflow["apiVersion"] = "argoproj.io/v1alpha1"
	}
	kind, ok := workflow["kind"].(string)
	if !ok || kind == "" {
		workflow["kind"] = "Workflow"
	}

	namespace := resolveWorkflowNamespace(workflow, configNamespace)
	ensureWorkflowIdentity(workflow, ctx.Job.Id)

	return workflow, namespace, nil
}

func resolveWorkflowNamespace(workflow map[string]any, configNamespace string) string {
	metadata := getOrCreateStringMap(workflow, "metadata")
	if configNamespace != "" {
		metadata["namespace"] = configNamespace
		return configNamespace
	}
	if existing, ok := metadata["namespace"].(string); ok && existing != "" {
		return existing
	}
	metadata["namespace"] = defaultWorkflowNamespace
	return defaultWorkflowNamespace
}

func ensureWorkflowIdentity(workflow map[string]any, jobID string) {
	metadata := getOrCreateStringMap(workflow, "metadata")
	if name, ok := metadata["name"].(string); ok && name != "" {
		metadata["name"] = getK8sCompatibleName(name)
		return
	}
	if generateName, ok := metadata["generateName"].(string); ok && generateName != "" {
		metadata["generateName"] = sanitizeGenerateName(generateName)
		return
	}
	metadata["generateName"] = sanitizeGenerateName(fmt.Sprintf("ctrlplane-%s", jobID))
}

func sanitizeGenerateName(prefix string) string {
	cleaned := getK8sCompatibleName(strings.TrimSuffix(prefix, "-"))
	if cleaned == "" {
		cleaned = "ctrlplane"
	}
	if len(cleaned) > maxGenerateNamePrefixLength-1 {
		cleaned = cleaned[:maxGenerateNamePrefixLength-1]
	}
	return cleaned + "-"
}

func (a *ArgoWorkflow) createWorkflow(
	ctx context.Context,
	serverUrl string,
	apiKey string,
	namespace string,
	workflow map[string]any,
) error {
	baseURL := normalizeServerURL(serverUrl)
	if baseURL == "" {
		return fmt.Errorf("serverUrl is required")
	}

	workflowURL := fmt.Sprintf("%s/api/v1/workflows/%s", strings.TrimRight(baseURL, "/"), namespace)

	payload, err := json.Marshal(workflow)
	if err != nil {
		return fmt.Errorf("failed to marshal workflow: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, workflowURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := a.httpClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		bodyText := strings.TrimSpace(string(responseBody))
		if bodyText == "" {
			bodyText = "no response body"
		}
		return fmt.Errorf("unexpected response status %s: %s", resp.Status, bodyText)
	}

	return nil
}

func normalizeServerURL(serverURL string) string {
	trimmed := strings.TrimSpace(serverURL)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed
	}
	return "https://" + trimmed
}

func getOrCreateStringMap(parent map[string]any, key string) map[string]any {
	if existing, ok := parent[key]; ok {
		if mapped := toStringMap(existing); mapped != nil {
			parent[key] = mapped
			return mapped
		}
	}
	mapped := map[string]any{}
	parent[key] = mapped
	return mapped
}

func toStringMap(value any) map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return typed
	case map[string]interface{}:
		return typed
	case map[any]any:
		converted := make(map[string]any, len(typed))
		for key, val := range typed {
			keyString, ok := key.(string)
			if !ok {
				continue
			}
			converted[keyString] = val
		}
		return converted
	default:
		return nil
	}
}
