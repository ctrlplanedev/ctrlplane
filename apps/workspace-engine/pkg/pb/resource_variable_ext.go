package pb

func (rv *ResourceVariable) ID() string {
	return rv.ResourceId + "-" + rv.Key
}
