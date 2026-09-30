import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  CreateNotificationInput,
  Notification,
  SendableUser,
} from "@/features/notifications/types";

const NOTIFICATIONS_KEY = ["notifications"] as const;
const RECIPIENTS_KEY = ["notification-recipients"] as const;

/** Active accounts for the admin send form. 403 for everyone else. */
export function useSendableUsers() {
  return useQuery({
    queryKey: RECIPIENTS_KEY,
    queryFn: async () => {
      const res = await api.get<SendableUser[]>("/notifications/recipients");
      return res.data;
    },
  });
}

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, { unreadOnly }],
    queryFn: async () => {
      const res = await api.get<Notification[]>("/notifications");
      return res.data;
    },
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.isRead).length;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useSendNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNotificationInput) => {
      const res = await api.post<Notification>("/notifications", input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
