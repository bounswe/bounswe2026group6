export function formatOperationalLabel(value: string | null | undefined) {
    if (!value) {
        return "-";
    }

    return String(value)
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("en-US")
        .split(" ")
        .map((word) => (word ? word[0].toLocaleUpperCase("en-US") + word.slice(1) : word))
        .join(" ");
}

function parseTimestamp(value: string) {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getRelativeDayLabel(date: Date, now = new Date()) {
    const targetDay = startOfLocalDay(date).getTime();
    const today = startOfLocalDay(now).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;

    if (targetDay === today) {
        return "Today";
    }

    if (targetDay === yesterday) {
        return "Yesterday";
    }

    return null;
}

export function formatTimestampDate(value: string, now = new Date()) {
    const date = parseTimestamp(value);
    if (!date) {
        return value;
    }

    const relativeLabel = getRelativeDayLabel(date, now);
    if (relativeLabel) {
        return relativeLabel;
    }

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function formatTimestampDateTime(value: string, now = new Date()) {
    const date = parseTimestamp(value);
    if (!date) {
        return value;
    }

    const relativeLabel = getRelativeDayLabel(date, now);
    if (relativeLabel) {
        return `${relativeLabel}, ${date.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        })}`;
    }

    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}
