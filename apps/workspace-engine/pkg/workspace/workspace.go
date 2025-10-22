package workspace

import (
	"bytes"
	"context"
	"encoding/gob"
	"fmt"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace/kafka"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"
)

var _ gob.GobEncoder = (*Workspace)(nil)
var _ gob.GobDecoder = (*Workspace)(nil)

func New(id string) *Workspace {
	s := store.New()
	rm := releasemanager.New(s)
	cc := db.NewChangesetConsumer(id, s)
	ws := &Workspace{
		ID:                id,
		store:             s,
		releasemanager:    rm,
		changesetConsumer: cc,
		KafkaProgress:     make(kafka.KafkaProgressMap),
	}
	return ws
}

func NewNoFlush(id string) *Workspace {
	s := store.New()
	rm := releasemanager.New(s)
	cc := changeset.NewNoopChangesetConsumer()
	ws := &Workspace{
		ID:                id,
		store:             s,
		releasemanager:    rm,
		changesetConsumer: cc,
		KafkaProgress:     make(kafka.KafkaProgressMap),
	}
	return ws
}

type Workspace struct {
	ID string

	store             *store.Store
	releasemanager    *releasemanager.Manager
	changesetConsumer changeset.ChangesetConsumer[any]
	KafkaProgress     kafka.KafkaProgressMap
}

func (w *Workspace) Store() *store.Store {
	return w.store
}

func (w *Workspace) Policies() *store.Policies {
	return w.store.Policies
}

func (w *Workspace) ReleaseManager() *releasemanager.Manager {
	return w.releasemanager
}

func (w *Workspace) DeploymentVersions() *store.DeploymentVersions {
	return w.store.DeploymentVersions
}

func (w *Workspace) Environments() *store.Environments {
	return w.store.Environments
}

func (w *Workspace) Deployments() *store.Deployments {
	return w.store.Deployments
}

func (w *Workspace) Resources() *store.Resources {
	return w.store.Resources
}

func (w *Workspace) ReleaseTargets() *store.ReleaseTargets {
	return w.store.ReleaseTargets
}

func (w *Workspace) Systems() *store.Systems {
	return w.store.Systems
}

func (w *Workspace) Jobs() *store.Jobs {
	return w.store.Jobs
}

func (w *Workspace) JobAgents() *store.JobAgents {
	return w.store.JobAgents
}

func (w *Workspace) Releases() *store.Releases {
	return w.store.Releases
}

func (w *Workspace) GithubEntities() *store.GithubEntities {
	return w.store.GithubEntities
}

func (w *Workspace) UserApprovalRecords() *store.UserApprovalRecords {
	return w.store.UserApprovalRecords
}

func (w *Workspace) GobEncode() ([]byte, error) {
	// Encode the store
	storeData, err := w.store.GobEncode()
	if err != nil {
		return nil, err
	}

	// Create workspace data with ID and store
	data := WorkspaceStorageObject{
		ID:            w.ID,
		KafkaProgress: w.KafkaProgress,
		StoreData:     storeData,
	}

	// Encode the workspace data
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	if err := enc.Encode(data); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (w *Workspace) GobDecode(data []byte) error {
	// Decode the workspace data
	var wsData WorkspaceStorageObject

	buf := bytes.NewReader(data)
	dec := gob.NewDecoder(buf)
	if err := dec.Decode(&wsData); err != nil {
		return err
	}

	// Restore the workspace ID
	w.ID = wsData.ID
	w.KafkaProgress = wsData.KafkaProgress

	// Initialize store if needed
	if w.store == nil {
		w.store = &store.Store{}
	}

	// Decode the store
	if err := w.store.GobDecode(wsData.StoreData); err != nil {
		return err
	}

	// Reinitialize release manager with the decoded store
	w.releasemanager = releasemanager.New(w.store)

	return nil
}

func (w *Workspace) RelationshipRules() *store.RelationshipRules {
	return w.store.Relationships
}

func (w *Workspace) ResourceVariables() *store.ResourceVariables {
	return w.store.ResourceVariables
}

func (w *Workspace) Variables() *store.Variables {
	return w.store.Variables
}

func (w *Workspace) DeploymentVariables() *store.DeploymentVariables {
	return w.store.DeploymentVariables
}

func (w *Workspace) ResourceProviders() *store.ResourceProviders {
	return w.store.ResourceProviders
}

func (w *Workspace) ChangesetConsumer() changeset.ChangesetConsumer[any] {
	return w.changesetConsumer
}

var workspaces = cmap.New[*Workspace]()

func Exists(id string) bool {
	_, ok := workspaces.Get(id)
	return ok
}

func Set(id string, workspace *Workspace) {
	workspaces.Set(id, workspace)
}

func HasWorkspace(id string) bool {
	return workspaces.Has(id)
}

func GetWorkspace(id string) *Workspace {
	workspace, _ := workspaces.Get(id)
	if workspace == nil {
		workspace = New(id)
		workspaces.Set(id, workspace)
	}
	return workspace
}

func GetNoFlushWorkspace(id string) *Workspace {
	workspace, _ := workspaces.Get(id)
	if workspace == nil {
		workspace = NewNoFlush(id)
		workspaces.Set(id, workspace)
	}
	return workspace
}

func GetAllWorkspaceIds() []string {
	return workspaces.Keys()
}

// SaveToStorage serializes the workspace state and saves it to a storage client
func (w *Workspace) SaveToStorage(ctx context.Context, storage StorageClient, path string) error {
	// Encode the workspace using gob
	data, err := w.GobEncode()
	if err != nil {
		return fmt.Errorf("failed to encode workspace: %w", err)
	}

	// Write to file with appropriate permissions
	if err := storage.Put(ctx, path, data); err != nil {
		return fmt.Errorf("failed to write workspace to disk: %w", err)
	}

	return nil
}

// LoadFromStorage deserializes the workspace state from a storage client
func (w *Workspace) LoadFromStorage(ctx context.Context, storage StorageClient, path string) error {
	// Read from file
	data, err := storage.Get(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to read workspace from disk: %w", err)
	}

	// Decode the workspace
	if err := w.GobDecode(data); err != nil {
		return fmt.Errorf("failed to decode workspace: %w", err)
	}

	return nil
}

type WorkspaceLoader func(ctx context.Context, assignedPartitions []int32, numPartitions int32) error

// CreateWorkspaceLoader creates a workspace loader function that:
// 1. Discovers all available workspace IDs
// 2. Determines which workspaces belong to which partitions
// 3. Loads workspaces for the assigned partitions from storage
func CreateWorkspaceLoader(
	storage StorageClient,
	discoverer kafka.WorkspaceIDDiscoverer,
) WorkspaceLoader {
	return func(ctx context.Context, assignedPartitions []int32, numPartitions int32) error {
		var allWorkspaceIDs []string
		var err error

		// Use discoverer if provided, otherwise use default implementation
		if discoverer != nil {
			// Collect workspace IDs for each assigned partition
			workspaceIDSet := make(map[string]bool)
			for _, partition := range assignedPartitions {
				partitionWorkspaces, discErr := discoverer(ctx, partition, numPartitions)
				if discErr != nil {
					return fmt.Errorf("failed to discover workspace IDs for partition %d: %w", partition, discErr)
				}
				for _, wsID := range partitionWorkspaces {
					workspaceIDSet[wsID] = true
				}
			}
			// Convert set to slice
			for wsID := range workspaceIDSet {
				allWorkspaceIDs = append(allWorkspaceIDs, wsID)
			}
		} else {
			allWorkspaceIDs, err = kafka.GetAssignedWorkspaceIDs(ctx, assignedPartitions, numPartitions)
			if err != nil {
				return fmt.Errorf("failed to get assigned workspace IDs: %w", err)
			}
		}

		for _, workspaceID := range allWorkspaceIDs {
			ws := GetWorkspace(workspaceID)
			if err := ws.LoadFromStorage(ctx, storage, fmt.Sprintf("%s.gob", workspaceID)); err != nil {
				return fmt.Errorf("failed to load workspace %s: %w", workspaceID, err)
			}

			Set(workspaceID, ws)
		}

		return nil
	}
}
