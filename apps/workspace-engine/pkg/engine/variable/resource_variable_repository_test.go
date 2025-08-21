package variable

import (
	"context"
	"errors"
	"testing"

	modelvariable "workspace-engine/pkg/model/variable"

	"gotest.tools/assert"
)

type resourceVariableRepositoryTestStep struct {
	createResourceVariable *modelvariable.DirectResourceVariableValue
	updateResourceVariable *modelvariable.DirectResourceVariableValue
	deleteResourceVariable *modelvariable.DirectResourceVariableValue

	expectedResourceVariables map[string]map[string]*modelvariable.DirectResourceVariableValue
	expectedError             error
}

type resourceVariableRepositoryTest struct {
	name  string
	steps []resourceVariableRepositoryTestStep
}

type testBundle struct {
	repo *ResourceVariableRepository
	ctx  context.Context
	t    *testing.T
	step resourceVariableRepositoryTestStep
}

func (b *testBundle) assertEqualError(actualError error) {
	if b.step.expectedError == nil {
		assert.NilError(b.t, actualError)
		return
	}

	assert.Error(b.t, actualError, b.step.expectedError.Error())
}

func (b *testBundle) executeStep() *testBundle {
	if b.step.createResourceVariable != nil {
		var variable modelvariable.ResourceVariable = b.step.createResourceVariable
		err := b.repo.Create(b.ctx, &variable)
		b.assertEqualError(err)
	}

	if b.step.updateResourceVariable != nil {
		var variable modelvariable.ResourceVariable = b.step.updateResourceVariable
		err := b.repo.Update(b.ctx, &variable)
		b.assertEqualError(err)
	}

	if b.step.deleteResourceVariable != nil {
		err := b.repo.Delete(b.ctx, b.step.deleteResourceVariable.GetID())
		b.assertEqualError(err)
		assert.Assert(b.t, b.repo.Exists(b.ctx, b.step.deleteResourceVariable.GetID()) == false)
	}

	return b
}

func (b *testBundle) assertVariableEqual(actualVariable modelvariable.ResourceVariable, expectedVariable *modelvariable.DirectResourceVariableValue) {
	actualVariableCastedPtr := actualVariable.(*modelvariable.DirectResourceVariableValue)
	assert.Equal(b.t, actualVariableCastedPtr.GetID(), expectedVariable.GetID())
	assert.Equal(b.t, actualVariableCastedPtr.GetResourceID(), expectedVariable.GetResourceID())
	assert.Equal(b.t, actualVariableCastedPtr.GetKey(), expectedVariable.GetKey())
	assert.Equal(b.t, actualVariableCastedPtr.GetValue(), expectedVariable.GetValue())
	assert.Equal(b.t, actualVariableCastedPtr.IsSensitive(), expectedVariable.IsSensitive())
}

func (b *testBundle) validateVariableReturnedFromGet(variable *modelvariable.DirectResourceVariableValue) *testBundle {
	actualVariable := b.repo.Get(b.ctx, variable.GetID())
	assert.Assert(b.t, actualVariable != nil)
	assert.Assert(b.t, *actualVariable != nil)
	b.assertVariableEqual(*actualVariable, variable)
	return b
}

func (b *testBundle) validateVariableReturnedFromGetAll(variable *modelvariable.DirectResourceVariableValue) *testBundle {
	allVariables := b.repo.GetAll(b.ctx)
	for _, actualVariable := range allVariables {
		if actualVariable == nil || *actualVariable == nil {
			continue
		}

		b.assertVariableEqual(*actualVariable, variable)
		return b
	}

	b.t.Errorf("variable not found in GetAll")
	return b
}

func (b *testBundle) validateVariableReturnedFromGetAllByResourceID(variable *modelvariable.DirectResourceVariableValue) *testBundle {
	resourceVariables := b.repo.GetAllByResourceID(b.ctx, variable.GetResourceID())

	for _, actualVariable := range resourceVariables {
		if actualVariable == nil || *actualVariable == nil {
			continue
		}

		b.assertVariableEqual(*actualVariable, variable)
		return b
	}

	b.t.Errorf("variable not found in GetAllByResourceID")
	return b
}

func (b *testBundle) validateVariableReturnedFromGetByResourceIDAndKey(variable *modelvariable.DirectResourceVariableValue) *testBundle {
	actualVariable := b.repo.GetByResourceIDAndKey(b.ctx, variable.GetResourceID(), variable.GetKey())
	assert.Assert(b.t, actualVariable != nil)
	assert.Assert(b.t, *actualVariable != nil)
	b.assertVariableEqual(*actualVariable, variable)
	return b
}

func (b *testBundle) validateVariableExists(variable *modelvariable.DirectResourceVariableValue) *testBundle {
	assert.Assert(b.t, b.repo.Exists(b.ctx, variable.GetID()))
	return b
}

func (b *testBundle) validateVariableState() *testBundle {
	allVariables := b.repo.GetAll(b.ctx)
	numExpectedVariables := 0

	for _, expectedVariablesForResource := range b.step.expectedResourceVariables {
		for _, expectedVariable := range expectedVariablesForResource {
			b.
				validateVariableReturnedFromGet(expectedVariable).
				validateVariableReturnedFromGetAll(expectedVariable).
				validateVariableReturnedFromGetAllByResourceID(expectedVariable).
				validateVariableReturnedFromGetByResourceIDAndKey(expectedVariable).
				validateVariableExists(expectedVariable)

			numExpectedVariables++
		}
	}

	assert.Equal(b.t, len(allVariables), numExpectedVariables)

	return b
}

func TestResourceVariableRepository(t *testing.T) {
	createResourceVariable := resourceVariableRepositoryTest{
		name: "creates a resource variable",
		steps: []resourceVariableRepositoryTestStep{
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key",
					Value:      "value",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
		},
	}

	updateResourceVariable := resourceVariableRepositoryTest{
		name: "updates a resource variable",
		steps: []resourceVariableRepositoryTestStep{
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key",
					Value:      "value",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
			{
				updateResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key",
					Value:      "value2",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value2",
							Sensitive:  false,
						},
					},
				},
			},
		},
	}

	deleteResourceVariable := resourceVariableRepositoryTest{
		name: "deletes a resource variable",
		steps: []resourceVariableRepositoryTestStep{
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "2",
					ResourceID: "1",
					Key:        "key",
					Value:      "value",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "2",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
			{
				deleteResourceVariable:    &modelvariable.DirectResourceVariableValue{ID: "2"},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{"1": {}},
			},
		},
	}

	throwsErrorOnDuplicateID := resourceVariableRepositoryTest{
		name: "throws error on duplicate ID",
		steps: []resourceVariableRepositoryTestStep{
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "3",
					ResourceID: "1",
					Key:        "key2",
					Value:      "value",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key2": {
							ID:         "3",
							ResourceID: "1",
							Key:        "key2",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "3",
					ResourceID: "1",
					Key:        "key3",
					Value:      "value",
					Sensitive:  false,
				},
				expectedError: errors.New("variable already exists with ID 3"),
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key2": {
							ID:         "3",
							ResourceID: "1",
							Key:        "key2",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
		},
	}

	throwsErrorOnDuplicateKey := resourceVariableRepositoryTest{
		name: "throws error on duplicate key for a resource",
		steps: []resourceVariableRepositoryTestStep{
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key",
					Value:      "value",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "2",
					ResourceID: "1",
					Key:        "key",
					Value:      "value2",
					Sensitive:  false,
				},
				expectedError: errors.New("variable already exists for resource 1 and key key"),
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
		},
	}

	throwsErrorOnUpdateNonExistentResource := resourceVariableRepositoryTest{
		name: "throws error on update with non existent resource",
		steps: []resourceVariableRepositoryTestStep{
			{
				updateResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key",
					Value:      "value",
					Sensitive:  false,
				},
				expectedError:             errors.New("resource not found"),
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{},
			},
		},
	}

	throwsErrorOnUpdateNonExistentKey := resourceVariableRepositoryTest{
		name: "throws error on update with non existent key",
		steps: []resourceVariableRepositoryTestStep{
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key",
					Value:      "value",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
			{
				updateResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key2",
					Value:      "value2",
					Sensitive:  false,
				},
				expectedError: errors.New("variable key not found"),
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
		},
	}

	throwsErrorOnUpdateMismatchedID := resourceVariableRepositoryTest{
		name: "throws error on update with mismatched ID",
		steps: []resourceVariableRepositoryTestStep{
			{
				createResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "1",
					ResourceID: "1",
					Key:        "key",
					Value:      "value",
					Sensitive:  false,
				},
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
			{
				updateResourceVariable: &modelvariable.DirectResourceVariableValue{
					ID:         "2",
					ResourceID: "1",
					Key:        "key",
					Value:      "value2",
					Sensitive:  false,
				},
				expectedError: errors.New("variable ID mismatch"),
				expectedResourceVariables: map[string]map[string]*modelvariable.DirectResourceVariableValue{
					"1": {
						"key": {
							ID:         "1",
							ResourceID: "1",
							Key:        "key",
							Value:      "value",
							Sensitive:  false,
						},
					},
				},
			},
		},
	}

	tests := []resourceVariableRepositoryTest{
		createResourceVariable,
		updateResourceVariable,
		deleteResourceVariable,
		throwsErrorOnDuplicateID,
		throwsErrorOnDuplicateKey,
		throwsErrorOnUpdateNonExistentResource,
		throwsErrorOnUpdateNonExistentKey,
		throwsErrorOnUpdateMismatchedID,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := NewResourceVariableRepository()
			ctx := context.Background()

			for _, step := range test.steps {

				bundle := &testBundle{
					repo: repo,
					ctx:  ctx,
					t:    t,
					step: step,
				}

				bundle.
					executeStep().
					validateVariableState()
			}
		})
	}
}

func TestNilHandling(t *testing.T) {
	repo := NewResourceVariableRepository()
	ctx := context.Background()

	err := repo.Create(ctx, nil)
	assert.Error(t, err, "variable is nil")

	err = repo.Update(ctx, nil)
	assert.Error(t, err, "variable is nil")

	var nilIFace modelvariable.ResourceVariable = nil
	err = repo.Create(ctx, &nilIFace)
	assert.Error(t, err, "variable is nil")

	err = repo.Update(ctx, &nilIFace)
	assert.Error(t, err, "variable is nil")

	nonExistent := repo.Get(ctx, "non-existent")
	assert.Assert(t, nonExistent == (*modelvariable.ResourceVariable)(nil))
}
