package selector

import (
	"time"
	"workspace-engine/pkg/model/resource"
)

func resourceFixture() resource.Resource {
	return resource.Resource{
		ID:        "res-123",
		Name:      "Test Resource",
		CreatedAt: time.Now().Add(-24 * time.Hour),
		LastSync:  time.Now(),
		Metadata: map[string]string{
			"environment": "production",
			"owner":       "team-a",
		},
	}
}
