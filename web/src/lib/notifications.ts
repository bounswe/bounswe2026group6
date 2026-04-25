import { apiRequest } from "@/lib/api";

export type NotificationItem = {
    id: string;
    type: string;
    title: string;
    body: string;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
    actorUserId?: string | null;
    entity?: { type: string; id: string } | null;
    data?: Record<string, unknown>;
};

type NotificationsResponse = {
    items: NotificationItem[];
    unreadCount: number;
    nextCursor: string | null;
};

type PreferencesResponse = {
    preferences: {
        userId: string;
        pushEnabled: boolean;
        updatedAt: string | null;
    };
};

export async function fetchNotifications(token: string, options?: {
    limit?: number;
    cursor?: string | null;
    unreadOnly?: boolean;
}) {
    const limit = options?.limit ?? 20;
    const unreadOnly = options?.unreadOnly ?? false;
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("unreadOnly", String(unreadOnly));
    if (options?.cursor) {
        params.set("cursor", options.cursor);
    }

    return apiRequest<NotificationsResponse>(`/notifications?${params.toString()}`, {
        token,
    });
}

export async function markNotificationAsRead(token: string, notificationId: string) {
    return apiRequest<{ notification: NotificationItem }>(`/notifications/${notificationId}/read`, {
        method: "PATCH",
        token,
        body: {},
    });
}

export async function markAllNotificationsAsRead(token: string) {
    return apiRequest<{ updatedCount: number; unreadCount: number }>("/notifications/read-all", {
        method: "PATCH",
        token,
        body: {},
    });
}

export async function fetchNotificationPreferences(token: string) {
    return apiRequest<PreferencesResponse>("/notifications/preferences", { token });
}

export async function updateNotificationPreferences(token: string, pushEnabled: boolean) {
    return apiRequest<PreferencesResponse>("/notifications/preferences", {
        method: "PATCH",
        token,
        body: { pushEnabled },
    });
}

export async function fetchUnreadNotificationCount(token: string) {
    return apiRequest<{ unreadCount: number }>("/notifications/unread-count", { token });
}
