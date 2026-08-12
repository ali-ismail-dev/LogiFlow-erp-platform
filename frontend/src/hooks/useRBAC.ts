"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient, resolveTenantSlug } from "@/lib/api/apiClient";

export type UserRole = "super_admin" | "dispatcher" | "warehouse_manager" | "driver";

export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  tenant_id: number | string;
  role: UserRole;
}

export type RBACAction = "create_dispatch" | "view_ledgers" | "invite_users";

export const ROLE_ACTION_MATRIX: Record<RBACAction, ReadonlySet<UserRole>> = {
  create_dispatch: new Set<UserRole>(["super_admin", "dispatcher"]),
  view_ledgers: new Set<UserRole>(["super_admin", "warehouse_manager"]),
  invite_users: new Set<UserRole>(["super_admin"]),
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  dispatcher: "Dispatcher",
  warehouse_manager: "Warehouse Manager",
  driver: "Driver",
};

interface MeEnvelope {
  data: AuthUser;
}

interface UseRBACOptions {
  user?: AuthUser | null;
  skipFetch?: boolean;
}

interface UseRBACResult {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  isDispatcher: boolean;
  isWarehouseManager: boolean;
  isDriver: boolean;
  can: (action: RBACAction) => boolean;
}

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  if (lower === "super_admin" || lower === "dispatcher" || lower === "warehouse_manager" || lower === "driver") {
    return lower as UserRole;
  }
  return null;
}

export function useRBAC(options: UseRBACOptions = {}): UseRBACResult {
  const { user: injectedUser, skipFetch = false } = options;

  const [fetchedUser, setFetchedUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(!skipFetch && !injectedUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (injectedUser || skipFetch) {
      setFetchedUser(injectedUser ?? null);
      setLoading(false);
      return;
    }

    let active = true;

    async function fetchIdentity() {
      setLoading(true);
      setError(null);
      try {
        const currentHostname = window.location.hostname;
        const currentProtocol = window.location.protocol;
        // Standardize standard HTTP data requests to target the tenant-aware backend host
        // so the browser can present the same session cookie that was created on
        // the tenant subdomain at port 8000.
        const backendBaseUrl = `${currentProtocol}//${currentHostname}:8000/api/v1`;
        const client = createApiClient({ baseUrl: backendBaseUrl });

        const activeTenantSlug = resolveTenantSlug(currentHostname);

        const response = await client.get<MeEnvelope>("/auth/me", {
          headers: {
            ...(activeTenantSlug ? { "X-Tenant-ID": activeTenantSlug } : {}),
          },
        });
        
        if (response.status === 200 && response.data?.data && active) {
          setFetchedUser(response.data.data);
        } else if (active) {
          throw new Error("Session context could not be verified.");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load user profile.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchIdentity();

    return () => {
      active = false;
    };
  }, [injectedUser, skipFetch]);

  const user = injectedUser ?? fetchedUser;

  const role = useMemo(() => {
    return user ? normalizeRole(user.role) : null;
  }, [user]);

  const can = useCallback((action: RBACAction): boolean => {
    if (!role) return false;
    const rules = ROLE_ACTION_MATRIX[action];
    return rules ? rules.has(role) : false;
  }, [role]);

  return {
    user,
    role,
    loading,
    error,
    isSuperAdmin: role === "super_admin",
    isDispatcher: role === "dispatcher",
    isWarehouseManager: role === "warehouse_manager",
    isDriver: role === "driver",
    can,
  };
}