package workflowmanager

import (
	"fmt"
	"workspace-engine/pkg/oapi"
)

type MatrixResolver struct {
	matrix *oapi.WorkflowJobMatrix
	inputs map[string]any
}

type matrixRow struct {
	Key    string
	Values []map[string]interface{}
}

func NewMatrixResolver(matrix *oapi.WorkflowJobMatrix, inputs map[string]any) *MatrixResolver {
	return &MatrixResolver{
		matrix: matrix,
		inputs: inputs,
	}
}

func (r *MatrixResolver) getMatrixRows() ([]matrixRow, error) {
	matrixRows := make([]matrixRow, 0, len(*r.matrix))
	for key, value := range *r.matrix {
		asArray, err := value.AsWorkflowJobMatrix0()
		if err == nil {
			matrixRows = append(matrixRows, matrixRow{
				Key:    key,
				Values: asArray,
			})
			continue
		}
		asString, err := value.AsWorkflowJobMatrix1()
		if err == nil {
			arrayFromInput, ok := r.inputs[asString].([]map[string]interface{})
			if !ok {
				return nil, fmt.Errorf("input %s is not an array", asString)
			}
			matrixRows = append(matrixRows, matrixRow{
				Key:    key,
				Values: arrayFromInput,
			})
			continue
		}
	}
	return matrixRows, nil
}

func (r *MatrixResolver) computeCartesianProduct(matrixRows []matrixRow) []map[string]interface{} {
	totalSize := 1
	for _, row := range matrixRows {
		totalSize *= len(row.Values)
	}

	result := make([]map[string]interface{}, 0, totalSize)
	result = append(result, map[string]interface{}{})

	for _, row := range matrixRows {
		newResult := make([]map[string]interface{}, 0, totalSize)
		for _, existing := range result {
			for _, value := range row.Values {
				combined := make(map[string]interface{}, len(existing)+len(value))
				for k, v := range existing {
					combined[k] = v
				}
				for k, v := range value {
					combined[k] = v
				}
				newResult = append(newResult, combined)
			}
		}
		result = newResult
	}

	return result
}

func (r *MatrixResolver) Resolve() ([]map[string]interface{}, error) {
	matrixRows, err := r.getMatrixRows()
	if err != nil {
		return nil, fmt.Errorf("failed to get matrix rows: %w", err)
	}

	product := r.computeCartesianProduct(matrixRows)
	return product, nil
}
