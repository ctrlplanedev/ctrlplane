package oapi

import "fmt"

type TemplatableRelease struct {
	Release
	Variables map[string]string
}

func (r *Release) ToTemplatable() (*TemplatableRelease, error) {
	variables := make(map[string]string)
	for key, literalValue := range r.Variables {
		value, err := literalValue.AsStringValue()
		if err != nil {
			return nil, fmt.Errorf("failed to get as string value: %w", err)
		}
		variables[key] = value
	}

	return &TemplatableRelease{
		Release:   *r,
		Variables: variables,
	}, nil
}

type TemplatableJobWithRelease struct {
	JobWithRelease
	Release *TemplatableRelease
}

func (j *JobWithRelease) ToTemplatable() (*TemplatableJobWithRelease,
	error) {
	release, err := j.Release.ToTemplatable()
	if err != nil {
		return nil, fmt.Errorf("failed to get templatable release: %w", err)
	}
	return &TemplatableJobWithRelease{
		JobWithRelease: *j,
		Release:        release,
	}, nil
}
