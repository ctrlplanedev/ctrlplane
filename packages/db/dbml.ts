import { pgGenerate } from "drizzle-dbml-generator";

import * as schema from "./src/schema/index.js";

const out = "./schema.dbml";
const relational = false;

pgGenerate({ schema, out, relational });
