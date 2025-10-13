package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

func FlushChangeset(ctx context.Context, cs *changeset.ChangeSet) error {
	cs.Mutex.Lock()
	defer cs.Mutex.Unlock()

	if len(cs.Changes) == 0 {
		return nil
	}

	conn, err := GetDB(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, change := range cs.Changes {
		if err := applyChange(ctx, tx, change); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	cs.Changes = cs.Changes[:0] // Clear changes
	return nil
}

func applyResourceChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiResource, err := oapi.ConvertToOapiResource(change.Entity)
	if err != nil {
		return err
	}
	if change.Type == changeset.ChangeTypeDelete {
		return deleteResource(ctx, oapiResource.Id, conn)
	}
	return writeResource(ctx, oapiResource, conn)
}

func applyDeploymentChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiDeployment, err := oapi.ConvertToOapiDeployment(change.Entity)
	if err != nil {
		return err
	}
	if change.Type == changeset.ChangeTypeDelete {
		return deleteDeployment(ctx, oapiDeployment.Id, conn)
	}
	return writeDeployment(ctx, oapiDeployment, conn)
}

func applyEnvironmentChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiEnvironment, err := oapi.ConvertToOapiEnvironment(change.Entity)
	if err != nil {
		return err
	}
	if change.Type == changeset.ChangeTypeDelete {
		return deleteEnvironment(ctx, oapiEnvironment.Id, conn)
	}
	return writeEnvironment(ctx, oapiEnvironment, conn)
}

func applyPolicyChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiPolicy, err := oapi.ConvertToOapiPolicy(change.Entity)
	if err != nil {
		return err
	}
	if change.Type == changeset.ChangeTypeDelete {
		return deletePolicy(ctx, oapiPolicy.Id, conn)
	}
	return writePolicy(ctx, oapiPolicy, conn)
}

func applyRelationshipRuleChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiRelationshipRule, err := oapi.ConvertToOapiRelationshipRule(change.Entity)
	if err != nil {
		return err
	}

	if change.Type == changeset.ChangeTypeDelete {
		return deleteRelationshipRule(ctx, oapiRelationshipRule.Id, conn)
	}

	return writeRelationshipRule(ctx, oapiRelationshipRule, conn)
}

func applyJobAgentChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiJobAgent, err := oapi.ConvertToOapiJobAgent(change.Entity)
	if err != nil {
		return err
	}

	if change.Type == changeset.ChangeTypeDelete {
		return deleteJobAgent(ctx, oapiJobAgent.Id, conn)
	}

	return writeJobAgent(ctx, oapiJobAgent, conn)
}

func applySystemChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiSystem, err := oapi.ConvertToOapiSystem(change.Entity)
	if err != nil {
		return err
	}

	if change.Type == changeset.ChangeTypeDelete {
		return deleteSystem(ctx, oapiSystem.Id, conn)
	}

	return writeSystem(ctx, oapiSystem, conn)
}

func applyDeploymentVariableChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiDeploymentVariable, err := oapi.ConvertToOapiDeploymentVariable(change.Entity)
	if err != nil {
		return err
	}

	if change.Type == changeset.ChangeTypeDelete {
		return deleteDeploymentVariable(ctx, oapiDeploymentVariable.Id, conn)
	}

	return writeDeploymentVariable(ctx, oapiDeploymentVariable, conn)
}

func applyDeploymentVersionChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	oapiDeploymentVersion, err := oapi.ConvertToOapiDeploymentVersion(change.Entity)
	if err != nil {
		return err
	}

	if change.Type == changeset.ChangeTypeDelete {
		return deleteDeploymentVersion(ctx, oapiDeploymentVersion.Id, conn)
	}

	return writeDeploymentVersion(ctx, oapiDeploymentVersion, conn)
}

func applyChange(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	if change.EntityType == changeset.EntityTypeResource {
		return applyResourceChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypeDeployment {
		return applyDeploymentChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypeEnvironment {
		return applyEnvironmentChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypePolicy {
		return applyPolicyChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypeResourceRelationshipRule {
		return applyRelationshipRuleChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypeJobAgent {
		return applyJobAgentChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypeSystem {
		return applySystemChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypeDeploymentVariable {
		return applyDeploymentVariableChange(ctx, conn, change)
	}

	if change.EntityType == changeset.EntityTypeDeploymentVersion {
		return applyDeploymentVersionChange(ctx, conn, change)
	}

	return fmt.Errorf("unknown entity type: %s", change.EntityType)
}

type DbChangesetConsumer struct{}

var _ changeset.ChangesetConsumer = (*DbChangesetConsumer)(nil)

func NewChangesetConsumer() *DbChangesetConsumer {
	return &DbChangesetConsumer{}
}

func (c *DbChangesetConsumer) FlushChangeset(ctx context.Context, changeset *changeset.ChangeSet) error {
	return FlushChangeset(ctx, changeset)
}
