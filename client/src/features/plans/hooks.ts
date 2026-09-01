import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  AddPlanOfficeInput,
  AssignEmployeeInput,
  CreatePlanInput,
  Plan,
  PlanAssignment,
  PlanDetail,
  PlanOffice,
  UpdateAssignmentInput,
  UpdatePlanInput,
} from "@/features/plans/types";

const PLANS_KEY = ["plans"] as const;
const planKey = (id: string) => ["plans", id] as const;

export function usePlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: async () => {
      const res = await api.get<Plan[]>("/plans");
      return res.data;
    },
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: id ? planKey(id) : PLANS_KEY,
    queryFn: async () => {
      const res = await api.get<PlanDetail>(`/plans/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const res = await api.post<Plan>("/plans", input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}

export function useUpdatePlan(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePlanInput) => {
      const res = await api.patch<Plan>(`/plans/${id}`, input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: planKey(id) });
    },
  });
}

export function useArchivePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Plan>(`/plans/${id}/archive`);
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      queryClient.invalidateQueries({ queryKey: planKey(id) });
    },
  });
}

export function useAddPlanOffice(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddPlanOfficeInput) => {
      const res = await api.post<PlanOffice>(`/plans/${planId}/offices`, input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKey(planId) });
    },
  });
}

export function useRemovePlanOffice(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (officeId: string) => {
      await api.delete(`/plans/${planId}/offices/${officeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKey(planId) });
    },
  });
}

export function useAssignEmployee(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignEmployeeInput) => {
      const res = await api.post<PlanAssignment>(`/plans/${planId}/assignments`, input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKey(planId) });
    },
  });
}

export function useUpdateAssignment(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      ...input
    }: UpdateAssignmentInput & { employeeId: string }) => {
      const res = await api.patch<PlanAssignment>(
        `/plans/${planId}/assignments/${employeeId}`,
        input,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKey(planId) });
    },
  });
}

export function useRemoveAssignment(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      await api.delete(`/plans/${planId}/assignments/${employeeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKey(planId) });
    },
  });
}
