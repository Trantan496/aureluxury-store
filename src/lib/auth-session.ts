import "server-only";
import { headers } from "next/headers";
import { getAuth } from "./auth";
import { resolveAuthSession } from "../features/auth/session";

export async function resolveProductSession() {
  return resolveAuthSession(await getAuth(), await headers());
}
