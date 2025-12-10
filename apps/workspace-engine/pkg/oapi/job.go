package oapi

import (
	"encoding/json"
	"fmt"
)

// String converts a LiteralValue to its string representation,
// handling strings, numbers, booleans, and other JSON types.
func (lv LiteralValue) String() string {
	var value any
	if err := json.Unmarshal(lv.union, &value); err != nil {
		return ""
	}
	return toString(value)
}

type TemplatableRelease struct {
	Release
	Variables map[string]string
}

func (r *Release) ToTemplatable() (*TemplatableRelease, error) {
	variables := make(map[string]string)
	for key, literalValue := range r.Variables {
		variables[key] = literalValue.String()
	}

	return &TemplatableRelease{
		Release:   *r,
		Variables: variables,
	}, nil
}

type TemplatableJob struct {
	JobWithRelease
	Release *TemplatableRelease
}

func (j *JobWithRelease) ToTemplatable() (*TemplatableJob,
	error) {
	release, err := j.Release.ToTemplatable()
	if err != nil {
		return nil, fmt.Errorf("failed to get templatable release: %w", err)
	}
	return &TemplatableJob{
		JobWithRelease: *j,
		Release:        release,
	}, nil
}
