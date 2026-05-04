"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { announcementToNewsItem, fetchAnnouncements, type NewsItem } from "@/lib/news";

export default function NewsPage() {
    const [items, setItems] = React.useState<NewsItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");

    const loadAnnouncements = React.useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const announcements = await fetchAnnouncements({ limit: 100 });
            setItems(announcements.map(announcementToNewsItem));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load announcements.");
            setItems([]);
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
                        <div className="admin-empty-state">
                            <p>Loading announcements...</p>
                        </div>
                    ) : error ? (
                        <div className="admin-empty-state">
                            <p className="admin-error-text">{error}</p>
                            <PrimaryButton className="w-auto" onClick={() => void loadAnnouncements()}>
                                Retry
                            </PrimaryButton>
                        </div>
                    ) : items.length === 0 ? (
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
                </SectionCard>
            </div>
        </AppShell>
    );
}
