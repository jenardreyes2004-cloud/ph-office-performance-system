import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { CreateOfficeInput, Office, OfficeNode } from "@/features/offices/types";

const OFFICES_KEY = ["offices"] as const;
const OFFICE_TREE_KEY = ["offices", "tree"] as const;

export function useOffices() {
  return useQuery({
    queryKey: OFFICES_KEY,
    queryFn: async () => {
      const res = await api.get<Office[]>("/offices");
      return res.data;
    },
  });
}

/** The full hierarchy, for the org-chart view. */
export function useOfficeTree() {
  return useQuery({
    queryKey: OFFICE_TREE_KEY,
    queryFn: async () => {
      const res = await api.get<OfficeNode[]>("/offices/tree");
      return res.data;
    },
  });
}

export function useCreateOffice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOfficeInput) => {
      const res = await api.post<Office>("/offices", input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFICES_KEY });
    },
  });
}

export function useArchiveOffice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Office>(`/offices/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFICES_KEY });
      queryClient.invalidateQueries({ queryKey: OFFICE_TREE_KEY });
    },
  });
}
