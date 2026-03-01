package argo

import (
	"context"
	"fmt"
	"strings"
	"time"

	argocdclient "github.com/argoproj/argo-cd/v2/pkg/apiclient"
	argocdapplication "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"
)

// GoApplicationUpserter is the production implementation of
// ApplicationUpserter that calls the ArgoCD API.
type GoApplicationUpserter struct{}

func (u *GoApplicationUpserter) UpsertApplication(ctx context.Context, serverAddr, apiKey string, app *v1alpha1.Application) error {
	client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
		ServerAddr: serverAddr,
		AuthToken:  apiKey,
	})
	if err != nil {
		return fmt.Errorf("create ArgoCD client: %w", err)
	}
	ioCloser, appClient, err := client.NewApplicationClient()
	if err != nil {
		return fmt.Errorf("create ArgoCD application client: %w", err)
	}
	defer ioCloser.Close()

	return upsertWithRetry(ctx, appClient, app)
}

func upsertWithRetry(ctx context.Context, appClient argocdapplication.ApplicationServiceClient, app *v1alpha1.Application) error {
	upsert := true
	return retry.Do(
		func() error {
			_, err := appClient.Create(ctx, &argocdapplication.ApplicationCreateRequest{
				Application: app,
				Upsert:      &upsert,
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
			log.Warn("Retrying ArgoCD application upsert",
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
