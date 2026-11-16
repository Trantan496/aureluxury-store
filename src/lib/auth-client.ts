"use client";
import { createAuthClient } from "better-auth/react";

// Relative, same-origin Better Auth endpoints. No server configuration/secrets.
export const authClient = createAuthClient();
