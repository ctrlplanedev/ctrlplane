package deploymentversion

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"google.golang.org/protobuf/types/known/structpb"
)

func getVersionStatus(status string) pb.DeploymentVersionStatus {
	switch status {
	case "building":
		return pb.DeploymentVersionStatus_DEPLOYMENT_VERSION_STATUS_BUILDING
	case "ready":
		return pb.DeploymentVersionStatus_DEPLOYMENT_VERSION_STATUS_READY
	case "failed":
		return pb.DeploymentVersionStatus_DEPLOYMENT_VERSION_STATUS_FAILED
	case "rejected":
		return pb.DeploymentVersionStatus_DEPLOYMENT_VERSION_STATUS_REJECTED
	default:
		return pb.DeploymentVersionStatus_DEPLOYMENT_VERSION_STATUS_UNSPECIFIED
	}
}

type rawDeploymentVersion struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	Tag            string           `json:"tag"`
	Config         *structpb.Struct `json:"config"`
	JobAgentConfig *structpb.Struct `json:"jobAgentConfig"`
	DeploymentId   string           `json:"deploymentId"`
	Status         string           `json:"status"`
	Message        string           `json:"message"`
	CreatedAt      string           `json:"createdAt"`
}

func NewRawDeploymentVersion(raw json.RawMessage) (*rawDeploymentVersion, error) {
	rawDeploymentVersion := &rawDeploymentVersion{}
	if err := json.Unmarshal(raw, rawDeploymentVersion); err != nil {
		log.Error("Failed to parse deployment version", "error", err)
		return nil, err
	}
	return rawDeploymentVersion, nil
}

func (r *rawDeploymentVersion) ToDeploymentVersion() *pb.DeploymentVersion {
	return &pb.DeploymentVersion{
		Id:             r.ID,
		Name:           r.Name,
		Tag:            r.Tag,
		Config:         r.Config,
		JobAgentConfig: r.JobAgentConfig,
		DeploymentId:   r.DeploymentId,
		Status:         getVersionStatus(r.Status),
		Message:        &r.Message,
		CreatedAt:      r.CreatedAt,
	}
}

func HandleDeploymentVersionCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	rawDeploymentVersion, err := NewRawDeploymentVersion(event.Data)
	if err != nil {
		return err
	}
	deploymentVersion := rawDeploymentVersion.ToDeploymentVersion()
	ws.DeploymentVersions().Upsert(deploymentVersion.Id, deploymentVersion)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)
	return nil
}

func HandleDeploymentVersionUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(event.Data, &raw); err != nil {
		return err
	}

	deploymentVersion := &pb.DeploymentVersion{}
	if currentData, exists := raw["current"]; exists {
		// Parse as nested structure with "current" field
		rawDeploymentVersion, err := NewRawDeploymentVersion(currentData)
		if err != nil {
			return err
		}
		deploymentVersion = rawDeploymentVersion.ToDeploymentVersion()

	} else {
		rawDeploymentVersion, err := NewRawDeploymentVersion(event.Data)
		if err != nil {
			return err
		}
		deploymentVersion = rawDeploymentVersion.ToDeploymentVersion()
	}

	ws.DeploymentVersions().Upsert(deploymentVersion.Id, deploymentVersion)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)

	return nil
}

func HandleDeploymentVersionDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	rawDeploymentVersion, err := NewRawDeploymentVersion(event.Data)
	if err != nil {
		return err
	}
	deploymentVersion := rawDeploymentVersion.ToDeploymentVersion()

	ws.DeploymentVersions().Remove(deploymentVersion.Id)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)

	return nil
}
