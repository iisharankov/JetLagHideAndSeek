import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const mapToObj = <T, K extends string, V>(
    arr: T[],
    fn: (item: T) => [K, V],
) => Object.fromEntries(arr.map(fn));

/**
 * Open native share sheet or fallback to sending to clipboard
 * @param url URL to share
 * @param forceClipboard Whether to force usage of the clipboard (instead of share sheet)
 * @returns `true` for native success, `false` for both native and fallback failure and `"clipboard"` for clipboard success
 */
export async function shareOrFallback(
    url: string,
    forceClipboard = false,
): Promise<boolean | "clipboard"> {
    if (forceClipboard) {
        if (!navigator || !navigator.clipboard) {
            // Clipboard not supported
            return false;
        }

        navigator.clipboard.writeText(url);
        return "clipboard";
    }

    if (!navigator.share) return shareOrFallback(url, true); // Fallback to clipboard

    return await navigator
        .share({ url })
        .then(() => true)
        .catch(() => {
            // Try again with clipboard
            return shareOrFallback(url, true);
        });
}
