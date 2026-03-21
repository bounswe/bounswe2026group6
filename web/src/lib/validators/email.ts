export function isValidEmail(email: string) {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) return false;
    if (trimmedEmail.includes(" ")) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(trimmedEmail);
}