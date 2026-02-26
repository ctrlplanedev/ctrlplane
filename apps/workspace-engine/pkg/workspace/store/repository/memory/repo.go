package memory

import (
	"fmt"
	"sync"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/memory/indexstore"

	"github.com/hashicorp/go-memdb"
)

var _ repository.Repo = &InMemory{}

// createTypedStore creates an in-memory store and registers it with the persistence router.
// Returns the store for direct type-safe access while enabling generic persistence updates.
func createTypedStore[E any](router *persistence.RepositoryRouter, entityType string) cmap.ConcurrentMap[string, E] {
	store := cmap.New[E]()
	router.Register(entityType, &TypedStoreAdapter[E]{store: &store})
	return store
}

func createMemDBStore[E persistence.Entity](router *persistence.RepositoryRouter, entityType string, db *memdb.MemDB) *indexstore.Store[E] {
	adapter := indexstore.NewMemDBAdapter[E](db, entityType)
	router.Register(entityType, adapter)
	fn := func(entity E) string {
		keyer, ok := any(entity).(persistence.Entity)
		if !ok {
			panic(fmt.Errorf("entity does not implement persistence.Entity interface"))
		}
		_, key := keyer.CompactionKey()
		return key
	}
	return indexstore.NewStore(db, entityType, fn)
}

func New(wsId string) *InMemory {
	router := persistence.NewRepositoryRouter()
	memdb, err := indexstore.NewDB()
	if err != nil {
		panic(err)
	}

	return &InMemory{
		router: router,
		db:     memdb,

		JobVerifications:         createTypedStore[*oapi.JobVerification](router, "job_verification"),
		resources:                createTypedStore[*oapi.Resource](router, "resource"),
		resourceProviders:        createTypedStore[*oapi.ResourceProvider](router, "resource_provider"),
		resourceVariables:        createTypedStore[*oapi.ResourceVariable](router, "resource_variable"),
		deployments:              createTypedStore[*oapi.Deployment](router, "deployment"),
		deploymentVersions:       createMemDBStore[*oapi.DeploymentVersion](router, "deployment_version", memdb),
		deploymentVariables:      createTypedStore[*oapi.DeploymentVariable](router, "deployment_variable"),
		deploymentVariableValues: createTypedStore[*oapi.DeploymentVariableValue](router, "deployment_variable_value"),
		environments:             createTypedStore[*oapi.Environment](router, "environment"),
		policies:                 createTypedStore[*oapi.Policy](router, "policy"),
		PolicySkips:              createTypedStore[*oapi.PolicySkip](router, "policy_skip"),
		systems:                  createTypedStore[*oapi.System](router, "system"),
		releases:                 createMemDBStore[*oapi.Release](router, "release", memdb),
		Jobs:                     createMemDBStore[*oapi.Job](router, "job", memdb),
		jobAgents:                createTypedStore[*oapi.JobAgent](router, "job_agent"),
		userApprovalRecords:      createTypedStore[*oapi.UserApprovalRecord](router, "user_approval_record"),
		RelationshipRules:        createTypedStore[*oapi.RelationshipRule](router, "relationship_rule"),
		GithubEntities:           createTypedStore[*oapi.GithubEntity](router, "github_entity"),
		workflows:                createTypedStore[*oapi.Workflow](router, "workflow"),
		workflowJobTemplates:     createTypedStore[*oapi.WorkflowJobTemplate](router, "workflow_job_template"),
		workflowRuns:             createTypedStore[*oapi.WorkflowRun](router, "workflow_run"),
		workflowJobs:             createTypedStore[*oapi.WorkflowJob](router, "workflow_job"),

		systemDeploymentLinks:      &linkStore{},
		systemEnvironmentLinks:     &linkStore{},
		systemDeploymentLinkStore:  createTypedStore[*oapi.SystemDeploymentLink](router, "system_deployment_link"),
		systemEnvironmentLinkStore: createTypedStore[*oapi.SystemEnvironmentLink](router, "system_environment_link"),
	}
}

// InMemory provides type-safe access to workspace entities stored in memory.
// It exposes typed concurrent maps for direct access while maintaining a router
// for receiving generic persistence updates from Kafka/Pebble.
type InMemory struct {
	router *persistence.RepositoryRouter
	db     *memdb.MemDB

	resources         cmap.ConcurrentMap[string, *oapi.Resource]
	resourceVariables cmap.ConcurrentMap[string, *oapi.ResourceVariable]
	resourceProviders cmap.ConcurrentMap[string, *oapi.ResourceProvider]

	deployments              cmap.ConcurrentMap[string, *oapi.Deployment]
	deploymentVariables      cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
	deploymentVersions       *indexstore.Store[*oapi.DeploymentVersion]
	deploymentVariableValues cmap.ConcurrentMap[string, *oapi.DeploymentVariableValue]

	environments     cmap.ConcurrentMap[string, *oapi.Environment]
	policies         cmap.ConcurrentMap[string, *oapi.Policy]
	PolicySkips      cmap.ConcurrentMap[string, *oapi.PolicySkip]
	systems          cmap.ConcurrentMap[string, *oapi.System]
	releases         *indexstore.Store[*oapi.Release]
	JobVerifications cmap.ConcurrentMap[string, *oapi.JobVerification]

	Jobs      *indexstore.Store[*oapi.Job]
	jobAgents cmap.ConcurrentMap[string, *oapi.JobAgent]

	GithubEntities      cmap.ConcurrentMap[string, *oapi.GithubEntity]
	userApprovalRecords cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
	RelationshipRules   cmap.ConcurrentMap[string, *oapi.RelationshipRule]

	workflows            cmap.ConcurrentMap[string, *oapi.Workflow]
	workflowJobTemplates cmap.ConcurrentMap[string, *oapi.WorkflowJobTemplate]
	workflowRuns         cmap.ConcurrentMap[string, *oapi.WorkflowRun]
	workflowJobs         cmap.ConcurrentMap[string, *oapi.WorkflowJob]

	systemDeploymentLinks      *linkStore
	systemEnvironmentLinks     *linkStore
	systemDeploymentLinkStore  cmap.ConcurrentMap[string, *oapi.SystemDeploymentLink]
	systemEnvironmentLinkStore cmap.ConcurrentMap[string, *oapi.SystemEnvironmentLink]
}

// deploymentVersionRepoAdapter wraps an indexstore.Store to satisfy the
// explicit DeploymentVersionRepo interface.
type deploymentVersionRepoAdapter struct {
	*indexstore.Store[*oapi.DeploymentVersion]
}

func (a *deploymentVersionRepoAdapter) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error) {
	return a.GetBy("deployment_id", deploymentID)
}

// DeploymentVersions implements repository.Repo.
func (s *InMemory) DeploymentVersions() repository.DeploymentVersionRepo {
	return &deploymentVersionRepoAdapter{s.deploymentVersions}
}

// releaseRepoAdapter wraps an indexstore.Store to satisfy the
// explicit ReleaseRepo interface.
type releaseRepoAdapter struct {
	*indexstore.Store[*oapi.Release]
}

func (a *releaseRepoAdapter) GetByReleaseTargetKey(key string) ([]*oapi.Release, error) {
	return a.GetBy("release_target_key", key)
}

// Releases implements repository.Repo.
func (s *InMemory) Releases() repository.ReleaseRepo {
	return &releaseRepoAdapter{s.releases}
}

// cmapRepoAdapter wraps a cmap.ConcurrentMap to satisfy a basic entity repo interface.
type cmapRepoAdapter[E persistence.Entity] struct {
	store *cmap.ConcurrentMap[string, E]
}

func (a *cmapRepoAdapter[E]) Get(id string) (E, bool) {
	return a.store.Get(id)
}

func (a *cmapRepoAdapter[E]) Set(entity E) error {
	_, key := entity.CompactionKey()
	a.store.Set(key, entity)
	return nil
}

func (a *cmapRepoAdapter[E]) Remove(id string) error {
	a.store.Remove(id)
	return nil
}

func (a *cmapRepoAdapter[E]) Items() map[string]E {
	return a.store.Items()
}

// Deployments implements repository.Repo.
func (s *InMemory) Deployments() repository.DeploymentRepo {
	return &cmapRepoAdapter[*oapi.Deployment]{store: &s.deployments}
}

// Environments implements repository.Repo.
func (s *InMemory) Environments() repository.EnvironmentRepo {
	return &cmapRepoAdapter[*oapi.Environment]{store: &s.environments}
}

// Systems implements repository.Repo.
func (s *InMemory) Systems() repository.SystemRepo {
	return &cmapRepoAdapter[*oapi.System]{store: &s.systems}
}

// JobAgents implements repository.Repo.
func (s *InMemory) JobAgents() repository.JobAgentRepo {
	return &cmapRepoAdapter[*oapi.JobAgent]{store: &s.jobAgents}
}

// resourceRepoAdapter wraps a cmap.ConcurrentMap to satisfy ResourceRepo,
// adding the GetByIdentifier lookup.
type resourceRepoAdapter struct {
	store *cmap.ConcurrentMap[string, *oapi.Resource]
}

func (a *resourceRepoAdapter) Get(id string) (*oapi.Resource, bool) {
	return a.store.Get(id)
}

func (a *resourceRepoAdapter) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	for item := range a.store.IterBuffered() {
		if item.Val.Identifier == identifier {
			return item.Val, true
		}
	}
	return nil, false
}

func (a *resourceRepoAdapter) GetByIdentifiers(identifiers []string) map[string]*oapi.Resource {
	wanted := make(map[string]struct{}, len(identifiers))
	for _, id := range identifiers {
		wanted[id] = struct{}{}
	}
	result := make(map[string]*oapi.Resource, len(identifiers))
	for item := range a.store.IterBuffered() {
		if _, ok := wanted[item.Val.Identifier]; ok {
			result[item.Val.Identifier] = item.Val
		}
	}
	return result
}

func (a *resourceRepoAdapter) GetSummariesByIdentifiers(identifiers []string) map[string]*repository.ResourceSummary {
	wanted := make(map[string]struct{}, len(identifiers))
	for _, id := range identifiers {
		wanted[id] = struct{}{}
	}
	result := make(map[string]*repository.ResourceSummary, len(identifiers))
	for item := range a.store.IterBuffered() {
		if _, ok := wanted[item.Val.Identifier]; ok {
			r := item.Val
			result[r.Identifier] = &repository.ResourceSummary{
				Id:         r.Id,
				Identifier: r.Identifier,
				ProviderId: r.ProviderId,
				Version:    r.Version,
				Name:       r.Name,
				Kind:       r.Kind,
				CreatedAt:  r.CreatedAt,
				UpdatedAt:  r.UpdatedAt,
			}
		}
	}
	return result
}

func (a *resourceRepoAdapter) ListByProviderID(providerID string) []*oapi.Resource {
	var result []*oapi.Resource
	for item := range a.store.IterBuffered() {
		if item.Val.ProviderId != nil && *item.Val.ProviderId == providerID {
			result = append(result, item.Val)
		}
	}
	return result
}

func (a *resourceRepoAdapter) Set(entity *oapi.Resource) error {
	a.store.Set(entity.Id, entity)
	return nil
}

func (a *resourceRepoAdapter) SetBatch(entities []*oapi.Resource) error {
	for _, entity := range entities {
		a.store.Set(entity.Id, entity)
	}
	return nil
}

func (a *resourceRepoAdapter) Remove(id string) error {
	a.store.Remove(id)
	return nil
}

func (a *resourceRepoAdapter) RemoveBatch(ids []string) error {
	for _, id := range ids {
		a.store.Remove(id)
	}
	return nil
}

func (a *resourceRepoAdapter) Items() map[string]*oapi.Resource {
	return a.store.Items()
}

// Resources implements repository.Repo.
func (s *InMemory) Resources() repository.ResourceRepo {
	return &resourceRepoAdapter{store: &s.resources}
}

// ResourceProviders implements repository.Repo.
func (s *InMemory) ResourceProviders() repository.ResourceProviderRepo {
	return &cmapRepoAdapter[*oapi.ResourceProvider]{store: &s.resourceProviders}
}

func (s *InMemory) Router() *persistence.RepositoryRouter {
	return s.router
}

func (s *InMemory) DB() *memdb.MemDB {
	return s.db
}

// --- In-memory bidirectional link store ---

// linkPair represents one link between two IDs (e.g. systemID <-> deploymentID).
type linkPair struct {
	Left  string
	Right string
}

// linkStore is a simple thread-safe set of link pairs with bidirectional lookup.
type linkStore struct {
	mu    sync.RWMutex
	pairs []linkPair
}

func (ls *linkStore) getRightByLeft(left string) []string {
	ls.mu.RLock()
	defer ls.mu.RUnlock()
	var result []string
	for _, p := range ls.pairs {
		if p.Left == left {
			result = append(result, p.Right)
		}
	}
	return result
}

func (ls *linkStore) getLeftByRight(right string) []string {
	ls.mu.RLock()
	defer ls.mu.RUnlock()
	var result []string
	for _, p := range ls.pairs {
		if p.Right == right {
			result = append(result, p.Left)
		}
	}
	return result
}

func (ls *linkStore) link(left, right string) {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	for _, p := range ls.pairs {
		if p.Left == left && p.Right == right {
			return
		}
	}
	ls.pairs = append(ls.pairs, linkPair{Left: left, Right: right})
}

func (ls *linkStore) unlink(left, right string) {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	for i, p := range ls.pairs {
		if p.Left == left && p.Right == right {
			ls.pairs = append(ls.pairs[:i], ls.pairs[i+1:]...)
			return
		}
	}
}

// systemDeploymentRepoAdapter adapts linkStore for SystemDeploymentRepo.
// Left = systemID, Right = deploymentID.
type systemDeploymentRepoAdapter struct {
	links     *linkStore
	persisted *cmap.ConcurrentMap[string, *oapi.SystemDeploymentLink]
}

func (a *systemDeploymentRepoAdapter) GetSystemIDsForDeployment(deploymentID string) []string {
	return a.links.getLeftByRight(deploymentID)
}

func (a *systemDeploymentRepoAdapter) GetDeploymentIDsForSystem(systemID string) []string {
	return a.links.getRightByLeft(systemID)
}

func (a *systemDeploymentRepoAdapter) Link(systemID, deploymentID string) error {
	a.links.link(systemID, deploymentID)
	link := &oapi.SystemDeploymentLink{SystemId: systemID, DeploymentId: deploymentID}
	a.persisted.Set(systemID+":"+deploymentID, link)
	return nil
}

func (a *systemDeploymentRepoAdapter) Unlink(systemID, deploymentID string) error {
	a.links.unlink(systemID, deploymentID)
	a.persisted.Remove(systemID + ":" + deploymentID)
	return nil
}

// SystemDeployments implements repository.Repo.
func (s *InMemory) SystemDeployments() repository.SystemDeploymentRepo {
	return &systemDeploymentRepoAdapter{
		links:     s.systemDeploymentLinks,
		persisted: &s.systemDeploymentLinkStore,
	}
}

// systemEnvironmentRepoAdapter adapts linkStore for SystemEnvironmentRepo.
// Left = systemID, Right = environmentID.
type systemEnvironmentRepoAdapter struct {
	links     *linkStore
	persisted *cmap.ConcurrentMap[string, *oapi.SystemEnvironmentLink]
}

func (a *systemEnvironmentRepoAdapter) GetSystemIDsForEnvironment(environmentID string) []string {
	return a.links.getLeftByRight(environmentID)
}

func (a *systemEnvironmentRepoAdapter) GetEnvironmentIDsForSystem(systemID string) []string {
	return a.links.getRightByLeft(systemID)
}

func (a *systemEnvironmentRepoAdapter) Link(systemID, environmentID string) error {
	a.links.link(systemID, environmentID)
	link := &oapi.SystemEnvironmentLink{SystemId: systemID, EnvironmentId: environmentID}
	a.persisted.Set(systemID+":"+environmentID, link)
	return nil
}

func (a *systemEnvironmentRepoAdapter) Unlink(systemID, environmentID string) error {
	a.links.unlink(systemID, environmentID)
	a.persisted.Remove(systemID + ":" + environmentID)
	return nil
}

// Policies implements repository.Repo.
func (s *InMemory) Policies() repository.PolicyRepo {
	return &cmapRepoAdapter[*oapi.Policy]{store: &s.policies}
}

// userApprovalRecordRepoAdapter wraps a cmap to satisfy UserApprovalRecordRepo.
type userApprovalRecordRepoAdapter struct {
	store *cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
}

func (a *userApprovalRecordRepoAdapter) Get(key string) (*oapi.UserApprovalRecord, bool) {
	return a.store.Get(key)
}

func (a *userApprovalRecordRepoAdapter) Set(entity *oapi.UserApprovalRecord) error {
	a.store.Set(entity.Key(), entity)
	return nil
}

func (a *userApprovalRecordRepoAdapter) Remove(key string) error {
	a.store.Remove(key)
	return nil
}

func (a *userApprovalRecordRepoAdapter) Items() map[string]*oapi.UserApprovalRecord {
	return a.store.Items()
}

func (a *userApprovalRecordRepoAdapter) GetApprovedByVersionAndEnvironment(versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	var records []*oapi.UserApprovalRecord
	for item := range a.store.IterBuffered() {
		r := item.Val
		if r.VersionId == versionID && r.EnvironmentId == environmentID && r.Status == oapi.ApprovalStatusApproved {
			records = append(records, r)
		}
	}
	return records, nil
}

// UserApprovalRecords implements repository.Repo.
func (s *InMemory) UserApprovalRecords() repository.UserApprovalRecordRepo {
	return &userApprovalRecordRepoAdapter{store: &s.userApprovalRecords}
}

type resourceVariableRepoAdapter struct {
	store *cmap.ConcurrentMap[string, *oapi.ResourceVariable]
}

func (a *resourceVariableRepoAdapter) Get(key string) (*oapi.ResourceVariable, bool) {
	return a.store.Get(key)
}

func (a *resourceVariableRepoAdapter) Set(entity *oapi.ResourceVariable) error {
	a.store.Set(entity.ID(), entity)
	return nil
}

func (a *resourceVariableRepoAdapter) Remove(key string) error {
	a.store.Remove(key)
	return nil
}

func (a *resourceVariableRepoAdapter) Items() map[string]*oapi.ResourceVariable {
	return a.store.Items()
}

func (a *resourceVariableRepoAdapter) BulkUpdate(toUpsert []*oapi.ResourceVariable, toRemove []*oapi.ResourceVariable) error {
	for _, rv := range toRemove {
		a.store.Remove(rv.ID())
	}
	for _, rv := range toUpsert {
		a.store.Set(rv.ID(), rv)
	}
	return nil
}

func (a *resourceVariableRepoAdapter) GetByResourceID(resourceID string) ([]*oapi.ResourceVariable, error) {
	var result []*oapi.ResourceVariable
	for item := range a.store.IterBuffered() {
		if item.Val.ResourceId == resourceID {
			result = append(result, item.Val)
		}
	}
	return result, nil
}

// ResourceVariables implements repository.Repo.
func (s *InMemory) ResourceVariables() repository.ResourceVariableRepo {
	return &resourceVariableRepoAdapter{store: &s.resourceVariables}
}

type deploymentVariableRepoAdapter struct {
	store *cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
}

func (a *deploymentVariableRepoAdapter) Get(id string) (*oapi.DeploymentVariable, bool) {
	return a.store.Get(id)
}

func (a *deploymentVariableRepoAdapter) Set(entity *oapi.DeploymentVariable) error {
	a.store.Set(entity.Id, entity)
	return nil
}

func (a *deploymentVariableRepoAdapter) Remove(id string) error {
	a.store.Remove(id)
	return nil
}

func (a *deploymentVariableRepoAdapter) Items() map[string]*oapi.DeploymentVariable {
	return a.store.Items()
}

func (a *deploymentVariableRepoAdapter) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVariable, error) {
	var result []*oapi.DeploymentVariable
	for item := range a.store.IterBuffered() {
		if item.Val.DeploymentId == deploymentID {
			result = append(result, item.Val)
		}
	}
	return result, nil
}

func (s *InMemory) DeploymentVariables() repository.DeploymentVariableRepo {
	return &deploymentVariableRepoAdapter{store: &s.deploymentVariables}
}

type deploymentVariableValueRepoAdapter struct {
	store *cmap.ConcurrentMap[string, *oapi.DeploymentVariableValue]
}

func (a *deploymentVariableValueRepoAdapter) Get(id string) (*oapi.DeploymentVariableValue, bool) {
	return a.store.Get(id)
}

func (a *deploymentVariableValueRepoAdapter) Set(entity *oapi.DeploymentVariableValue) error {
	a.store.Set(entity.Id, entity)
	return nil
}

func (a *deploymentVariableValueRepoAdapter) Remove(id string) error {
	a.store.Remove(id)
	return nil
}

func (a *deploymentVariableValueRepoAdapter) Items() map[string]*oapi.DeploymentVariableValue {
	return a.store.Items()
}

func (a *deploymentVariableValueRepoAdapter) GetByVariableID(variableID string) ([]*oapi.DeploymentVariableValue, error) {
	var result []*oapi.DeploymentVariableValue
	for item := range a.store.IterBuffered() {
		if item.Val.DeploymentVariableId == variableID {
			result = append(result, item.Val)
		}
	}
	return result, nil
}

func (s *InMemory) DeploymentVariableValues() repository.DeploymentVariableValueRepo {
	return &deploymentVariableValueRepoAdapter{store: &s.deploymentVariableValues}
}

func (s *InMemory) Workflows() repository.WorkflowRepo {
	return &cmapRepoAdapter[*oapi.Workflow]{store: &s.workflows}
}

func (s *InMemory) WorkflowJobTemplates() repository.WorkflowJobTemplateRepo {
	return &cmapRepoAdapter[*oapi.WorkflowJobTemplate]{store: &s.workflowJobTemplates}
}

type workflowRunRepoAdapter struct {
	store *cmap.ConcurrentMap[string, *oapi.WorkflowRun]
}

func (a *workflowRunRepoAdapter) Get(id string) (*oapi.WorkflowRun, bool) {
	return a.store.Get(id)
}

func (a *workflowRunRepoAdapter) Set(entity *oapi.WorkflowRun) error {
	a.store.Set(entity.Id, entity)
	return nil
}

func (a *workflowRunRepoAdapter) Remove(id string) error {
	a.store.Remove(id)
	return nil
}

func (a *workflowRunRepoAdapter) Items() map[string]*oapi.WorkflowRun {
	return a.store.Items()
}

func (a *workflowRunRepoAdapter) GetByWorkflowID(workflowID string) ([]*oapi.WorkflowRun, error) {
	var result []*oapi.WorkflowRun
	for item := range a.store.IterBuffered() {
		if item.Val.WorkflowId == workflowID {
			result = append(result, item.Val)
		}
	}
	return result, nil
}

func (s *InMemory) WorkflowRuns() repository.WorkflowRunRepo {
	return &workflowRunRepoAdapter{store: &s.workflowRuns}
}

type workflowJobRepoAdapter struct {
	store *cmap.ConcurrentMap[string, *oapi.WorkflowJob]
}

func (a *workflowJobRepoAdapter) Get(id string) (*oapi.WorkflowJob, bool) {
	return a.store.Get(id)
}

func (a *workflowJobRepoAdapter) Set(entity *oapi.WorkflowJob) error {
	a.store.Set(entity.Id, entity)
	return nil
}

func (a *workflowJobRepoAdapter) Remove(id string) error {
	a.store.Remove(id)
	return nil
}

func (a *workflowJobRepoAdapter) Items() map[string]*oapi.WorkflowJob {
	return a.store.Items()
}

func (a *workflowJobRepoAdapter) GetByWorkflowRunID(workflowRunID string) ([]*oapi.WorkflowJob, error) {
	var result []*oapi.WorkflowJob
	for item := range a.store.IterBuffered() {
		if item.Val.WorkflowRunId == workflowRunID {
			result = append(result, item.Val)
		}
	}
	return result, nil
}

func (s *InMemory) WorkflowJobs() repository.WorkflowJobRepo {
	return &workflowJobRepoAdapter{store: &s.workflowJobs}
}

// SystemEnvironments implements repository.Repo.
func (s *InMemory) SystemEnvironments() repository.SystemEnvironmentRepo {
	return &systemEnvironmentRepoAdapter{
		links:     s.systemEnvironmentLinks,
		persisted: &s.systemEnvironmentLinkStore,
	}
}

// RestoreLinks rebuilds the in-memory link stores from the persisted link entities.
// This should be called after Router().Apply() loads data from persistence.
func (s *InMemory) RestoreLinks() {
	for item := range s.systemDeploymentLinkStore.IterBuffered() {
		s.systemDeploymentLinks.link(item.Val.SystemId, item.Val.DeploymentId)
	}
	for item := range s.systemEnvironmentLinkStore.IterBuffered() {
		s.systemEnvironmentLinks.link(item.Val.SystemId, item.Val.EnvironmentId)
	}
}
