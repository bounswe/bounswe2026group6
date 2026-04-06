import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { mockNews } from "@/lib/news";

export default function NewsPage() {
    return (
        <AppShell title="News">
            <div className="news-page-grid">
                <SectionCard>
                    <SectionHeader
                        title="All News"
                        subtitle="Announcements, preparedness updates, and community coordination notes."
                    />

                    <div className="news-list">
                        {mockNews.map((item) => (
                            <article key={item.id} className="news-item-card">
                                <div className="news-item-meta-row">
                                    <span className="news-item-category-chip">
                                        {item.category}
                                    </span>
                                    <span className="news-item-date">{item.publishedAt}</span>
                                </div>

                                <h2 className="news-item-title">{item.title}</h2>
                                <p className="news-item-summary">{item.summary}</p>
                            </article>
                        ))}
                    </div>
                </SectionCard>
            </div>
        </AppShell>
    );
}
