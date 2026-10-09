// Stations that don't count as hiding-zone stations because players can't
// get to them: the ones behind an airport's security check and the like.
// Edit this list to change it. The key is the station's OpenStreetMap id as
// the app sees it ("node/<id>"); the value says why it's left out.
export const UNREACHABLE_STATIONS: Record<string, string> = {
    "node/1191403583":
        "Dock E at Zürich Airport: the Skymetro stop is airside, behind security.",
};
