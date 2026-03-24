package argo_workflows

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"

	argoapiclient "github.com/argoproj/argo-workflows/v4/pkg/apiclient"
	workflowpkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflow"
	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
)

// GoWorkflowSubmitter is the production implementation of WorkflowSubmitter
// that calls the Argo Workflows REST API.
type GoWorkflowSubmitter struct{}

func (s *GoWorkflowSubmitter) SubmitWorkflow(
	ctx context.Context,
	serverAddr, apiKey string,
	wf *wfv1.Workflow,
) error {

	ctx, apiClient, err := argoapiclient.NewClientFromOptsWithContext(ctx, argoapiclient.Opts{
		ArgoServerOpts: argoapiclient.ArgoServerOpts{
			URL:                serverAddr,
			Secure:             true,
			HTTP1:              true,
			InsecureSkipVerify: true,
		},
		AuthSupplier: func() string {
			return apiKey
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create argo client: %w", err)
	}
	fmt.Printf("serverAddr: %s, apiKey: %s\n", serverAddr, apiKey)

	wfClient := apiClient.NewWorkflowServiceClient(ctx)
	namespace := wf.Namespace
	if namespace == "" {
		namespace = "default"
	}

	return retry.Do(
		func() error {
			_, err := wfClient.CreateWorkflow(ctx, &workflowpkg.WorkflowCreateRequest{
				Namespace: namespace,
				Workflow:  wf,
			})

			if err != nil {
				if isRetryableError(err) {
					return err
				}
				return retry.Unrecoverable(err)
			}
			return nil
		},
		retry.Attempts(5),
		retry.Delay(1*time.Second),
		retry.MaxDelay(10*time.Second),
		retry.DelayType(retry.BackOffDelay),
		retry.OnRetry(func(n uint, err error) {
			log.Warn("Retrying ArgoWorkflow submission",
				"attempt", n+1,
				"error", err)
		}),
		retry.Context(ctx),
	)
}

func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return strings.Contains(errStr, "502") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "504") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "temporarily unavailable") ||
		strings.Contains(errStr, "EOF") ||
		strings.Contains(errStr, "Unavailable")
}
