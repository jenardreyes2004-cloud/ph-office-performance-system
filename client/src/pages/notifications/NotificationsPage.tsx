import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermission } from "@/features/auth/usePermission";
import { SendNotificationDialog } from "@/features/notifications/SendNotificationDialog";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks";

function typeLabel(type: string) {
  return type.replace(/_/g, " ").toLowerCase();
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsPage() {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const { data: all, isLoading, isError } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { can } = usePermission();

  // The API only ever returns the caller's own notifications, so there is
  // nothing here to filter by owner.
  const notifications = (all ?? []).filter((n) => (showUnreadOnly ? !n.isRead : true));
  const unread = (all ?? []).filter((n) => !n.isRead).length;
  const canSend = can("notifications.send");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0
              ? `${unread} unread.`
              : "You are all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
          {canSend && <SendNotificationDialog />}
        </div>
      </div>

      {unread > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setShowUnreadOnly((v) => !v)}
        >
          {showUnreadOnly ? "Show all" : "Show unread only"}
        </Button>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading notifications…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load notifications. Is the backend running?
            </p>
          )}
          {all && notifications.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {showUnreadOnly ? "Nothing unread." : "No notifications yet."}
            </p>
          )}

          <ul className="flex flex-col gap-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={
                  n.isRead
                    ? "rounded-md border border-border/50 p-3"
                    : "rounded-md border border-primary/40 bg-primary/5 p-3"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {typeLabel(n.type)}
                      </Badge>
                      {!n.isRead && <Badge className="text-[10px]">New</Badge>}
                    </div>
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {when(n.createdAt)}
                      {n.sender ? ` · from ${n.sender.name}` : ""}
                    </p>
                  </div>
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
