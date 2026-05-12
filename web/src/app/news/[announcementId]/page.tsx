"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import {
    ANNOUNCEMENTS_CACHE_KEY,
    fetchAnnouncement,
    formatAnnouncementDate,
    type Announcement,
} from "@/lib/news";

function readAnnouncementId(param: string | string[] | undefined) {
    if (Array.isArray(param)) {
        return param[0] || "";
    }

    return param || "";
}

function findCachedAnnouncement(announcementId: string) {
    try {
        const raw = window.localStorage.getItem(ANNOUNCEMENTS_CACHE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as { announcements?: Announcement[] };
        return parsed.announcements?.find((item) => item.id === announcementId) || null;
    } catch {
        return null;
    }
}

function describeAnnouncementFailure(err: unknown) {
    const rawDetail = err instanceof Error ? err.message : "";
    if (/could not reach the server/i.test(rawDetail)) {
        return "the live announcements service did not respond";
    }

    return rawDetail || "the announcement API did not respond";
}

export default function NewsDetailPage() {
    const params = useParams<{ announcementId?: string | string[] }>();
    const announcementId = readAnnouncementId(params.announcementId);
    const [announcement, setAnnouncement] = React.useState<Announcement | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [usingFallback, setUsingFallback] = React.useState(false);

    const loadAnnouncement = React.useCallback(async () => {
        if (!announcementId) {
            setAnnouncement(null);
            setError("Announcement id is missing.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");
        setUsingFallback(false);

        try {
            const nextAnnouncement = await fetchAnnouncement(announcementId);
            setAnnouncement(nextAnnouncement);
        } catch (err) {
            const fallback = findCachedAnnouncement(announcementId);

            if (fallback) {
                const detail = describeAnnouncementFailure(err);
                setAnnouncement(fallback);
                setUsingFallback(true);
                setError(`Announcement could not be refreshed (${detail}). Showing cached content.`);
            } else {
                setError(`Announcement could not be refreshed (${describeAnnouncementFailure(err)}).`);
                setAnnouncement(null);
            }
        } finally {
            setLoading(false);
        }
    }, [announcementId]);

    React.useEffect(() => {
        void loadAnnouncement();
    }, [loadAnnouncement]);

    return (
        <AppShell title="News">
            <div className="news-page-grid">
                <SectionCard>
                    <Link className="news-back-link" href="/news">
                        ← Back to all news
                    </Link>

                    {loading ? (
                        <div className="news-detail-card" aria-label="Loading announcement">
                            <div className="news-item-card news-item-skeleton">
                                <span className="news-skeleton-line is-chip" />
                                <span className="news-skeleton-line is-title" />
                                <span className="news-skeleton-line" />
                                <span className="news-skeleton-line" />
                            </div>
                        </div>
                    ) : error ? (
                        <>
                            <div className={usingFallback ? "news-status-box is-warning" : "news-status-box is-error"}>
                                <div>
                                    <p className="news-status-title">
                                        {usingFallback ? "Using cached announcement" : "Announcement load failed"}
                                    </p>
                                    <p className="news-status-copy">{error}</p>
                                </div>
                                <PrimaryButton className="w-auto" onClick={() => void loadAnnouncement()}>
                                    Retry announcement
                                </PrimaryButton>
                            </div>

                            {!announcement ? null : (
                                <article className="news-detail-card">
                                    <div className="news-item-meta-row">
                                        <span className="news-item-category-chip">Announcement</span>
                                        <span className="news-item-date">
                                            {formatAnnouncementDate(announcement.createdAt)}
                                        </span>
                                    </div>

                                    <SectionHeader
                                        className="news-detail-header"
                                        title={announcement.title}
                                        subtitle="Official public announcement from the emergency coordination team."
                                    />

                                    <p className="news-detail-content">{announcement.content}</p>
                                </article>
                            )}
                        </>
                    ) : announcement ? (
                        <article className="news-detail-card">
                            <div className="news-item-meta-row">
                                <span className="news-item-category-chip">Announcement</span>
                                <span className="news-item-date">
                                    {formatAnnouncementDate(announcement.createdAt)}
                                </span>
                            </div>

                            <SectionHeader
                                className="news-detail-header"
                                title={announcement.title}
                                subtitle="Official public announcement from the emergency coordination team."
                            />

                            <p className="news-detail-content">{announcement.content}</p>
                        </article>
                    ) : (
                        <div className="admin-empty-state">
                            <p>Announcement not found.</p>
                        </div>
                    )}
                </SectionCard>
            </div>
        </AppShell>
    );
}
