package variable

type DirectResourceVariable struct {
	ID         string `json:"id"`
	ResourceID string `json:"resourceId"`
	Key        string `json:"key"`
	Value      any    `json:"value"`
	Sensitive  bool   `json:"sensitive"`
}

func (v *DirectResourceVariable) GetID() string {
	return v.ID
}

func (v *DirectResourceVariable) GetResourceID() string {
	return v.ResourceID
}

func (v *DirectResourceVariable) GetKey() string {
	return v.Key
}

func (v *DirectResourceVariable) GetValue() any {
	return v.Value
}

func (v *DirectResourceVariable) IsSensitive() bool {
	return v.Sensitive
}
