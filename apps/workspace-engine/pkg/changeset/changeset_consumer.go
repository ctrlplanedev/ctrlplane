package changeset

import (
	"context"
)

type ChangesetConsumer[T any] interface {
	FlushChangeset(ctx context.Context, changeset *ChangeSet[T]) error
}

type NoopChangesetConsumer struct{}

var _ ChangesetConsumer[any] = (*NoopChangesetConsumer)(nil)

func NewNoopChangesetConsumer() *NoopChangesetConsumer {
	return &NoopChangesetConsumer{}
}

func (n *NoopChangesetConsumer) FlushChangeset(ctx context.Context, changeset *ChangeSet[any]) error {
	return nil
}
