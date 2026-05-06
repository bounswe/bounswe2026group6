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

export const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
    {
        id: "seed_announcement_gathering_area",
        adminId: "seed",
        title: "Know your nearest gathering area",
        content:
            "Check the gathering areas page and keep your location information up to date so emergency guidance can stay relevant.",
        createdAt: "2026-04-29T12:10:00.000Z",
    },
    {
        id: "seed_announcement_volunteer_expansion",
        adminId: "seed",
        title: "Community safety volunteers are expanding",
        content:
            "New volunteer coordination improvements are being prepared to help communities respond faster during emergencies.",
        createdAt: "2026-04-29T12:05:00.000Z",
    },
    {
        id: "seed_announcement_preparedness_checklist",
        adminId: "seed",
        title: "Preparedness checklist updated",
        content:
            "Review your household emergency bag, contact list, medication details, and nearest gathering area before an emergency occurs.",
        createdAt: "2026-04-29T12:00:00.000Z",
    },
];

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
