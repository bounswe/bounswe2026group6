import { apiRequest } from "@/lib/api";

export type Announcement = {
    id: string;
    adminId: string;
    title: string;
    content: string;
    createdAt: string;
};

export type NewsItem = {
    id: string;
    title: string;
    content: string;
    summary: string;
    hasMore: boolean;
    publishedAt: string;
    category: "Announcement";
};

type AnnouncementsResponse = {
    announcements: Announcement[];
};

type AnnouncementResponse = {
    announcement: Announcement;
};

function buildAnnouncementsPath(options: { limit?: number } = {}) {
    const params = new URLSearchParams();
    if (typeof options.limit === "number") {
        params.set("limit", String(options.limit));
    }

    const query = params.toString();
    return `/announcements${query ? `?${query}` : ""}`;
}

export function formatAnnouncementDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function summarizeAnnouncementContent(content: string, maxLength = 180) {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function announcementToNewsItem(announcement: Announcement): NewsItem {
    const summary = summarizeAnnouncementContent(announcement.content);

    return {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        summary,
        hasMore: summary !== announcement.content.replace(/\s+/g, " ").trim(),
        publishedAt: formatAnnouncementDate(announcement.createdAt),
        category: "Announcement",
    };
}

export async function fetchAnnouncements(options: { limit?: number } = {}) {
    const response = await apiRequest<AnnouncementsResponse>(buildAnnouncementsPath(options));
    return response.announcements;
}

export async function fetchAnnouncement(announcementId: string) {
    const response = await apiRequest<AnnouncementResponse>(
        `/announcements/${encodeURIComponent(announcementId)}`
    );

    return response.announcement;
}
