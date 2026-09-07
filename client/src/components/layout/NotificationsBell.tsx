import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationsBell() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const list = trpc.platform.notifications.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
  const markRead = trpc.platform.markNotificationRead.useMutation({ onSuccess: () => list.refetch() });

  if (!isAuthenticated) return null;
  const items = list.data ?? [];
  const unread = items.filter(n => !n.readAt).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-[color:var(--border)]"
        aria-label={t("notif.label", "Notifications")}
      >
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[16px] rounded-full bg-[color:var(--destructive)] px-1 text-[0.62rem] font-bold leading-4 text-white">
            {unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t("notif.label", "Notifications")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted-foreground">{t("notif.empty", "No notifications.")}</div>
        )}
        <ul className="max-h-80 overflow-y-auto">
          {items.slice(0, 15).map(n => (
            <li key={n.id}>
              <button
                className={`w-full border-b border-[color:var(--border)] px-3 py-2 text-left text-sm last:border-0 ${n.readAt ? "opacity-60" : "font-medium"}`}
                onClick={() => !n.readAt && markRead.mutate({ id: n.id })}
              >
                {n.title}
                {n.body && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{n.body}</span>}
                <span className="mt-0.5 block text-[0.68rem] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
