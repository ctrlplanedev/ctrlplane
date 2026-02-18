package diffcheck

import (
	"testing"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
)

func TestHasDeploymentChanges_NoChanges(t *testing.T) {
	desc := "test deployment"
	agentId := "agent-123"

	old := &oapi.Deployment{
		Name:        "api-deployment",
		Slug:        "api-deployment",
		Description: &desc,
		JobAgentId:  &agentId,
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:        "api-deployment",
		Slug:        "api-deployment",
		Description: &desc,
		JobAgentId:  &agentId,
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Id: "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Empty(t, changes, "Should have no changes when deployments are identical")
}

func TestHasDeploymentChanges_NilInputs(t *testing.T) {
	sample := &oapi.Deployment{
		Name:           "sample",
		Slug:           "sample",
		JobAgentConfig: oapi.JobAgentConfig{},
	}

	t.Run("nil-old", func(t *testing.T) {
		changes := HasDeploymentChanges(nil, sample)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})

	t.Run("nil-new", func(t *testing.T) {
		changes := HasDeploymentChanges(sample, nil)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})

	t.Run("both-nil", func(t *testing.T) {
		changes := HasDeploymentChanges(nil, nil)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})
}

func TestHasDeploymentChangesBasic_DetectsChanges(t *testing.T) {
	oldDesc := "old deployment"
	newDesc := "new deployment"
	oldAgent := "agent-old"
	newAgent := "agent-new"

	oldSelector := &oapi.Selector{}
	assert.NoError(t, oldSelector.FromCelSelector(oapi.CelSelector{Cel: "system == 'legacy'"}))

	newSelector := &oapi.Selector{}
	assert.NoError(t, newSelector.FromCelSelector(oapi.CelSelector{Cel: "system == 'modern' && team == 'platform'"}))

	old := &oapi.Deployment{
		Name:        "api-old",
		Slug:        "api-old",
		Description: &oldDesc,
		JobAgentId:  &oldAgent,
		JobAgentConfig: oapi.JobAgentConfig{
			"image":    "nginx:v1",
			"replicas": 1,
			"nested": map[string]interface{}{
				"key": "value",
			},
		},
		ResourceSelector: oldSelector,
	}

	new := &oapi.Deployment{
		Name:        "api-new",
		Slug:        "api-new",
		Description: &newDesc,
		JobAgentId:  &newAgent,
		JobAgentConfig: oapi.JobAgentConfig{
			"image":    "nginx:v2",
			"replicas": 2,
			"extra":    true,
		},
		ResourceSelector: newSelector,
	}

	changes := hasDeploymentChangesBasic(old, new)
	assert.True(t, changes["name"])
	assert.True(t, changes["description"])
	assert.True(t, changes["jobagentid"])
	assert.True(t, changes["jobagentconfig.image"])
	assert.True(t, changes["jobagentconfig.replicas"])
	assert.True(t, changes["jobagentconfig.nested"])
	assert.True(t, changes["jobagentconfig.extra"])
	assert.True(t, changes["resourceselector"])
}

func TestHasDeploymentChanges_NameChanged(t *testing.T) {
	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "web-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["name"], "Should detect name change")
}

func TestHasDeploymentChanges_SlugChanged(t *testing.T) {
	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment-v2",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["slug"], "Should detect slug change")
}

func TestHasDeploymentChanges_DescriptionChanged(t *testing.T) {
	oldDesc := "old description"
	newDesc := "new description"

	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		Description:    &oldDesc,
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		Description:    &newDesc,
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["description"], "Should detect description change")
}

func TestHasDeploymentChanges_JobAgentIdChanged(t *testing.T) {
	oldAgent := "agent-123"
	newAgent := "agent-456"

	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentId:     &oldAgent,
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentId:     &newAgent,
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["jobagentid"], "Should detect jobAgentId change")
}

func TestHasDeploymentChanges_JobAgentConfigValueChanged(t *testing.T) {
	old := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
			"image":    "nginx:1.0",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
			"image":    "nginx:2.0",
		},
		Id: "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["jobagentconfig.image"], "Should detect jobAgentConfig.image change")
}

func TestHasDeploymentChanges_JobAgentConfigKeyAdded(t *testing.T) {
	old := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Id: "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["jobagentconfig.image"], "Should detect new jobAgentConfig key")
}

func TestHasDeploymentChanges_JobAgentConfigKeyRemoved(t *testing.T) {
	old := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
		},
		Id: "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should detect removed jobAgentConfig key")
	assert.True(t, changes["jobagentconfig.image"], "Should detect jobAgentConfig.image was removed")
}

func TestHasDeploymentChanges_JobAgentConfigNestedChange(t *testing.T) {
	old := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"database": map[string]interface{}{
				"host": "localhost",
				"port": 5432,
			},
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"database": map[string]interface{}{
				"host": "prod-db.example.com",
				"port": 5432,
			},
		},
		Id: "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should detect nested config change")
	assert.True(t, changes["jobagentconfig.database.host"], "Should detect nested path jobagentconfig.database.host")
}

func TestHasDeploymentChanges_ResourceSelectorChanged(t *testing.T) {
	oldSelector := &oapi.Selector{}
	_ = oldSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"app": "api",
		},
	})

	newSelector := &oapi.Selector{}
	_ = newSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"app": "web",
		},
	})

	old := &oapi.Deployment{
		Name:             "api-deployment",
		Slug:             "api-deployment",
		ResourceSelector: oldSelector,
		JobAgentConfig:   oapi.JobAgentConfig{},
		Id:               "deploy-123",
	}

	new := &oapi.Deployment{
		Name:             "api-deployment",
		Slug:             "api-deployment",
		ResourceSelector: newSelector,
		JobAgentConfig:   oapi.JobAgentConfig{},
		Id:               "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.GreaterOrEqual(t, len(changes), 1, "Should detect resourceSelector change")
	// Check if any selector-related field changed
	hasResourceSelectorChange := false
	for key := range changes {
		if key == "resourceselector" || len(key) > len("resourceselector") && key[:len("resourceselector")] == "resourceselector" {
			hasResourceSelectorChange = true
			break
		}
	}
	assert.True(t, hasResourceSelectorChange, "Should detect resourceSelector change")
}

func TestHasDeploymentChanges_MultipleChanges(t *testing.T) {
	oldDesc := "old description"
	newDesc := "new description"

	old := &oapi.Deployment{
		Name:        "api-deployment",
		Slug:        "api-deployment",
		Description: &oldDesc,
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 3,
			"image":    "nginx:1.0",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:        "web-deployment",
		Slug:        "web-deployment",
		Description: &newDesc,
		JobAgentConfig: oapi.JobAgentConfig{
			"replicas": 5,
			"image":    "nginx:2.0",
		},
		Id: "deploy-456", // Different ID (should be ignored)
	}

	changes := HasDeploymentChanges(old, new)
	assert.GreaterOrEqual(t, len(changes), 5, "Should detect multiple changes")
	assert.True(t, changes["name"], "Should detect name change")
	assert.True(t, changes["slug"], "Should detect slug change")
	assert.True(t, changes["description"], "Should detect description change")
	assert.True(t, changes["jobagentconfig.replicas"], "Should detect jobAgentConfig.replicas change")
	assert.True(t, changes["jobagentconfig.image"], "Should detect jobAgentConfig.image change")
	assert.False(t, changes["id"], "Should ignore id change")
}

func TestHasDeploymentChanges_IdIgnored(t *testing.T) {
	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-old",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-new",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Empty(t, changes, "Should ignore id field changes")
	assert.False(t, changes["id"], "Should not detect id change")
}

func TestHasDeploymentChanges_IdIgnoredWithOtherChanges(t *testing.T) {
	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-old",
	}

	new := &oapi.Deployment{
		Name:           "web-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-new",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should only detect name change, not id change")
	assert.True(t, changes["name"], "Should detect name change")
	assert.False(t, changes["id"], "Should not detect id change")
}

func TestHasDeploymentChanges_EmptyJobAgentConfig(t *testing.T) {
	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Empty(t, changes, "Should have no changes with empty jobAgentConfig")
}

func TestHasDeploymentChanges_NilToSetDescription(t *testing.T) {
	newDesc := "new description"

	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		Description:    nil,
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		Description:    &newDesc,
		JobAgentConfig: oapi.JobAgentConfig{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should detect description added")
	assert.True(t, changes["description"], "Should detect description change from nil to set")
}

func TestHasDeploymentChanges_DeeplyNestedJobAgentConfig(t *testing.T) {
	old := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"services": map[string]interface{}{
				"database": map[string]interface{}{
					"credentials": map[string]interface{}{
						"username": "admin",
						"password": "old-password",
					},
				},
			},
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name: "api-deployment",
		Slug: "api-deployment",
		JobAgentConfig: oapi.JobAgentConfig{
			"services": map[string]interface{}{
				"database": map[string]interface{}{
					"credentials": map[string]interface{}{
						"username": "admin",
						"password": "new-password",
					},
				},
			},
		},
		Id: "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should detect deeply nested change")
	assert.True(t, changes["jobagentconfig.services.database.credentials.password"],
		"Should detect full nested path jobagentconfig.services.database.credentials.password")
}
