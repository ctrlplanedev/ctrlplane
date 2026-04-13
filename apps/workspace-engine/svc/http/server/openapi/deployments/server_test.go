package deployments

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type mockGetter struct {
	deployments []db.Deployment
	systems     map[uuid.UUID][]db.System
}

func (m *mockGetter) GetAllDeploymentsByWorkspaceID(
	_ context.Context,
	_ uuid.UUID,
) ([]db.Deployment, error) {
	return m.deployments, nil
}

func (m *mockGetter) GetSystemsByDeploymentIDs(
	_ context.Context,
	_ []uuid.UUID,
) (map[uuid.UUID][]db.System, error) {
	if m.systems == nil {
		return make(map[uuid.UUID][]db.System), nil
	}
	return m.systems, nil
}

func setupRouter(d *Deployments) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/v1/workspaces/:workspaceId/deployments", func(c *gin.Context) {
		workspaceId := c.Param("workspaceId")
		var params oapi.ListDeploymentsParams
		if v := c.Query("limit"); v != "" {
			if i, err := strconv.Atoi(v); err == nil {
				params.Limit = &i
			}
		}
		if v := c.Query("offset"); v != "" {
			if i, err := strconv.Atoi(v); err == nil {
				params.Offset = &i
			}
		}
		if v := c.Query("cel"); v != "" {
			params.Cel = &v
		}
		d.ListDeployments(c, workspaceId, params)
	})
	return r
}

func TestListDeployments_NegativeOffset(t *testing.T) {
	d := &Deployments{getter: &mockGetter{}}
	r := setupRouter(d)

	wsID := uuid.New().String()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/workspaces/"+wsID+"/deployments?offset=-1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListDeployments_ZeroLimit(t *testing.T) {
	d := &Deployments{getter: &mockGetter{}}
	r := setupRouter(d)

	wsID := uuid.New().String()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/workspaces/"+wsID+"/deployments?limit=0", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListDeployments_LimitTooLarge(t *testing.T) {
	d := &Deployments{getter: &mockGetter{}}
	r := setupRouter(d)

	wsID := uuid.New().String()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/workspaces/"+wsID+"/deployments?limit=1001", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListDeployments_ValidPagination(t *testing.T) {
	depID := uuid.New()
	d := &Deployments{getter: &mockGetter{
		deployments: []db.Deployment{
			{ID: depID, WorkspaceID: uuid.New(), Name: "test-dep", Metadata: map[string]string{}},
		},
	}}
	r := setupRouter(d)

	wsID := uuid.New().String()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(
		http.MethodGet, "/v1/workspaces/"+wsID+"/deployments?limit=10&offset=0", nil,
	)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.InDelta(t, 1, body["total"], 0)
	items := body["items"].([]any)
	assert.Len(t, items, 1)
}

func TestListDeployments_OffsetBeyondTotal(t *testing.T) {
	depID := uuid.New()
	d := &Deployments{getter: &mockGetter{
		deployments: []db.Deployment{
			{ID: depID, WorkspaceID: uuid.New(), Name: "test-dep", Metadata: map[string]string{}},
		},
	}}
	r := setupRouter(d)

	wsID := uuid.New().String()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(
		http.MethodGet, "/v1/workspaces/"+wsID+"/deployments?limit=10&offset=100", nil,
	)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.InDelta(t, 1, body["total"], 0)
	items := body["items"].([]any)
	assert.Empty(t, items)
}
