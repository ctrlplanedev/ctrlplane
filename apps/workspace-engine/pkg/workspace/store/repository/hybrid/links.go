package hybrid

import (
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type SystemDeploymentRepo struct {
	dbRepo *db.DBRepo
	mem    repository.SystemDeploymentRepo
}

func NewSystemDeploymentRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *SystemDeploymentRepo {
	return &SystemDeploymentRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.SystemDeployments(),
	}
}

func (r *SystemDeploymentRepo) GetSystemIDsForDeployment(deploymentID string) []string {
	return r.mem.GetSystemIDsForDeployment(deploymentID)
}

func (r *SystemDeploymentRepo) GetDeploymentIDsForSystem(systemID string) []string {
	return r.mem.GetDeploymentIDsForSystem(systemID)
}

func (r *SystemDeploymentRepo) Link(systemID, deploymentID string) error {
	if err := r.mem.Link(systemID, deploymentID); err != nil {
		return err
	}
	return r.dbRepo.SystemDeployments().Link(systemID, deploymentID)
}

func (r *SystemDeploymentRepo) Unlink(systemID, deploymentID string) error {
	if err := r.mem.Unlink(systemID, deploymentID); err != nil {
		return err
	}
	return r.dbRepo.SystemDeployments().Unlink(systemID, deploymentID)
}

type SystemEnvironmentRepo struct {
	dbRepo *db.DBRepo
	mem    repository.SystemEnvironmentRepo
}

func NewSystemEnvironmentRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *SystemEnvironmentRepo {
	return &SystemEnvironmentRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.SystemEnvironments(),
	}
}

func (r *SystemEnvironmentRepo) GetSystemIDsForEnvironment(environmentID string) []string {
	return r.mem.GetSystemIDsForEnvironment(environmentID)
}

func (r *SystemEnvironmentRepo) GetEnvironmentIDsForSystem(systemID string) []string {
	return r.mem.GetEnvironmentIDsForSystem(systemID)
}

func (r *SystemEnvironmentRepo) Link(systemID, environmentID string) error {
	if err := r.mem.Link(systemID, environmentID); err != nil {
		return err
	}
	return r.dbRepo.SystemEnvironments().Link(systemID, environmentID)
}

func (r *SystemEnvironmentRepo) Unlink(systemID, environmentID string) error {
	if err := r.mem.Unlink(systemID, environmentID); err != nil {
		return err
	}
	return r.dbRepo.SystemEnvironments().Unlink(systemID, environmentID)
}
