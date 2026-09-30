export interface MonthlyUpdate {
  id: string;
  officeId: string;
  planId: string | null;
  content: string;
  status: "ON_TIME" | "LATE" | "MISSING";
  submittedAt: string | null;
  createdAt: string;
  monthStartDate: string;
  monthEndDate: string;
  office?: { id: string; name: string; code: string };
  plan?: { id: string; title: string } | null;
  submittedBy?: { id: string; name: string; role: string };
}

export interface CreateMonthlyUpdateInput {
  officeId: string;
  planId?: string | null;
  monthStartDate: string;
  monthEndDate: string;
  content: string;
}
