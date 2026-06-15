import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';

export type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  createdAt?: string;
  /** Supabase row: null read_at → unread. Session items omit → treated as unread. */
  isRead?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  /** Whole-row click (e.g. persistent notification: mark read + navigate). */
  onItemClick?: () => void | Promise<void>;
};

/** In-app bell payload (screens pass `items=`). */
export type AppNotificationItem = NotificationItem & {
  actions?: Array<{ label: string; onClick: () => void | Promise<void> }>;
};

type NotificationsBellProps = {
  notifications?: NotificationItem[];
  /** Alias for `notifications` (used by worker/firm screens). */
  items?: NotificationItem[];
  label?: string;
  /** Non-alarming status when the bell list is partial or unavailable (beta). */
  panelNotice?: string;
};

type PanelPos = { top: number; left: number; width: number };

export function NotificationsBell({
  notifications: notificationsProp,
  items,
  label = 'Notifications',
  panelNotice,
}: NotificationsBellProps) {
  const notifications = items ?? notificationsProp ?? [];
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications.filter((n) => n.isRead !== true).length;

  const updatePanelPos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(320, Math.max(240, window.innerWidth - margin * 2));
    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    let top = rect.bottom + 8;
    const spaceBelow = window.innerHeight - top - margin;
    const desiredMin = 160;
    if (spaceBelow < desiredMin && rect.top > margin + desiredMin) {
      top = Math.max(margin, rect.top - Math.min(384, window.innerHeight * 0.55) - 8);
    }
    setPanelPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
    const onWin = () => updatePanelPos();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, updatePanelPos]);

  const portal =
    typeof document !== 'undefined' && open && panelPos
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-[199] cursor-default bg-transparent"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'fixed',
                top: panelPos.top,
                left: panelPos.left,
                width: panelPos.width,
                zIndex: 200,
              }}
              className="max-h-[min(24rem,calc(100dvh-7rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0 flex-1 pr-1">
                  <p className="break-words text-sm font-semibold text-slate-900">{label}</p>
                  <p className="mt-0.5 break-words text-xs text-slate-500">
                    Workflow updates and requests appear here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
                {panelNotice ? (
                  <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                    {panelNotice}
                  </p>
                ) : null}
                {notifications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-sm font-medium text-slate-700">Your notifications will appear here.</p>
                    <p className="mt-1 text-xs text-slate-500">
                      You’ll see workflow updates, document requests, and firm activity in this panel.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => {
                      const app = notification as AppNotificationItem;
                      const read = notification.isRead === true;
                      const rowClickable = Boolean(
                        notification.onItemClick || (app.actions && app.actions.length > 0)
                      );
                      const cardClass = read
                        ? 'min-w-0 rounded-xl border border-slate-100 bg-white p-3'
                        : 'min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3';
                      const titleClass = read
                        ? 'break-words text-sm font-medium text-slate-500'
                        : 'break-words text-sm font-semibold text-slate-900';
                      const bodyClass = read
                        ? 'mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-slate-400 [overflow-wrap:anywhere]'
                        : 'mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-slate-600 [overflow-wrap:anywhere]';

                      const handleRowClick = async () => {
                        if (notification.onItemClick) {
                          await notification.onItemClick();
                        }
                        setOpen(false);
                      };

                      const hasNestedButtons = Boolean(
                        (notification.actionLabel && notification.onAction) ||
                          (app.actions && app.actions.length > 0)
                      );

                      const inner = (
                        <>
                          <div className="min-w-0 w-full">
                            <p className={titleClass}>{notification.title}</p>
                            {notification.body && <p className={bodyClass}>{notification.body}</p>}
                            {notification.createdAt && (
                              <p className="mt-2 text-[11px] text-slate-400">{notification.createdAt}</p>
                            )}
                          </div>

                          {notification.actionLabel && notification.onAction && !(app.actions && app.actions.length) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                notification.onAction?.();
                              }}
                              className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                              {notification.actionLabel}
                            </button>
                          ) : null}

                          {app.actions && app.actions.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {app.actions.map((a, idx) => (
                                <button
                                  key={`${notification.id}-a-${idx}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void a.onClick();
                                  }}
                                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                                >
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </>
                      );

                      if (rowClickable && hasNestedButtons) {
                        return (
                          <div
                            key={notification.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => void handleRowClick()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void handleRowClick();
                              }
                            }}
                            className={`${cardClass} w-full cursor-pointer text-left transition hover:border-slate-300 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1`}
                          >
                            {inner}
                          </div>
                        );
                      }

                      if (rowClickable) {
                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => void handleRowClick()}
                            className={`${cardClass} w-full cursor-pointer text-left transition hover:border-slate-300 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1`}
                          >
                            {inner}
                          </button>
                        );
                      }

                      return (
                        <div key={notification.id} className={cardClass}>
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {portal}
    </div>
  );
}

export default NotificationsBell;
