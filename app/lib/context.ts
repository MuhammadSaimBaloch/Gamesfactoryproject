import { createContext } from "react-router";
import type { Env } from "../types/env";
export const environmentContext = createContext<Env>();
export const nonceContext = createContext<string>();
