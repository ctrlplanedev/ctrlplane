package argo

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	argocdclient "github.com/argoproj/argo-cd/v3/pkg/apiclient"
	argocdapplication "github.com/argoproj/argo-cd/v3/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v3/pkg/apis/application/v1alpha1"
	"github.com/avast/retry-go"
)

// GoApplicationUpserter is the production implementation of
// ApplicationUpserter that calls the ArgoCD API.
type GoApplicationUpserter struct{}

func (u *GoApplicationUpserter) UpsertApplication(
	ctx context.Context,
	serverAddr, apiKey string,
	app *v1alpha1.Application,
) error {
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

func upsertWithRetry(
	ctx context.Context,
	appClient argocdapplication.ApplicationServiceClient,
	app *v1alpha1.Application,
) error {
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
			slog.WarnContext(ctx, "Retrying ArgoCD application upsert",
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
	if errors.Is(err, context.DeadlineExceeded) {
		return true
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
		strings.Contains(errStr, "Unavailable") ||
		strings.Contains(errStr, "context deadline exceeded")
}

// GoApplicationDeleter is the production implementation of
// ApplicationDeleter that calls the ArgoCD API.
type GoApplicationDeleter struct{}

func (d *GoApplicationDeleter) DeleteApplication(
	ctx context.Context,
	serverAddr, apiKey, name string,
) error {
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

	cascade := true
	_, err = appClient.Delete(ctx, &argocdapplication.ApplicationDeleteRequest{
		Name:    &name,
		Cascade: &cascade,
	})
	return err
}

// GoManifestGetter is the production implementation of ManifestGetter
// that calls the ArgoCD API.
type GoManifestGetter struct{}

func (g *GoManifestGetter) GetManifests(
	ctx context.Context,
	serverAddr, apiKey, appName string,
) ([]string, error) {
	client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
		ServerAddr: serverAddr,
		AuthToken:  apiKey,
	})
	if err != nil {
		return nil, fmt.Errorf("create ArgoCD client: %w", err)
	}
	ioCloser, appClient, err := client.NewApplicationClient()
	if err != nil {
		return nil, fmt.Errorf("create application client: %w", err)
	}
	defer ioCloser.Close()

	resp, err := appClient.GetManifests(ctx,
		&argocdapplication.ApplicationManifestQuery{Name: &appName},
	)
	if err != nil {
		return nil, err
	}
	return resp.Manifests, nil
}

// GoApplicationGetter is the production implementation of
// ApplicationGetter that calls the ArgoCD API.
type GoApplicationGetter struct{}

func (g *GoApplicationGetter) GetApplication(
	ctx context.Context,
	serverAddr, apiKey, appName string,
) (*v1alpha1.Application, error) {
	client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
		ServerAddr: serverAddr,
		AuthToken:  apiKey,
	})
	if err != nil {
		return nil, fmt.Errorf("create ArgoCD client: %w", err)
	}
	ioCloser, appClient, err := client.NewApplicationClient()
	if err != nil {
		return nil, fmt.Errorf("create application client: %w", err)
	}
	defer ioCloser.Close()

	return appClient.Get(ctx, &argocdapplication.ApplicationQuery{Name: &appName})
}
