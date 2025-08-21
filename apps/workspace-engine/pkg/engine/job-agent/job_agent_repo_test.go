package jobagent

import (
	"context"
	"errors"
	"testing"
	"workspace-engine/pkg/model/job"

	"gotest.tools/assert"
)

var _ JobAgent = (*MockJobAgent)(nil)

type MockJobAgent struct {
	ID     string
	Type   JobAgentType
	Config map[string]any
}

func (m *MockJobAgent) GetID() string {
	return m.ID
}

func (m *MockJobAgent) GetType() JobAgentType {
	return JobAgentTypeMock
}

func (m *MockJobAgent) GetConfig() map[string]any {
	return m.Config
}

func (m *MockJobAgent) DispatchJob(ctx context.Context, job *job.Job) error {
	return nil
}

type JobAgentTestStep struct {
	createJobAgent *MockJobAgent
	updateJobAgent *MockJobAgent
	removeJobAgent *MockJobAgent

	expectedJobAgents map[string]*MockJobAgent
	expectedError     error
}

type JobAgentTest struct {
	name  string
	steps []JobAgentTestStep
}

func assertEqualError(t *testing.T, actualError error, expectedError error) {
	if expectedError == nil {
		assert.NilError(t, actualError)
		return
	}

	assert.Error(t, actualError, expectedError.Error())
}

func TestJobAgentRepository(t *testing.T) {
	createsJobAgent := JobAgentTest{
		name: "creates job agent",
		steps: []JobAgentTestStep{
			{
				createJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{
					"1": {ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
						"key": "value",
					}},
				},
				expectedError: nil,
			},
		},
	}

	updatesJobAgent := JobAgentTest{
		name: "updates job agent",
		steps: []JobAgentTestStep{
			{
				createJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{
					"1": {ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
						"key": "value",
					}},
				},
				expectedError: nil,
			},
			{
				updateJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value2",
				}},
				expectedJobAgents: map[string]*MockJobAgent{
					"1": {ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
						"key": "value2",
					}},
				},
				expectedError: nil,
			},
		},
	}

	deletesJobAgent := JobAgentTest{
		name: "deletes job agent",
		steps: []JobAgentTestStep{
			{
				createJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{
					"1": {ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
						"key": "value",
					}},
				},
				expectedError: nil,
			},
			{
				removeJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{},
				expectedError:     nil,
			},
		},
	}

	errorsIfTryingToCreateDuplicateJobAgent := JobAgentTest{
		name: "errors if trying to create duplicate job agent",
		steps: []JobAgentTestStep{
			{
				createJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{
					"1": {ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
						"key": "value",
					}},
				},
				expectedError: nil,
			},
			{
				createJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{
					"1": {ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
						"key": "value",
					}},
				},
				expectedError: errors.New("job agent already exists"),
			},
		},
	}

	errorsIfTryingToUpdateNonExistantAgent := JobAgentTest{
		name: "errors if trying to update non-existent agent",
		steps: []JobAgentTestStep{
			{
				updateJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{},
				expectedError:     errors.New("job agent does not exist"),
			},
		},
	}

	errorsIfTryingToDeleteNonExistantAgent := JobAgentTest{
		name: "errors if trying to delete non-existent agent",
		steps: []JobAgentTestStep{
			{
				removeJobAgent: &MockJobAgent{ID: "1", Type: JobAgentTypeMock, Config: map[string]any{
					"key": "value",
				}},
				expectedJobAgents: map[string]*MockJobAgent{},
				expectedError:     errors.New("job agent does not exist"),
			},
		},
	}

	tests := []JobAgentTest{
		createsJobAgent,
		updatesJobAgent,
		deletesJobAgent,
		errorsIfTryingToCreateDuplicateJobAgent,
		errorsIfTryingToUpdateNonExistantAgent,
		errorsIfTryingToDeleteNonExistantAgent,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := NewJobAgentRepository()
			ctx := context.Background()

			for _, step := range test.steps {
				if step.createJobAgent != nil {
					var agent JobAgent = step.createJobAgent
					err := repo.Create(ctx, &agent)
					assertEqualError(t, err, step.expectedError)
				}

				if step.updateJobAgent != nil {
					var agent JobAgent = step.updateJobAgent
					err := repo.Update(ctx, &agent)
					assertEqualError(t, err, step.expectedError)
				}

				if step.removeJobAgent != nil {
					err := repo.Delete(ctx, step.removeJobAgent.ID)
					assertEqualError(t, err, step.expectedError)
					assert.Equal(t, repo.Exists(ctx, step.removeJobAgent.ID), false)
				}

				actualAgents := repo.GetAll(ctx)
				for id, expectedAgent := range step.expectedJobAgents {
					found := false
					assert.Equal(t, repo.Exists(ctx, id), true)
					for _, actualAgent := range actualAgents {
						actualAgentCopy := *actualAgent
						actualID := actualAgentCopy.GetID()
						gotAgent := repo.Get(ctx, actualID)
						assert.Assert(t, gotAgent != nil)
						if actualID == id {
							assert.Equal(t, actualAgentCopy.GetID(), expectedAgent.GetID())
							assert.Equal(t, actualAgentCopy.GetType(), expectedAgent.GetType())
							assert.DeepEqual(t, actualAgentCopy.GetConfig(), expectedAgent.GetConfig())
							found = true
							break
						}
					}
					assert.Equal(t, found, true)
				}
			}
		})
	}
}

func TestNilHandling(t *testing.T) {
	repo := NewJobAgentRepository()
	ctx := context.Background()

	err := repo.Create(ctx, nil)
	assertEqualError(t, err, errors.New("job agent is nil"))

	err = repo.Update(ctx, nil)
	assertEqualError(t, err, errors.New("job agent is nil"))

	var nilIFace JobAgent = nil
	err = repo.Create(ctx, &nilIFace)
	assertEqualError(t, err, errors.New("job agent is nil"))

	err = repo.Update(ctx, &nilIFace)
	assertEqualError(t, err, errors.New("job agent is nil"))
}
