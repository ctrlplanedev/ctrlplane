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
		SystemId:    "sys-123",
		Description: &desc,
		JobAgentId:  &agentId,
		JobAgentConfig: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:        "api-deployment",
		Slug:        "api-deployment",
		SystemId:    "sys-123",
		Description: &desc,
		JobAgentId:  &agentId,
		JobAgentConfig: map[string]interface{}{
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
		SystemId:       "sys-1",
		JobAgentConfig: map[string]interface{}{},
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
	assert.NoError(t, oldSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"system": "legacy",
		},
	}))

	newSelector := &oapi.Selector{}
	assert.NoError(t, newSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"system": "modern",
			"team":   "platform",
		},
	}))

	old := &oapi.Deployment{
		Name:        "api-old",
		Slug:        "api-old",
		SystemId:    "sys-old",
		Description: &oldDesc,
		JobAgentId:  &oldAgent,
		JobAgentConfig: map[string]interface{}{
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
		SystemId:    "sys-new",
		Description: &newDesc,
		JobAgentId:  &newAgent,
		JobAgentConfig: map[string]interface{}{
			"image":    "nginx:v2",
			"replicas": 2,
			"extra":    true,
		},
		ResourceSelector: newSelector,
	}

	changes := hasDeploymentChangesBasic(old, new)
	assert.True(t, changes["name"])
	assert.True(t, changes["slug"])
	assert.True(t, changes["systemid"])
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
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "web-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
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
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment-v2",
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["slug"], "Should detect slug change")
}

func TestHasDeploymentChanges_SystemIdChanged(t *testing.T) {
	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-456",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["systemid"], "Should detect systemId change")
}

func TestHasDeploymentChanges_DescriptionChanged(t *testing.T) {
	oldDesc := "old description"
	newDesc := "new description"

	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		Description:    &oldDesc,
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		Description:    &newDesc,
		JobAgentConfig: map[string]interface{}{},
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
		SystemId:       "sys-123",
		JobAgentId:     &oldAgent,
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		JobAgentId:     &newAgent,
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["jobagentid"], "Should detect jobAgentId change")
}

func TestHasDeploymentChanges_JobAgentConfigValueChanged(t *testing.T) {
	old := &oapi.Deployment{
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:1.0",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
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
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
			"replicas": 3,
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
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
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
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
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
			"database": map[string]interface{}{
				"host": "localhost",
				"port": 5432,
			},
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
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
	oldSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"app": "api",
		},
	})

	newSelector := &oapi.Selector{}
	newSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"app": "web",
		},
	})

	old := &oapi.Deployment{
		Name:             "api-deployment",
		Slug:             "api-deployment",
		SystemId:         "sys-123",
		ResourceSelector: oldSelector,
		JobAgentConfig:   map[string]interface{}{},
		Id:               "deploy-123",
	}

	new := &oapi.Deployment{
		Name:             "api-deployment",
		Slug:             "api-deployment",
		SystemId:         "sys-123",
		ResourceSelector: newSelector,
		JobAgentConfig:   map[string]interface{}{},
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
		SystemId:    "sys-123",
		Description: &oldDesc,
		JobAgentConfig: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:1.0",
		},
		Id: "deploy-123",
	}

	new := &oapi.Deployment{
		Name:        "web-deployment",
		Slug:        "web-deployment",
		SystemId:    "sys-456",
		Description: &newDesc,
		JobAgentConfig: map[string]interface{}{
			"replicas": 5,
			"image":    "nginx:2.0",
		},
		Id: "deploy-456", // Different ID (should be ignored)
	}

	changes := HasDeploymentChanges(old, new)
	assert.GreaterOrEqual(t, len(changes), 6, "Should detect multiple changes")
	assert.True(t, changes["name"], "Should detect name change")
	assert.True(t, changes["slug"], "Should detect slug change")
	assert.True(t, changes["systemid"], "Should detect systemId change")
	assert.True(t, changes["description"], "Should detect description change")
	assert.True(t, changes["jobagentconfig.replicas"], "Should detect jobAgentConfig.replicas change")
	assert.True(t, changes["jobagentconfig.image"], "Should detect jobAgentConfig.image change")
	assert.False(t, changes["id"], "Should ignore id change")
}

func TestHasDeploymentChanges_IdIgnored(t *testing.T) {
	old := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-old",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
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
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-old",
	}

	new := &oapi.Deployment{
		Name:           "web-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
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
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		JobAgentConfig: map[string]interface{}{},
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
		SystemId:       "sys-123",
		Description:    nil,
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	new := &oapi.Deployment{
		Name:           "api-deployment",
		Slug:           "api-deployment",
		SystemId:       "sys-123",
		Description:    &newDesc,
		JobAgentConfig: map[string]interface{}{},
		Id:             "deploy-123",
	}

	changes := HasDeploymentChanges(old, new)
	assert.Len(t, changes, 1, "Should detect description added")
	assert.True(t, changes["description"], "Should detect description change from nil to set")
}

func TestHasDeploymentChanges_DeeplyNestedJobAgentConfig(t *testing.T) {
	old := &oapi.Deployment{
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
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
		Name:     "api-deployment",
		Slug:     "api-deployment",
		SystemId: "sys-123",
		JobAgentConfig: map[string]interface{}{
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
