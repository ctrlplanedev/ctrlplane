package workspaceconsumer

import (
	"context"

	"workspace-engine/pkg/db"
	dbpersistence "workspace-engine/pkg/db/persistence"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"
	"workspace-engine/pkg/workspace/releasemanager/trace/spanstore"
	wsstore "workspace-engine/pkg/workspace/store"
	"workspace-engine/svc"
	"workspace-engine/svc/workspaceconsumer/kafka"

	"github.com/charmbracelet/log"
)

var _ svc.Service = (*Service)(nil)

// Service runs a Kafka consumer that processes workspace events. It also owns
// the persistence layer and workspace manager configuration, since the consumer
// is the primary entry point for loading and operating on workspaces.
type Service struct {
	consumer        messaging.Consumer
	persistentStore persistence.Store
}

func New(brokers, topic string) *Service {
	c, err := kafka.NewConsumer(brokers, topic)
	if err != nil {
		log.Fatal("Failed to create workspace consumer", "error", err)
		panic(err)
	}
	return &Service{consumer: c}
}

// Consumer returns the underlying consumer, e.g. for reading assigned partitions.
func (s *Service) Consumer() messaging.Consumer { return s.consumer }

func (s *Service) Name() string { return "workspace-consumer" }

func (s *Service) Start(ctx context.Context) error {
	if err := s.configureManager(); err != nil {
		return err
	}

	go func() {
		log.Info("Workspace event consumer started")
		if err := kafka.RunConsumer(ctx, s.consumer); err != nil {
			log.Error("Workspace event consumer error", "error", err)
		}
	}()
	return nil
}

func (s *Service) Stop(_ context.Context) error {
	err := s.consumer.Close()
	if s.persistentStore != nil {
		if closeErr := s.persistentStore.Close(); closeErr != nil {
			log.Error("Failed to close persistence store", "error", closeErr)
		}
	}
	return err
}

// configureManager sets up the persistence store, trace store, and workspace
// manager. Uses context.Background() so DB operations survive shutdown.
func (s *Service) configureManager() error {
	bgCtx := context.Background()

	store, err := dbpersistence.NewStore(bgCtx)
	if err != nil {
		return err
	}
	s.persistentStore = store

	pgxPool := db.GetPool(bgCtx)
	traceStore := spanstore.NewDBStore(pgxPool)
	log.Info("Deployment trace store initialized")

	manager.Configure(
		manager.WithPersistentStore(store),
		manager.WithWorkspaceCreateOptions(
			workspace.WithTraceStore(traceStore),
			workspace.WithStoreOptions(
				wsstore.WithDBDeploymentVersions(bgCtx),
				wsstore.WithDBEnvironments(bgCtx),
				wsstore.WithDBDeployments(bgCtx),
				wsstore.WithDBSystems(bgCtx),
				wsstore.WithDBResourceProviders(bgCtx),
				wsstore.WithDBSystemDeployments(bgCtx),
				wsstore.WithDBSystemEnvironments(bgCtx),
				wsstore.WithDBResources(bgCtx),
				wsstore.WithDBJobAgents(bgCtx),
				wsstore.WithDBPolicies(bgCtx),
				wsstore.WithDBUserApprovalRecords(bgCtx),
			),
		),
	)

	return nil
}
