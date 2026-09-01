import { useParams } from "react-router-dom";

import { PlaceholderPage } from "@/components/PlaceholderPage";

export function PlanDetailPage() {
  const { id } = useParams();
  return (
    <PlaceholderPage
      title={`Plan ${id}`}
      description="Plan details, responsible offices, metrics, and assignments."
    />
  );
}
