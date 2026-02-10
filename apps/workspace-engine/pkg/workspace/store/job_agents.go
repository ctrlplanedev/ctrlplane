package store

import (
	"context"
	"fmt"
	"strings"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/secrets"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewJobAgents(store *Store) *JobAgents {
	secrets := secrets.NewEncryption()
	return &JobAgents{
		repo:    store.repo,
		store:   store,
		secrets: secrets,
	}
}

type JobAgents struct {
	repo    *repository.InMemoryStore
	store   *Store
	secrets secrets.Encryption
}

func (j *JobAgents) encryptCredentials(jobAgent *oapi.JobAgent) error {
	jobAgentConfig := jobAgent.Config
	for k, v := range jobAgentConfig {
		if k == "apiKey" {
			plaintext, ok := v.(string)
			if !ok {
				return fmt.Errorf("apiKey is not a string: %v", v)
			}
			if strings.HasPrefix(plaintext, secrets.AES_256_PREFIX) {
				continue
			}
			encrypted, err := j.secrets.Encrypt(plaintext)
			if err != nil {
				return err
			}
			jobAgentConfig[k] = encrypted
		}
	}
	return nil
}

func (j *JobAgents) Upsert(ctx context.Context, jobAgent *oapi.JobAgent) {
	if err := j.encryptCredentials(jobAgent); err != nil {
		log.Errorf("error encrypting credentials, skipping job agent upsert: %v", err)
		return
	}

	j.repo.JobAgents.Set(jobAgent.Id, jobAgent)
	j.store.changeset.RecordUpsert(jobAgent)
}

func (j *JobAgents) Get(id string) (*oapi.JobAgent, bool) {
	jobAgent, ok := j.repo.JobAgents.Get(id)
	return jobAgent, ok
}

func (j *JobAgents) Remove(ctx context.Context, id string) {
	jobAgent, ok := j.repo.JobAgents.Get(id)
	if !ok || jobAgent == nil {
		return
	}

	j.repo.JobAgents.Remove(id)
	j.store.changeset.RecordDelete(jobAgent)
}

func (j *JobAgents) Items() map[string]*oapi.JobAgent {
	return j.repo.JobAgents.Items()
}
