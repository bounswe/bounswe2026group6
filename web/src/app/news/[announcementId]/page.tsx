"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { fetchAnnouncement, formatAnnouncementDate, type Announcement } from "@/lib/news";

function readAnnouncementId(param: string | string[] | undefined) {
    if (Array.isArray(param)) {
        return param[0] || "";
    }

    return param || "";
}

export default function NewsDetailPage() {
    const params = useParams<{ announcementId?: string | string[] }>();
    const announcementId = readAnnouncementId(params.announcementId);
    const [announcement, setAnnouncement] = React.useState<Announcement | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");

    const loadAnnouncement = React.useCallback(async () => {
        if (!announcementId) {
            setAnnouncement(null);
            setError("Announcement id is missing.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const nextAnnouncement = await fetchAnnouncement(announcementId);
            setAnnouncement(nextAnnouncement);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load announcement.");
            setAnnouncement(null);
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
                        <div className="admin-empty-state">
                            <p>Loading announcement...</p>
                        </div>
                    ) : error ? (
                        <div className="admin-empty-state">
                            <p className="admin-error-text">{error}</p>
                            <PrimaryButton className="w-auto" onClick={() => void loadAnnouncement()}>
                                Retry
                            </PrimaryButton>
                        </div>
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
