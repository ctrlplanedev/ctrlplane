package creators

import (
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

func NewJobAgent() *pb.JobAgent {
	return &pb.JobAgent{
		Id:   uuid.New().String(),
		Name: "test-job-agent",
		Type: "test-job-agent",
		Config: MustNewStructFromMap(map[string]any{
			"test": "test",
		}),
	}
}
