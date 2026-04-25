export function formatOperationalLabel(value: string | null | undefined) {
    if (!value) {
        return "-";
    }

    return String(value)
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("tr-TR")
        .split(" ")
        .map((word) => (word ? word[0].toLocaleUpperCase("tr-TR") + word.slice(1) : word))
        .join(" ");
}