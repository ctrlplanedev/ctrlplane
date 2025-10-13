package changeset

import (
	"context"
)

type ChangesetConsumer interface {
	FlushChangeset(ctx context.Context, changeset *ChangeSet) error
}

type NoopChangesetConsumer struct{}

var _ ChangesetConsumer = (*NoopChangesetConsumer)(nil)

func NewNoopChangesetConsumer() *NoopChangesetConsumer {
	return &NoopChangesetConsumer{}
}

func (n *NoopChangesetConsumer) FlushChangeset(ctx context.Context, changeset *ChangeSet) error {
	return nil
}
