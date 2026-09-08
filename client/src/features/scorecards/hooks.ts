import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  CreateScorecardPeriodInput,
  OfficeForPeriod,
  OfficeScorecard,
  ScorecardPeriod,
  SubmitScorecardResultInput,
  UpdateOfficeScorecardInput,
} from "@/features/scorecards/types";

const PERIODS_KEY = ["scorecard-periods"] as const;
const OFFICES_FOR_PERIOD_KEY = (periodId: string) =>
  ["scorecard-periods", periodId, "offices"] as const;
const OFFICE_SCORECARD_KEY = (id: string) => ["office-scorecards", id] as const;

export function useScorecardPeriods() {
  return useQuery({
    queryKey: PERIODS_KEY,
    queryFn: async () => {
      const res = await api.get<ScorecardPeriod[]>("/scorecards/periods");
      return res.data;
    },
  });
}

export function useCreateScorecardPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScorecardPeriodInput) => {
      const res = await api.post<ScorecardPeriod>("/scorecards/periods", input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERIODS_KEY });
    },
  });
}

export function useOfficesForPeriod(periodId: string | undefined) {
  return useQuery({
    queryKey: OFFICES_FOR_PERIOD_KEY(periodId ?? ""),
    queryFn: async () => {
      const res = await api.get<OfficeForPeriod[]>(
        `/scorecards/periods/${periodId}/offices`,
      );
      return res.data;
    },
    enabled: !!periodId,
  });
}

export function useStartOfficeScorecard(periodId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (officeId: string) => {
      const res = await api.post<OfficeScorecard>(
        `/scorecards/periods/${periodId}/offices/${officeId}`,
        {},
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFICES_FOR_PERIOD_KEY(periodId) });
    },
  });
}

export function useOfficeScorecard(id: string | undefined) {
  return useQuery({
    queryKey: OFFICE_SCORECARD_KEY(id ?? ""),
    queryFn: async () => {
      const res = await api.get<OfficeScorecard>(`/scorecards/office-scorecards/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateOfficeScorecard(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOfficeScorecardInput) => {
      const res = await api.patch<OfficeScorecard>(
        `/scorecards/office-scorecards/${id}`,
        input,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFICE_SCORECARD_KEY(id) });
    },
  });
}

export function useFinalizeOfficeScorecard(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<OfficeScorecard>(
        `/scorecards/office-scorecards/${id}/finalize`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFICE_SCORECARD_KEY(id) });
    },
  });
}

export function useSubmitScorecardResult(officeScorecardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      input,
    }: {
      entryId: string;
      input: SubmitScorecardResultInput;
    }) => {
      const res = await api.put(`/scorecards/entries/${entryId}/result`, input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFICE_SCORECARD_KEY(officeScorecardId) });
    },
  });
}
