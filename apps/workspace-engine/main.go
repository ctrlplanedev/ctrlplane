package main

import (
	"context"
	_ "net/http/pprof"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/messaging"
	"workspace-engine/svc"
	"workspace-engine/svc/controllers/deploymentresourceselectoreval"
	"workspace-engine/svc/controllers/environmentresourceselectoreval"
	"workspace-engine/svc/controllers/jobdispatch"
	"workspace-engine/svc/controllers/verification"
	httpsvc "workspace-engine/svc/http"
	"workspace-engine/svc/routerregistrar"
	"workspace-engine/svc/workspaceconsumer"
	"workspace-engine/svc/workspaceconsumer/kafka"
	"workspace-engine/svc/workspaceticker"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

var (
	WorkerID = uuid.New().String()
)

func main() {
	// Initialize OpenTelemetry Tracing
	cleanupTracer, _ := initTracer()
	defer cleanupTracer()

	// Initialize OpenTelemetry Metrics
	cleanupMetrics, _ := initMetrics()
	defer cleanupMetrics()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize shared Kafka producer used by the ticker and all job agents
	producer, err := kafka.NewProducer(kafka.Brokers)
	if err != nil {
		log.Fatal("Failed to create Kafka producer", "error", err)
		panic(err)
	}
	messaging.InitProducer(producer)
	defer messaging.CloseProducer()

	runner := svc.NewRunner()

	wsConsumer := workspaceconsumer.New(kafka.Brokers, kafka.Topic)
	runner.Add(
		httpsvc.New(config.Global),
		workspaceticker.New(producer),
		wsConsumer,
		routerregistrar.New(config.Global, wsConsumer.Consumer()),

		// Controllers
		deploymentresourceselectoreval.New(WorkerID, db.GetPool(ctx)),
		environmentresourceselectoreval.New(WorkerID, db.GetPool(ctx)),
		jobdispatch.New(WorkerID, db.GetPool(ctx)),
		verification.New(WorkerID, db.GetPool(ctx)),
	)

	if err := runner.Run(ctx); err != nil {
		log.Fatal("Runner failed", "error", err)
	}

	log.Info("Workspace engine shut down")
}
