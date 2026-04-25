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