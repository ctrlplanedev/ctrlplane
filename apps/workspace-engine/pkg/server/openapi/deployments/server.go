package deployments

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Deployments struct{}

func New() *Deployments {
	return &Deployments{}
}

func (s *Deployments) ListDeployments(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	deployments := ws.Deployments()
	c.JSON(http.StatusOK, gin.H{
		"deployments": deployments,
	})
}

func (s *Deployments) GetDeployment(c *gin.Context, workspaceId string, deploymentId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	deployment, ok := ws.Deployments().Get(deploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	c.JSON(http.StatusOK, deployment)
}

func (s *Deployments) ListDeploymentVersions(c *gin.Context, workspaceId string, deploymentId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	_, ok := ws.Deployments().Get(deploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	versionsMap := ws.DeploymentVersions().Items()
	versionsList := make([]*oapi.DeploymentVersion, 0)
	for _, version := range versionsMap {
		if version.DeploymentId == deploymentId {
			versionsList = append(versionsList, version)
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"versions": versionsList,
	})
}

func (s *Deployments) GetDeploymentVersion(c *gin.Context, workspaceId string, deploymentId string, versionId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	_, ok := ws.Deployments().Get(deploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	version, ok := ws.DeploymentVersions().Get(versionId)
	if !ok || version.DeploymentId != deploymentId {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment version not found",
		})
		return
	}

	c.JSON(http.StatusOK, version)
}

func (s *Deployments) ListDeploymentVariables(c *gin.Context, workspaceId string, deploymentId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	_, ok := ws.Deployments().Get(deploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	variablesMap := ws.Deployments().Variables(deploymentId)
	variablesList := make([]*oapi.DeploymentVariable, 0, len(variablesMap))
	for _, variable := range variablesMap {
		variablesList = append(variablesList, variable)
	}
	c.JSON(http.StatusOK, gin.H{
		"variables": variablesList,
	})
}
