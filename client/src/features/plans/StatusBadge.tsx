import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { AssignmentStatus, PlanStatus } from "@/types";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const PLAN_STATUS_VARIANT: Record<PlanStatus, BadgeVariant> = {
  DRAFT: "outline",
  ACTIVE: "success",
  ONGOING: "default",
  COMPLETED: "secondary",
  DELAYED: "warning",
  ARCHIVED: "outline",
};

const ASSIGNMENT_STATUS_VARIANT: Record<AssignmentStatus, BadgeVariant> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  DELAYED: "warning",
  CANCELLED: "destructive",
};

function toLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return <Badge variant={PLAN_STATUS_VARIANT[status]}>{toLabel(status)}</Badge>;
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge variant={ASSIGNMENT_STATUS_VARIANT[status]}>{toLabel(status)}</Badge>;
}
