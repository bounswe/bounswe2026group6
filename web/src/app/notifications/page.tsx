"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { getAccessToken } from "@/lib/auth";
import {
    fetchNotificationPreferences,
    fetchNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    updateNotificationPreferences,
    type NotificationItem,
} from "@/lib/notifications";

export default function NotificationsPage() {
    const [token, setToken] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [items, setItems] = React.useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [nextCursor, setNextCursor] = React.useState<string | null>(null);
    const [pushEnabled, setPushEnabled] = React.useState(true);

    const refresh = React.useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const [notifications, preferences] = await Promise.all([
                fetchNotifications(token, { limit: 20 }),
                fetchNotificationPreferences(token),
            ]);

            setItems(notifications.items);
            setUnreadCount(notifications.unreadCount);
            setNextCursor(notifications.nextCursor);
            setPushEnabled(preferences.preferences.pushEnabled);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Failed to load notifications.");
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    React.useEffect(() => {
        const accessToken = getAccessToken();
        setToken(accessToken);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const loadMore = async () => {
        if (!token || !nextCursor) return;
        try {
            const nextPage = await fetchNotifications(token, { limit: 20, cursor: nextCursor });
            setItems((prev) => [...prev, ...nextPage.items]);
            setUnreadCount(nextPage.unreadCount);
            setNextCursor(nextPage.nextCursor);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Failed to load more.");
        }
    };

    return (
        <AppShell title="Notifications">
            <SectionCard>
                <SectionHeader
                    title="Your Notifications"
                    subtitle={token ? `Unread: ${unreadCount}` : "Log in to view your notifications."}
                />

                {!token ? (
                    <p className="text-muted">You need to log in first.</p>
                ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="btn btn-secondary" onClick={() => void refresh()} disabled={isLoading}>
                                Refresh
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={async () => {
                                    if (!token) return;
                                    await markAllNotificationsAsRead(token);
                                    await refresh();
                                }}
                                disabled={isLoading}
                            >
                                Mark All Read
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={async () => {
                                    if (!token) return;
                                    const next = !pushEnabled;
                                    await updateNotificationPreferences(token, next);
                                    setPushEnabled(next);
                                }}
                                disabled={isLoading}
                            >
                                Push: {pushEnabled ? "ON" : "OFF"}
                            </button>
                        </div>

                        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
                        {isLoading ? <p>Loading...</p> : null}

                        {items.length === 0 && !isLoading ? (
                            <p className="text-muted">No notifications yet.</p>
                        ) : (
                            <div style={{ display: "grid", gap: 10 }}>
                                {items.map((item) => (
                                    <article key={item.id} className="news-item-card">
                                        <div className="news-item-meta-row">
                                            <span className="news-item-category-chip">{item.type}</span>
                                            <span className="news-item-date">{item.createdAt}</span>
                                        </div>
                                        <h3 className="news-item-title">{item.title}</h3>
                                        <p className="news-item-summary">{item.body}</p>
                                        {!item.isRead ? (
                                            <button
                                                className="btn btn-secondary"
                                                onClick={async () => {
                                                    if (!token) return;
                                                    await markNotificationAsRead(token, item.id);
                                                    await refresh();
                                                }}
                                            >
                                                Mark Read
                                            </button>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        )}

                        {nextCursor ? (
                            <button className="btn btn-secondary" onClick={() => void loadMore()} disabled={isLoading}>
                                Load More
                            </button>
                        ) : null}
                    </div>
                )}
            </SectionCard>
        </AppShell>
    );
}
