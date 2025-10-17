package deploymentversions

import (
	"github.com/gin-gonic/gin"
)

type DeploymentVersions struct{}

func (s *DeploymentVersions) GetDeploymentVersionJobsList(c *gin.Context, workspaceId string, versionId string) {
	panic("not implemented")
}
