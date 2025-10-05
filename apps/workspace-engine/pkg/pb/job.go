package pb

import "time"

func (j *Job) CreatedAtTime() (time.Time, error) {
	return time.Parse(time.RFC3339, j.CreatedAt)
}

func (j *Job) UpdatedAtTime() (time.Time, error) {
	return time.Parse(time.RFC3339, j.UpdatedAt)
}

func (j *Job) StartedAtTime() (*time.Time, error) {
	if j.StartedAt == nil {
		return nil, nil
	}
	if j.StartedAt == nil {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, *j.StartedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (j *Job) CompletedAtTime() (*time.Time, error) {
	if j.CompletedAt == nil {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, *j.CompletedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}
