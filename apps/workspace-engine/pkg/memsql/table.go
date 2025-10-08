package memsql

// TableBuilder helps build a SQLite table definition string using options and examples.
type TableBuilder struct {
	tableName   string
	columns     []string
	primaryKeys []string
	indices     []string
}

// NewTableBuilder creates a new TableBuilder for the given table name.
func NewTableBuilder(tableName string) *TableBuilder {
	return &TableBuilder{
		tableName: tableName,
	}
}

// WithColumn adds a column definition (e.g., "id TEXT NOT NULL") to the table.
func (tb *TableBuilder) WithColumn(property string, typeName string) *TableBuilder {
	tb.columns = append(tb.columns, property+" "+typeName)
	return tb
}

// WithPrimaryKey sets the primary key columns.
func (tb *TableBuilder) WithPrimaryKey(keys ...string) *TableBuilder {
	tb.primaryKeys = append(tb.primaryKeys, keys...)
	return tb
}

// WithIndex adds an index definition (e.g., "CREATE INDEX ...") to be created after the table.
func (tb *TableBuilder) WithIndex(indexDef string) *TableBuilder {
	tb.indices = append(tb.indices, indexDef)
	return tb
}

// Build returns the CREATE TABLE statement and any index statements as a single SQL string.
func (tb *TableBuilder) Build() string {
	var stmts []string
	cols := append([]string{}, tb.columns...)
	if len(tb.primaryKeys) > 0 {
		cols = append(cols, "PRIMARY KEY ("+joinComma(tb.primaryKeys)+")")
	}
	createTable := "CREATE TABLE " + tb.tableName + " (" + joinComma(cols) + ")"
	stmts = append(stmts, createTable)
	stmts = append(stmts, tb.indices...)
	return joinStatements(stmts)
}

// joinComma joins a slice of strings with commas.
func joinComma(items []string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += ", "
		}
		result += item
	}
	return result
}

// joinStatements joins SQL statements with semicolons and a newline.
func joinStatements(stmts []string) string {
	result := ""
	for i, stmt := range stmts {
		if i > 0 {
			result += ";\n"
		}
		result += stmt
	}
	if len(stmts) > 0 {
		result += ";"
	}
	return result
}
