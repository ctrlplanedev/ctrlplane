package deploymentversion_test

import (
	"context"
	"testing"
	"time"
	deploymentversion "workspace-engine/pkg/engine/deployment-version"
	"workspace-engine/pkg/model/deployment"

	"gotest.tools/assert"
)

type DeploymentVersionRegistryTestStep struct {
	createDeploymentVersion *deployment.DeploymentVersion
	removeDeploymentVersion *deployment.DeploymentVersion
	updateDeploymentVersion *deployment.DeploymentVersion

	expectedDeploymentVersions map[string][]deployment.DeploymentVersion
}

type DeploymentVersionRegistryTest struct {
	name  string
	steps []DeploymentVersionRegistryTestStep
}

func TestDeploymentVersionRegistry(t *testing.T) {
	upsertDeploymentVersion := DeploymentVersionRegistryTest{
		name: "should upsert deployment version",
		steps: []DeploymentVersionRegistryTestStep{
			{
				createDeploymentVersion: &deployment.DeploymentVersion{
					ID:           "1",
					DeploymentID: "1",
					Tag:          "1.0.0",
					CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {
						{
							ID:           "1",
							DeploymentID: "1",
							Tag:          "1.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
			},
		},
	}

	removeDeploymentVersion := DeploymentVersionRegistryTest{
		name: "should remove deployment version",
		steps: []DeploymentVersionRegistryTestStep{
			{
				createDeploymentVersion: &deployment.DeploymentVersion{
					ID:           "1",
					DeploymentID: "1",
					Tag:          "1.0.0",
					CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {
						{
							ID:           "1",
							DeploymentID: "1",
							Tag:          "1.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
			},
			{
				removeDeploymentVersion: &deployment.DeploymentVersion{
					ID: "1",
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {},
				},
			},
		},
	}

	preserveSorting := DeploymentVersionRegistryTest{
		name: "should preserve sorting",
		steps: []DeploymentVersionRegistryTestStep{
			{
				createDeploymentVersion: &deployment.DeploymentVersion{
					ID:           "1",
					DeploymentID: "1",
					Tag:          "1.0.0",
					CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {
						{
							ID:           "1",
							DeploymentID: "1",
							Tag:          "1.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
			},
			{
				createDeploymentVersion: &deployment.DeploymentVersion{
					ID:           "2",
					DeploymentID: "1",
					Tag:          "2.0.0",
					CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {
						{
							ID:           "2",
							DeploymentID: "1",
							Tag:          "2.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
						},
						{
							ID:           "1",
							DeploymentID: "1",
							Tag:          "1.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
			},
		},
	}

	updateSorting := DeploymentVersionRegistryTest{
		name: "should update sorting",
		steps: []DeploymentVersionRegistryTestStep{
			{
				createDeploymentVersion: &deployment.DeploymentVersion{
					ID:           "1",
					DeploymentID: "1",
					Tag:          "1.0.0",
					CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {
						{
							ID:           "1",
							DeploymentID: "1",
							Tag:          "1.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
			},
			{
				createDeploymentVersion: &deployment.DeploymentVersion{
					ID:           "2",
					DeploymentID: "1",
					Tag:          "2.0.0",
					CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {
						{
							ID:           "2",
							DeploymentID: "1",
							Tag:          "2.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
						},
						{
							ID:           "1",
							DeploymentID: "1",
							Tag:          "1.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
			},
			{
				updateDeploymentVersion: &deployment.DeploymentVersion{
					ID:           "1",
					DeploymentID: "1",
					Tag:          "1.0.0",
					CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 2, time.UTC),
				},
				expectedDeploymentVersions: map[string][]deployment.DeploymentVersion{
					"1": {
						{
							ID:           "1",
							DeploymentID: "1",
							Tag:          "1.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 2, time.UTC),
						},
						{
							ID:           "2",
							DeploymentID: "1",
							Tag:          "2.0.0",
							CreatedAt:    time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
						},
					},
				},
			},
		},
	}

	tests := []DeploymentVersionRegistryTest{
		upsertDeploymentVersion,
		removeDeploymentVersion,
		preserveSorting,
		updateSorting,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			registry := deploymentversion.NewDeploymentVersionRepository()
			ctx := context.Background()

			for _, step := range test.steps {
				if step.createDeploymentVersion != nil {
					err := registry.Create(ctx, *step.createDeploymentVersion)
					assert.NilError(t, err)
				}

				if step.removeDeploymentVersion != nil {
					err := registry.Delete(ctx, step.removeDeploymentVersion.ID)
					assert.NilError(t, err)
				}

				if step.updateDeploymentVersion != nil {
					err := registry.Update(ctx, *step.updateDeploymentVersion)
					assert.NilError(t, err)
				}

				for deploymentID, expectedVersions := range step.expectedDeploymentVersions {
					actualVersions := registry.GetAllForDeployment(ctx, deploymentID)
					assert.DeepEqual(t, expectedVersions, actualVersions)
				}
			}
		})
	}
}
