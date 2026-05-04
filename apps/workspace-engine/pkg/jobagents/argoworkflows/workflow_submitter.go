package argoworkflows

import (
	"context"
	"fmt"
	"strings"
	"time"

	argoapiclient "github.com/argoproj/argo-workflows/v4/pkg/apiclient"
	workflowpkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflow"
	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GoWorkflowSubmitter is the production implementation of WorkflowSubmitter
// that calls the Argo Workflows REST API.
type GoWorkflowSubmitter struct{}

func argoBearerIfToken(token string) string {
	if token == "" {
		return ""
	}
	return "Bearer " + token
}

func (s *GoWorkflowSubmitter) SubmitWorkflow(
	ctx context.Context,
	serverAddr, apiKey string,
	insecureSkipVerify bool,
	wf *wfv1.Workflow,
) (*wfv1.Workflow, error) {
	ctx, apiClient, err := argoapiclient.NewClientFromOptsWithContext(ctx, argoapiclient.Opts{
		ArgoServerOpts: argoapiclient.ArgoServerOpts{
			URL:                serverAddr,
			Secure:             true,
			HTTP1:              true,
			InsecureSkipVerify: insecureSkipVerify,
		},
		AuthSupplier: func() string {
			return argoBearerIfToken(apiKey)
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create argo client: %w", err)
	}
	wfClient := apiClient.NewWorkflowServiceClient(ctx)
	namespace := wf.Namespace
	if namespace == "" {
		namespace = "default"
	}

	jobID := wf.Labels["job-id"]

	created, err := createWorkflowWithRetry(ctx, wfClient, namespace, jobID, wf)
	return created, err
}

func createWorkflowWithRetry(
	ctx context.Context,
	wfClient workflowpkg.WorkflowServiceClient,
	namespace, jobID string,
	wf *wfv1.Workflow,
) (*wfv1.Workflow, error) {
	var created *wfv1.Workflow
	err := retry.Do(
		func() error {
			// Before creating, check whether a workflow for this job already
			// exists. This makes retries idempotent when GenerateName is used:
			// a previous attempt may have succeeded but the response was lost.
			if jobID != "" {
				list, listErr := wfClient.ListWorkflows(ctx, &workflowpkg.WorkflowListRequest{
					Namespace: namespace,
					ListOptions: &metav1.ListOptions{
						LabelSelector: "job-id=" + jobID,
					},
				})
				if listErr != nil && isRetryableError(listErr) {
					return listErr
				}
				if listErr == nil && len(list.Items) > 0 {
					created = &list.Items[0]
					return nil
				}
			}

			var createdErr error
			created, createdErr = wfClient.CreateWorkflow(ctx, &workflowpkg.WorkflowCreateRequest{
				Namespace: namespace,
				Workflow:  wf,
			})

			if createdErr != nil {
				if isRetryableError(createdErr) {
					return createdErr
				}
				return retry.Unrecoverable(createdErr)
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
	return created, err
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
