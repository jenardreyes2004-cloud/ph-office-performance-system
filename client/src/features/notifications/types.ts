export interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedOfficeId: string | null;
  relatedPlanId: string | null;
  relatedReportId: string | null;
  sender?: { id: string; name: string; role: string } | null;
}

export interface CreateNotificationInput {
  recipientId: string;
  type: string;
  message: string;
  relatedOfficeId?: string | null;
  relatedPlanId?: string | null;
}

export interface SendableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}
