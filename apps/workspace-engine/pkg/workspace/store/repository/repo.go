package repository

import (
	"encoding/gob"
	"encoding/json"
	"os"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
)

func EncodeGob(r *Repository) ([]byte, error) {
	var buf []byte
	writer := NewBufferWriter(&buf)
	encoder := gob.NewEncoder(writer)
	err := encoder.Encode(r)
	if err != nil {
		return nil, err
	}
	return buf, nil
}

// WriteToJSONFile writes the Repository data to a JSON file at the specified path.
func WriteToJSONFile(r *Repository, filePath string) error {
	// Marshal the repository struct into JSON.
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return err
	}

	// Create or truncate the file.
	f, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := f.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}()

	// Write JSON data to file.
	_, err = f.Write(data)
	return err
}

// BufferWriter implements io.Writer for a byte slice pointer
type BufferWriter struct {
	buf *[]byte
}

func NewBufferWriter(b *[]byte) *BufferWriter {
	return &BufferWriter{buf: b}
}

func (w *BufferWriter) Write(p []byte) (int, error) {
	*w.buf = append(*w.buf, p...)
	return len(p), nil
}

func New() *Repository {
	return &Repository{
		Resources:           cmap.New[*oapi.Resource](),
		ResourceProviders:   cmap.New[*oapi.ResourceProvider](),
		ResourceVariables:   cmap.New[*oapi.ResourceVariable](),
		Deployments:         cmap.New[*oapi.Deployment](),
		DeploymentVersions:  cmap.New[*oapi.DeploymentVersion](),
		DeploymentVariables: cmap.New[*oapi.DeploymentVariable](),
		Environments:        cmap.New[*oapi.Environment](),
		Policies:            cmap.New[*oapi.Policy](),
		Systems:             cmap.New[*oapi.System](),
		Releases:            cmap.New[*oapi.Release](),
		Jobs:                cmap.New[*oapi.Job](),
		JobAgents:           cmap.New[*oapi.JobAgent](),
		UserApprovalRecords: cmap.New[*oapi.UserApprovalRecord](),
		RelationshipRules:   cmap.New[*oapi.RelationshipRule](),
	}
}

type Repository struct {
	Resources         cmap.ConcurrentMap[string, *oapi.Resource]
	ResourceVariables cmap.ConcurrentMap[string, *oapi.ResourceVariable]
	ResourceProviders cmap.ConcurrentMap[string, *oapi.ResourceProvider]

	Deployments         cmap.ConcurrentMap[string, *oapi.Deployment]
	DeploymentVariables cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
	DeploymentVersions  cmap.ConcurrentMap[string, *oapi.DeploymentVersion]

	Environments cmap.ConcurrentMap[string, *oapi.Environment]
	Policies     cmap.ConcurrentMap[string, *oapi.Policy]
	Systems      cmap.ConcurrentMap[string, *oapi.System]
	Releases     cmap.ConcurrentMap[string, *oapi.Release]

	Jobs      cmap.ConcurrentMap[string, *oapi.Job]
	JobAgents cmap.ConcurrentMap[string, *oapi.JobAgent]

	UserApprovalRecords cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
	RelationshipRules   cmap.ConcurrentMap[string, *oapi.RelationshipRule]
}
