"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import {
    FALLBACK_ANNOUNCEMENTS,
    announcementToNewsItem,
    cacheAnnouncements,
    fetchAnnouncements,
    readCachedAnnouncements,
    type NewsItem,
} from "@/lib/news";

function formatLastUpdated(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function buildFailureMessage(err: unknown, sourceLabel: string) {
    const rawDetail = err instanceof Error ? err.message : "";
    const detail = /could not reach the server/i.test(rawDetail)
        ? "the live announcements service did not respond"
        : rawDetail || "the announcements API did not respond";
    return `Announcements could not be refreshed (${detail}). Showing ${sourceLabel} instead.`;
}

export default function NewsPage() {
    const [items, setItems] = React.useState<NewsItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [lastUpdated, setLastUpdated] = React.useState("");
    const [sourceLabel, setSourceLabel] = React.useState("live announcements");

    const loadAnnouncements = React.useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const announcements = await fetchAnnouncements({ limit: 100 });
            const savedAt = new Date().toISOString();
            cacheAnnouncements(announcements, savedAt);
            setItems(announcements.map(announcementToNewsItem));
            setLastUpdated(savedAt);
            setSourceLabel("live announcements");
        } catch (err) {
            const cached = readCachedAnnouncements();

            if (cached && cached.announcements.length) {
                setItems(cached.announcements.map(announcementToNewsItem));
                setLastUpdated(cached.savedAt);
                setSourceLabel("cached announcements");
                setError(buildFailureMessage(err, "cached announcements"));
            } else {
                setItems(FALLBACK_ANNOUNCEMENTS.map(announcementToNewsItem));
                setLastUpdated(FALLBACK_ANNOUNCEMENTS[0]?.createdAt || "");
                setSourceLabel("demo announcements");
                setError(buildFailureMessage(err, "demo announcements"));
            }
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadAnnouncements();
    }, [loadAnnouncements]);

    return (
        <AppShell title="News">
            <div className="news-page-grid">
                <SectionCard>
                    <SectionHeader
                        title="All News"
                        subtitle="Announcements, preparedness updates, and community coordination notes."
                    />

                    {loading ? (
                        <div className="news-list" aria-label="Loading announcements">
                            {[0, 1, 2].map((index) => (
                                <div key={index} className="news-item-card news-item-skeleton">
                                    <span className="news-skeleton-line is-chip" />
                                    <span className="news-skeleton-line is-title" />
                                    <span className="news-skeleton-line" />
                                    <span className="news-skeleton-line is-short" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className={error ? "news-status-box is-warning" : "news-status-box"}>
                                <div>
                                    <p className="news-status-title">
                                        {error ? "Using fallback news" : "Announcements are up to date"}
                                    </p>
                                    <p className="news-status-copy">
                                        {error || `Showing ${sourceLabel}.`}
                                    </p>
                                    {lastUpdated ? (
                                        <p className="news-status-copy">
                                            Last updated: {formatLastUpdated(lastUpdated)}
                                        </p>
                                    ) : null}
                                </div>
                                <PrimaryButton className="w-auto" onClick={() => void loadAnnouncements()}>
                                    Retry news
                                </PrimaryButton>
                            </div>

                            {items.length === 0 ? (
                                <div className="admin-empty-state">
                                    <p>No announcements have been published yet.</p>
                                </div>
                            ) : (
                                <div className="news-list">
                                    {items.map((item) => (
                                        <article key={item.id} className="news-item-card">
                                            <div className="news-item-meta-row">
                                                <span className="news-item-category-chip">
                                                    {item.category}
                                                </span>
                                                <span className="news-item-date">{item.publishedAt}</span>
                                            </div>

                                            <h2 className="news-item-title">{item.title}</h2>
                                            <p className="news-item-summary">{item.summary}</p>
                                            <Link
                                                className="news-read-more-link"
                                                href={`/news/${encodeURIComponent(item.id)}`}
                                            >
                                                {item.hasMore ? "Read full announcement" : "Open announcement"}
                                            </Link>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </SectionCard>
            </div>
        </AppShell>
    );
}
