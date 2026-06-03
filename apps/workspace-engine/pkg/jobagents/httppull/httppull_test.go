package httppull

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

type updateJobCall struct {
	JobID    string
	Status   oapi.JobStatus
	Message  string
	Metadata map[string]string
}

type mockSetter struct {
	calls []updateJobCall
	err   error
}

func (m *mockSetter) UpdateJob(
	_ context.Context,
	jobID string,
	status oapi.JobStatus,
	message string,
	metadata map[string]string,
) error {
	m.calls = append(m.calls, updateJobCall{jobID, status, message, metadata})
	return m.err
}

func newTestJob(id string) *oapi.Job {
	return &oapi.Job{Id: id, Status: oapi.JobStatusPending}
}

func TestType(t *testing.T) {
	assert.Equal(t, "http-pull", New(&mockSetter{}).Type())
}

// Dispatch must make the job claimable by moving it to queued — not in_progress
// (the agent does not run the job) and not leaving it pending. The pull flow
// depends on this exact transition.
func TestDispatch_MarksQueued(t *testing.T) {
	setter := &mockSetter{}
	err := New(setter).Dispatch(context.Background(), newTestJob("job-1"))
	require.NoError(t, err)

	require.Len(t, setter.calls, 1)
	assert.Equal(t, "job-1", setter.calls[0].JobID)
	assert.Equal(t, oapi.JobStatusQueued, setter.calls[0].Status)
	assert.Empty(t, setter.calls[0].Message)
	assert.Nil(t, setter.calls[0].Metadata)
}

func TestDispatch_PropagatesSetterError(t *testing.T) {
	setterErr := errors.New("update failed")
	err := New(&mockSetter{err: setterErr}).Dispatch(context.Background(), newTestJob("job-1"))
	assert.ErrorIs(t, err, setterErr)
}

func TestImplementsDispatchable(t *testing.T) {
	var _ interface {
		Type() string
		Dispatch(ctx context.Context, job *oapi.Job) error
	} = &HTTPPull{}
}
