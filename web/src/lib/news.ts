export type NewsItem = {
    id: string;
    title: string;
    summary: string;
    publishedAt: string;
    category: "Preparedness" | "Community" | "Announcement";
};

export const mockNews: NewsItem[] = [
    {
        id: "n-001",
        title: "Neighborhood Preparedness Workshops Start Next Week",
        summary:
            "Local volunteer teams will host practical first-response workshops for households in participating districts.",
        publishedAt: "2026-03-20",
        category: "Preparedness",
    },
    {
        id: "n-002",
        title: "Mobile App Pilot Open for Early Access",
        summary:
            "NEPH mobile pilot is available for selected users to test incident reporting and emergency support requests.",
        publishedAt: "2026-03-18",
        category: "Announcement",
    },
    {
        id: "n-003",
        title: "Community Safety Volunteers Expanded",
        summary:
            "New volunteers have joined the response network, improving local coverage for urgent coordination.",
        publishedAt: "2026-03-13",
        category: "Community",
    },
    {
        id: "n-004",
        title: "Medical Information Checklist Updated",
        summary:
            "The profile health checklist now includes clearer guidance for medications and chronic conditions.",
        publishedAt: "2026-03-09",
        category: "Preparedness",
    },
];
