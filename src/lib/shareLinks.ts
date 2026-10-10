// Share links: a copy of the game as a link (own server, or the whole game
// compressed into the address), and reading one from the page's address.
import { downloadSharedGame } from "@/lib/shareApi";
import { decompress } from "@/lib/utils";

export const SHARE_URL_PARAM = "share"; // id on our own share service
export const HIDING_ZONE_COMPRESSED_URL_PARAM = "hzc"; // the whole game in the link
const HIDING_ZONE_URL_PARAM = "hz"; // legacy, uncompressed
const FETCH_URL_PARAM = "url"; // a game file hosted somewhere else
export const MAX_LINK_LENGTH = 2000;

/** The shared game in the page's URL, if any. */
export const readSharedGameFromUrl = async (
    params: URLSearchParams,
): Promise<{ text: string; source?: string } | null> => {
    const shareId = params.get(SHARE_URL_PARAM);
    if (shareId) return { text: await downloadSharedGame(shareId) };

    const compressed = params.get(HIDING_ZONE_COMPRESSED_URL_PARAM);
    if (compressed) return { text: await decompress(compressed) };

    const legacy = params.get(HIDING_ZONE_URL_PARAM);
    if (legacy) return { text: atob(legacy) };

    const url = params.get(FETCH_URL_PARAM);
    if (url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }
        return { text: await response.text(), source: url };
    }

    return null;
};
