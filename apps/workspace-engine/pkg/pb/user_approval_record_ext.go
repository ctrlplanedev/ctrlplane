package pb

func (x *UserApprovalRecord) Key() string {
	return x.VersionId + x.UserId
}