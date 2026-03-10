package main

import (
	"context"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/messaging"
	"workspace-engine/svc"
	"workspace-engine/svc/controllers/deploymentresourceselectoreval"
	"workspace-engine/svc/controllers/desiredrelease"
	"workspace-engine/svc/controllers/environmentresourceselectoreval"
	"workspace-engine/svc/controllers/jobdispatch"
	"workspace-engine/svc/controllers/jobeligibility"
	"workspace-engine/svc/controllers/jobverificationmetric"
	"workspace-engine/svc/controllers/relationshipeval"
	httpsvc "workspace-engine/svc/http"
	"workspace-engine/svc/pprof"
	"workspace-engine/svc/workspaceconsumer/kafka"
)

var (
	WorkerID = uuid.New().String()
)

func main() {
	cleanupTracer, _ := initTracer()
	defer cleanupTracer()

	cleanupMetrics, _ := initMetrics()
	defer cleanupMetrics()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	producer, err := kafka.NewProducer(kafka.Brokers)
	if err != nil {
		log.Error("Failed to create Kafka producer", "error", err)
		return
	}
	messaging.InitProducer(producer)
	defer messaging.CloseProducer()

	// reconcileQueue := postgres.New(db.GetPool(ctx))
	// wsConsumer := workspaceconsumer.New(kafka.Brokers, kafka.Topic, reconcileQueue)

	allServices := []svc.Service{
		pprof.New(pprof.DefaultAddr(config.Global.PprofPort)),
		httpsvc.New(config.Global),

		deploymentresourceselectoreval.New(WorkerID, db.GetPool(ctx)),
		environmentresourceselectoreval.New(WorkerID, db.GetPool(ctx)),
		jobdispatch.New(WorkerID, db.GetPool(ctx)),
		jobeligibility.New(WorkerID, db.GetPool(ctx)),
		jobverificationmetric.New(WorkerID, db.GetPool(ctx)),
		relationshipeval.New(WorkerID, db.GetPool(ctx)),
		desiredrelease.New(WorkerID, db.GetPool(ctx)),
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

		log.Info("Adding service", "name", s.Name())
		runner.Add(s)
	}

	log.Info("Enabled services", "services", enabled)

	if err := runner.Run(ctx); err != nil {
		log.Error("Runner failed", "error", err)
	}

	log.Info("Workspace engine shut down")
}
