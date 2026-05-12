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

const dateTimeWithoutOffsetPattern = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/;
const timezoneOffsetPattern = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

function parseTimestamp(value: string) {
    const normalizedValue = value.trim();
    const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parseValue =
        dateTimeWithoutOffsetPattern.test(normalizedValue) && !timezoneOffsetPattern.test(normalizedValue)
            ? `${normalizedValue.replace(" ", "T")}Z`
            : normalizedValue;

    const date = new Date(parseValue);
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

    return date.toLocaleDateString("en-US", {
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
        return `${relativeLabel}, ${date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        })}`;
    }

    return date.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}
