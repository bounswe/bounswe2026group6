"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { getAccessToken } from "@/lib/auth";
import {
    fetchNotificationPreferences,
    fetchNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    updateNotificationPreferences,
    type NotificationItem,
} from "@/lib/notifications";

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function formatTypeLabel(value: string) {
    const normalized = (value || "").trim().toLowerCase();
    if (!normalized) return "Notification";
    return normalized
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatEntityLabel(item: NotificationItem) {
    const entityType = item.entity?.type?.trim();
    const entityId = item.entity?.id?.trim();

    if (!entityType && !entityId) {
        return "General update";
    }

    if (entityType && entityId) {
        return `${formatTypeLabel(entityType)} #${entityId}`;
    }

    if (entityType) {
        return formatTypeLabel(entityType);
    }

    return `Reference #${entityId}`;
}

export default function NotificationsPage() {
    const [token, setToken] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [items, setItems] = React.useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [nextCursor, setNextCursor] = React.useState<string | null>(null);
    const [pushEnabled, setPushEnabled] = React.useState(true);
    const [markingAllRead, setMarkingAllRead] = React.useState(false);
    const [savingPushPreference, setSavingPushPreference] = React.useState(false);
    const [markingItemId, setMarkingItemId] = React.useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const refreshRequestIdRef = React.useRef(0);
    const loadMoreRequestIdRef = React.useRef(0);
    const listEpochRef = React.useRef(0);

    const refresh = React.useCallback(async () => {
        if (!token) return;
        // Treat refresh as a new authoritative snapshot boundary.
        // Any in-flight pagination result from older snapshots must be ignored.
        listEpochRef.current += 1;
        loadMoreRequestIdRef.current += 1;
        setIsLoadingMore(false);
        const requestId = ++refreshRequestIdRef.current;
        const refreshEpoch = listEpochRef.current;
        setIsLoading(true);
        setError(null);
        try {
            const [notifications, preferences] = await Promise.all([
                fetchNotifications(token, { limit: 20 }),
                fetchNotificationPreferences(token),
            ]);

            if (requestId !== refreshRequestIdRef.current || refreshEpoch !== listEpochRef.current) {
                return;
            }

            setItems(notifications.items);
            setUnreadCount(notifications.unreadCount);
            setNextCursor(notifications.nextCursor);
            setPushEnabled(preferences.preferences.pushEnabled);
        } catch (requestError) {
            if (requestId !== refreshRequestIdRef.current || refreshEpoch !== listEpochRef.current) {
                return;
            }
            setError(requestError instanceof Error ? requestError.message : "Failed to load notifications.");
        } finally {
            if (requestId === refreshRequestIdRef.current) {
                setIsLoading(false);
            }
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
        if (!token || !nextCursor || isLoading || isLoadingMore) return;
        const requestId = ++loadMoreRequestIdRef.current;
        const cursorAtRequestStart = nextCursor;
        const loadMoreEpoch = listEpochRef.current;
        setIsLoadingMore(true);
        try {
            const nextPage = await fetchNotifications(token, { limit: 20, cursor: cursorAtRequestStart });

            if (
                requestId !== loadMoreRequestIdRef.current ||
                loadMoreEpoch !== listEpochRef.current
            ) {
                return;
            }

            setItems((prev) => {
                const seenIds = new Set(prev.map((item) => item.id));
                const merged = [...prev];
                for (const item of nextPage.items) {
                    if (!seenIds.has(item.id)) {
                        merged.push(item);
                        seenIds.add(item.id);
                    }
                }
                return merged;
            });
            setUnreadCount(nextPage.unreadCount);
            setNextCursor(nextPage.nextCursor);
        } catch (requestError) {
            if (
                requestId !== loadMoreRequestIdRef.current ||
                loadMoreEpoch !== listEpochRef.current
            ) {
                return;
            }
            setError(requestError instanceof Error ? requestError.message : "Failed to load more.");
        } finally {
            if (requestId === loadMoreRequestIdRef.current) {
                setIsLoadingMore(false);
            }
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
                    <div className="notifications-page-wrap">
                        <div className="notifications-controls-card">
                            <p className="notifications-controls-title">Notification controls</p>
                            <p className="notifications-controls-subtitle">
                                Push ON/OFF controls push delivery preference. Notifications are always listed here in-app.
                            </p>
                            <div className="notifications-toolbar">
                                <SecondaryButton className="w-auto" onClick={() => void refresh()} disabled={isLoading || isLoadingMore || markingAllRead || savingPushPreference}>
                                    Refresh
                                </SecondaryButton>
                                <SecondaryButton
                                    className="w-auto"
                                    onClick={async () => {
                                        if (!token) return;
                                        setMarkingAllRead(true);
                                        try {
                                            await markAllNotificationsAsRead(token);
                                            await refresh();
                                        } finally {
                                            setMarkingAllRead(false);
                                        }
                                    }}
                                    disabled={isLoading || isLoadingMore || markingAllRead || savingPushPreference || unreadCount === 0}
                                >
                                    {markingAllRead ? "Marking..." : "Mark All Read"}
                                </SecondaryButton>
                                <PrimaryButton
                                    className="w-auto"
                                    onClick={async () => {
                                        if (!token) return;
                                        const next = !pushEnabled;
                                        setSavingPushPreference(true);
                                        try {
                                            await updateNotificationPreferences(token, next);
                                            setPushEnabled(next);
                                        } finally {
                                            setSavingPushPreference(false);
                                        }
                                    }}
                                    loading={savingPushPreference}
                                    disabled={isLoading || isLoadingMore || markingAllRead}
                                >
                                    Push {pushEnabled ? "ON" : "OFF"}
                                </PrimaryButton>
                            </div>
                        </div>

                        {error ? <p className="admin-error-text">{error}</p> : null}
                        {isLoading ? <p className="text-muted">Loading notifications...</p> : null}
                        {isLoadingMore ? <p className="text-muted">Loading more notifications...</p> : null}

                        {items.length === 0 && !isLoading ? (
                            <div className="notifications-empty-state">
                                <p className="notifications-empty-title">No notifications yet</p>
                                <p className="text-muted">You will see account and emergency updates here.</p>
                            </div>
                        ) : (
                            <div className="notifications-list">
                                {items.map((item) => (
                                    <article
                                        key={item.id}
                                        className={`notifications-item-card${item.isRead ? "" : " is-unread"}`}
                                    >
                                        <div className="notifications-item-meta-row">
                                            <span className="notifications-item-type-chip">
                                                {formatTypeLabel(item.type)}
                                            </span>
                                            <span className="news-item-date">{formatDateTime(item.createdAt)}</span>
                                        </div>

                                        <h3 className="notifications-item-title">
                                            {item.title || "Notification update"}
                                        </h3>

                                        <p className="notifications-item-body">{item.body}</p>

                                        <div className="notifications-item-context">
                                            <p>
                                                <strong>Related to:</strong> {formatEntityLabel(item)}
                                            </p>
                                            <p>
                                                <strong>Status:</strong> {item.isRead ? "Read" : "Unread"}
                                                {item.readAt ? ` - Read at ${formatDateTime(item.readAt)}` : ""}
                                            </p>
                                        </div>

                                        <div className="notifications-item-actions">
                                            {!item.isRead ? (
                                                <PrimaryButton
                                                    className="w-auto"
                                                    loading={markingItemId === item.id}
                                                    disabled={Boolean(markingItemId)}
                                                    onClick={async () => {
                                                        if (!token) return;
                                                        setMarkingItemId(item.id);
                                                        try {
                                                            await markNotificationAsRead(token, item.id);
                                                            await refresh();
                                                        } finally {
                                                            setMarkingItemId(null);
                                                        }
                                                    }}
                                                >
                                                    Mark as Read
                                                </PrimaryButton>
                                            ) : (
                                                <span className="notifications-read-pill">Read</span>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        {nextCursor ? (
                            <SecondaryButton className="w-auto notifications-load-more" onClick={() => void loadMore()} disabled={isLoading || isLoadingMore}>
                                {isLoadingMore ? "Loading..." : "Load More"}
                            </SecondaryButton>
                        ) : null}
                    </div>
                )}
            </SectionCard>
        </AppShell>
    );
}
