import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AccessLevel, UserRole } from "@/types";

export interface Account {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  level: AccessLevel;
  isSuperAdmin: boolean;
  headedOfficeName: string | null;
  officeName: string | null;
  createdAt: string;
}

export interface CreateAccountInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

const KEY = ["accounts"] as const;

export function useAccounts(includeInactive = true) {
  return useQuery({
    queryKey: [...KEY, { includeInactive }],
    queryFn: async () => {
      const res = await api.get<Account[]>("/accounts", {
        params: { includeInactive },
      });
      return res.data;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      const res = await api.post<Account>("/accounts", input);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** Name, email and password. Authority is changed through its own endpoint. */
export function useUpdateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & Partial<Omit<CreateAccountInput, "role">>) => {
      const res = await api.patch<Account>(`/accounts/${id}`, input);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useChangeRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const res = await api.patch<Account>(`/accounts/${id}/role`, { role });
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/**
 * Disabling is its own mutation so the button reads as "disable this login"
 * rather than a generic edit -- and so the server's LAST_SUPER_ADMIN refusal
 * lands on the action the user actually chose.
 */
export function useSetActive() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const path = isActive ? "reactivate" : "deactivate";
      const res = await api.post<Account>(`/accounts/${id}/${path}`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/**
 * Pulls the server's refusal out of an axios error.
 *
 * The guard returns a specific reason per rule -- "you cannot edit your own
 * account" versus "that is the last hierarchy head" -- and showing it verbatim
 * is the difference between a user who understands the system and one who
 * thinks the app is broken.
 */
export function refusalMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return error instanceof Error ? error.message : null;
}