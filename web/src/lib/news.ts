import { apiRequest } from "@/lib/api";
import { formatTimestampDate } from "@/lib/formatters";

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

export const ANNOUNCEMENTS_CACHE_KEY = "neph.publicAnnouncements.cache.v1";

export type AnnouncementCache = {
    announcements: Announcement[];
    savedAt: string;
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
    return formatTimestampDate(value);
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

export function readCachedAnnouncements(): AnnouncementCache | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(ANNOUNCEMENTS_CACHE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<AnnouncementCache>;
        if (!Array.isArray(parsed.announcements) || typeof parsed.savedAt !== "string") {
            return null;
        }

        return {
            announcements: parsed.announcements,
            savedAt: parsed.savedAt,
        };
    } catch {
        return null;
    }
}

export function cacheAnnouncements(announcements: Announcement[], savedAt: string) {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(
            ANNOUNCEMENTS_CACHE_KEY,
            JSON.stringify({ announcements, savedAt })
        );
    } catch {
        // Cache is best-effort only.
    }
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
