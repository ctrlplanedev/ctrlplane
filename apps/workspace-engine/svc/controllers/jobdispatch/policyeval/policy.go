package policyeval

// func jobRuleEvaluators(ctx context.Context, getter Getter, rule *oapi.PolicyRule) []evaluator.JobEvaluator {
// 	return evaluator.CollectEvaluators(
// 		versionselector.NewEvaluator(rule),
// 		approval.NewEvaluator(&approvalAdapter{getter: getter, ctx: ctx}, rule),
// 		deploymentwindow.NewEvaluator(&deploymentWindowAdapter{getter: getter, ctx: ctx}, rule),
// 	)
// }
