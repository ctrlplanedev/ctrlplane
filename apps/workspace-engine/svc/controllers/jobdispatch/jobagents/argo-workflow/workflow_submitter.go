package argo_workflows

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"os"

	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"
	"github.com/goccy/go-yaml"

	argoapiclient "github.com/argoproj/argo-workflows/v3/pkg/apiclient"
	wfv1 "github.com/argoproj/argo-workflows/v3/pkg/apis/workflow/v1alpha1"
	"sigs.k8s.io/yaml"
)

type submitWorkflowRequest struct {
	Workflow *Workflow `json:"workflow"`
}

func submitThing() {
	ctx := context.Background()

	b, err := os.ReadFile("workflow.yaml")
	if err != nil {
		panic(err)
	}

	var wf wfv1.Workflow
	if err := yaml.Unmarshal(b, &wf); err != nil {
		panic(err)
	}

	fmt.Printf("kind=%q\n", wf.Kind)
	fmt.Printf("apiVersion=%q\n", wf.APIVersion)
	fmt.Printf("metadata.name=%q\n", wf.Name)
	fmt.Printf("metadata.generateName=%q\n", wf.GenerateName)
	fmt.Printf("metadata.namespace=%q\n", wf.Namespace)

	ctx, apiClient, err := argoapiclient.NewClientFromOptsWithContext(ctx, argoapiclient.Opts{
		ArgoServerOpts: argoapiclient.ArgoServerOpts{
			URL:                "localhost:2746", // host:port only
			Secure:             true,             // HTTPS
			HTTP1:              true,             // avoid gRPC/HTTP2 issues
			InsecureSkipVerify: true,
		},
		AuthSupplier: func() string {
			return ""
		},
	})
	if err != nil {
		panic(err)
	}
	wfClient := apiClient.NewWorkflowServiceClient(ctx)

}

// GoWorkflowSubmitter is the production implementation of WorkflowSubmitter
// that calls the Argo Workflows REST API.
type GoWorkflowSubmitter struct{}

func (s *GoWorkflowSubmitter) SubmitWorkflow(
	ctx context.Context,
	serverAddr, apiKey string,
	wf *Workflow,
) error {
	namespace := wf.Metadata.Namespace
	if namespace == "" {
		namespace = "default"
	}

	url := fmt.Sprintf(
		"%s/api/v1/workflows/%s",
		strings.TrimRight(serverAddr, "/"),
		namespace,
	)
	jsonBody, err := yaml.YAMLToJSON(template)
	if err != nil {
		panic(err)
	}

	client := &http.Client{
		Timeout: 20 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // local dev only
			},
		},
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader())
	if err != nil {
		panic(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	return retry.Do(
		func() error {
			body, err := json.Marshal(submitWorkflowRequest{Workflow: wf})
			if err != nil {
				return retry.Unrecoverable(fmt.Errorf("marshal workflow: %w", err))
			}

			req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
			if err != nil {
				return retry.Unrecoverable(fmt.Errorf("create request: %w", err))
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+apiKey)

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return fmt.Errorf("submit workflow: %w", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode >= 300 {
				respBody, _ := io.ReadAll(resp.Body)
				errMsg := fmt.Sprintf("submit workflow: status %d: %s", resp.StatusCode, string(respBody))
				if isRetryableStatusCode(resp.StatusCode) {
					return fmt.Errorf("%s", errMsg)
				}
				return retry.Unrecoverable(fmt.Errorf("%s", errMsg))
			}

			return nil
		},
		retry.Attempts(5),
		retry.Delay(1*time.Second),
		retry.MaxDelay(10*time.Second),
		retry.DelayType(retry.BackOffDelay),
		retry.OnRetry(func(n uint, err error) {
			log.Warn("Retrying Argo Workflow submission",
				"attempt", n+1,
				"error", err)
		}),
		retry.Context(ctx),
	)
}

func isRetryableStatusCode(code int) bool {
	return code == 502 || code == 503 || code == 504
}
