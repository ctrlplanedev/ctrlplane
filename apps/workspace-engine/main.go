package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/secrets"
	"workspace-engine/pkg/secrets/providers"
	"workspace-engine/svc"
	"workspace-engine/svc/claimcleanup"
	"workspace-engine/svc/controllers/deploymentplan"
	"workspace-engine/svc/controllers/deploymentplanresult"
	"workspace-engine/svc/controllers/deploymentresourceselectoreval"
	"workspace-engine/svc/controllers/desiredrelease"
	"workspace-engine/svc/controllers/environmentresourceselectoreval"
	"workspace-engine/svc/controllers/forcedeploy"
	"workspace-engine/svc/controllers/jobdispatch"
	"workspace-engine/svc/controllers/jobeligibility"
	"workspace-engine/svc/controllers/jobverificationmetric"
	"workspace-engine/svc/controllers/policyeval"
	"workspace-engine/svc/controllers/relationshipeval"
	httpsvc "workspace-engine/svc/http"
	"workspace-engine/svc/pprof"
)

var (
	WorkerID = uuid.New().String()
)

func main() {
	cleanupLogger, err := initLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer cleanupLogger()

	cleanupTracer, _ := initTracer()
	defer cleanupTracer()

	cleanupMetrics, _ := initMetrics()
	defer cleanupMetrics()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	secretResolver := newSecretResolver(ctx)

	allServices := []svc.Service{
		pprof.New(pprof.DefaultAddr(config.Global.PprofPort)),
		httpsvc.New(config.Global, db.GetPool(ctx)),
		claimcleanup.New(db.GetPool(ctx), 30*time.Second),

		deploymentplan.New(WorkerID, db.GetPool(ctx), secretResolver),
		deploymentplanresult.New(WorkerID, db.GetPool(ctx)),
		deploymentresourceselectoreval.New(WorkerID, db.GetPool(ctx)),
		environmentresourceselectoreval.New(WorkerID, db.GetPool(ctx)),
		forcedeploy.New(WorkerID, db.GetPool(ctx)),
		jobdispatch.New(WorkerID, db.GetPool(ctx)),
		jobeligibility.New(WorkerID, db.GetPool(ctx)),
		jobverificationmetric.New(WorkerID, db.GetPool(ctx)),
		relationshipeval.New(WorkerID, db.GetPool(ctx)),
		desiredrelease.New(WorkerID, db.GetPool(ctx), secretResolver),
		policyeval.New(WorkerID, db.GetPool(ctx)),
	}

	enabled := make(map[string]bool)
	if svcList := strings.TrimSpace(config.Global.Services); svcList != "" {
		for name := range strings.SplitSeq(svcList, ",") {
			if name = strings.TrimSpace(name); name != "" {
				enabled[name] = true
			}
		}
	}

	runner := svc.NewRunner()
	for _, s := range allServices {
		if len(enabled) > 0 && !enabled[s.Name()] {
			continue
		}

		slog.Info("Adding service", "name", s.Name())
		runner.Add(s)
	}

	slog.Info("Enabled services", "services", enabled)

	if err := runner.Run(ctx); err != nil {
		slog.Error("Runner failed", "error", err)
	}

	slog.Info("Workspace engine shut down")
}

// newSecretResolver wires the components needed to resolve secret_ref
// variable values. If VARIABLES_AES_256_KEY is unset the resolver is nil and
// any secret_ref encountered during reconciliation will block release
// dispatch with a clear error.
func newSecretResolver(ctx context.Context) *secrets.Resolver {
	keyHex := config.Global.VariablesAes256Key
	if keyHex == "" {
		slog.Warn(
			"VARIABLES_AES_256_KEY is unset; secret_ref variable values will fail to resolve",
		)
		return nil
	}
	store, err := secrets.NewPostgresStoreFromKey(db.GetQueries(ctx), keyHex)
	if err != nil {
		slog.Error("Failed to construct secret store", "error", err)
		os.Exit(1)
	}
	return secrets.NewResolver(
		store,
		providers.NewDefaultRegistry(),
		secrets.NewCache(config.Global.SecretsCacheTTL),
	)
}
