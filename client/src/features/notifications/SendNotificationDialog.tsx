import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSendNotification, useSendableUsers } from "@/features/notifications/hooks";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types";

const TYPES = [
  "UPDATE_OVERDUE",
  "UPDATE_REMINDER_SENT",
  "REPORT_FLAGGED",
  "PLAN_ASSIGNED",
  "PERFORMANCE_RECORDED",
  "METRIC_UPDATED",
] as const;

export function SendNotificationDialog() {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [type, setType] = useState<string>(TYPES[0]);
  const [message, setMessage] = useState("");

  const { data: users } = useSendableUsers();
  const send = useSendNotification();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await send.mutateAsync({ recipientId, type, message });
      setMessage("");
      setRecipientId("");
      setOpen(false);
    } catch {
      // surfaced below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Send Notification</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a notification</DialogTitle>
          <DialogDescription>
            Delivered to the recipient&apos;s notification list. Use it to chase
            a missing monthly update or flag a scorecard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-recipient">Recipient</Label>
            <Select value={recipientId} onValueChange={setRecipientId} required>
              <SelectTrigger id="notif-recipient">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} — {ROLE_LABELS[u.role as UserRole] ?? u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="notif-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-message">Message</Label>
            <Textarea
              id="notif-message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What needs to happen, and by when."
            />
          </div>

          {send.isError && (
            <p className="text-sm text-destructive">
              {(send.error as { response?: { data?: { error?: string } } })
                ?.response?.data?.error ?? "Failed to send the notification."}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={send.isPending}>
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
