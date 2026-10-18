import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import type { Env } from "../../types/env";
export const database = (env: Env) => drizzle(env.DB, { schema });
