'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { dateTime } from '@/lib/format';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

function getNotificationHref(type: string) {
  switch (type) {
    case 'LOW_STOCK':
      return '/inventory';
    case 'DAILY_SUMMARY':
      return '/dashboard';
    default:
      return '/activity';
  }
}

export default function NotificationsBell({
  initialNotifications
}: {
  initialNotifications: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  async function markAsRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification
      )
    );

    await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH'
    }).catch(() => undefined);
  }

  async function markAllAsRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));

    await fetch('/api/notifications', {
      method: 'PATCH'
    }).catch(() => undefined);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-white/80 bg-white/88 px-4 text-sm font-semibold text-stone-700 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-200 hover:text-stone-950"
        aria-label="Open notifications"
      >
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M6 9a6 6 0 1 1 12 0v4l1.5 2.5H4.5L6 13z" />
            <path d="M10 19a2 2 0 0 0 4 0" />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </span>
        <span>Notifications</span>
        <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
          {unreadCount} unread
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-3 w-[min(92vw,26rem)] rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))] p-4 shadow-[0_40px_120px_-48px_rgba(28,25,23,0.55)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">Alerts</div>
              <h2 className="mt-2 text-xl font-black text-stone-950">Notifications center</h2>
              <p className="mt-1 text-sm text-stone-500">Low-stock and daily-summary alerts stay visible until you read them.</p>
            </div>
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
            >
              Mark all read
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {notifications.length ? (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={getNotificationHref(notification.type)}
                  onClick={() => {
                    void markAsRead(notification.id);
                    setOpen(false);
                  }}
                  className={`block rounded-[24px] border px-4 py-3 transition ${
                    notification.isRead
                      ? 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                      : 'border-amber-200 bg-amber-50/70 text-stone-700 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-stone-900">{notification.title}</div>
                      <div className="mt-1 text-sm text-stone-600">{notification.message}</div>
                      <div className="mt-2 text-xs text-stone-500">{dateTime(notification.createdAt)}</div>
                    </div>
                    {!notification.isRead ? (
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                No notifications yet. Low-stock and daily summary alerts will appear here automatically.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
