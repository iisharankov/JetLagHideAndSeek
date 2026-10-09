// Train lines for "is your station on the same train line as mine?". Lines
// are OpenStreetMap train route relations (S-Bahn lines, IR, IC…). Their
// stop and platform members are matched to the nearest train station, so the
// app can look up which lines serve a station without a live query.
import * as turf from "@turf/turf";

export type OplObject =
    | { kind: "node"; id: number; lon: number; lat: number; name?: string }
    | { kind: "way"; id: number; nodes: number[] }
    | {
          kind: "relation";
          id: number;
          tags: Record<string, string>;
          members: { type: "n" | "w" | "r"; id: number; role: string }[];
      };

/** OPL escapes special characters as %<hex code point>%. */
const unescape = (text: string) =>
    text.replace(/%([0-9a-fA-F]+)%/g, (_, hex) =>
        String.fromCodePoint(parseInt(hex, 16)),
    );

const tagsOf = (field: string | undefined) => {
    const tags: Record<string, string> = {};
    for (const pair of field ? field.split(",") : []) {
        const [key, value = ""] = pair.split("=");
        tags[unescape(key)] = unescape(value);
    }
    return tags;
};

const fieldsOf = (line: string) => {
    const fields: Record<string, string> = {};
    for (const field of line.split(" ").slice(1)) {
        if (field) fields[field[0]] = field.slice(1);
    }
    return fields;
};

/** One line of `osmium cat -f opl,add_metadata=false` output. */
export const parseOplLine = (line: string): OplObject | null => {
    const kind = line[0];
    const id = Number(line.slice(1, line.indexOf(" ")));
    const fields = fieldsOf(line);

    if (kind === "n") {
        if (!fields.x || !fields.y) return null;
        const { name } = tagsOf(fields.T);
        return {
            kind: "node",
            id,
            lon: Number(fields.x),
            lat: Number(fields.y),
            ...(name ? { name } : {}),
        };
    }
    if (kind === "w") {
        const nodes = fields.N
            ? fields.N.split(",").map((ref) => Number(ref.slice(1)))
            : [];
        return { kind: "way", id, nodes };
    }
    if (kind === "r") {
        const tags = tagsOf(fields.T);
        const members = (fields.M ? fields.M.split(",") : []).map((member) => {
            const at = member.indexOf("@");
            return {
                type: member[0] as "n" | "w" | "r",
                id: Number(member.slice(1, at)),
                role: unescape(member.slice(at + 1)),
            };
        });
        return { kind: "relation", id, tags, members };
    }
    return null;
};

export interface RailStation {
    /** "node/123" or "way/456", as in the station datasets. */
    key: string;
    lon: number;
    lat: number;
    name?: string;
}

export interface TrainLine {
    name: string;
    /** Positions of its stops and platforms. */
    stops: [number, number][];
    /** Names of the stops, where known (same order as `stops`). */
    stopNames?: (string | undefined)[];
}

export interface TrainLines {
    lines: { name: string }[];
    /** Station key → indexes into `lines` of the lines stopping there. */
    stations: Record<string, number[]>;
}

/** A stop counts for a station at most this far away (big stations). */
const MAX_STOP_DISTANCE_KM = 0.4;
const CELL_DEGREES = 0.01;

const cellKey = (lon: number, lat: number) =>
    `${Math.floor(lon / CELL_DEGREES)},${Math.floor(lat / CELL_DEGREES)}`;

export const linesByStation = (
    lines: TrainLine[],
    stations: RailStation[],
): TrainLines => {
    const grid = new Map<string, RailStation[]>();
    for (const station of stations) {
        const key = cellKey(station.lon, station.lat);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(station);
    }
    // Neighbouring cells cover MAX_STOP_DISTANCE_KM in every direction.
    const reach = Math.ceil(MAX_STOP_DISTANCE_KM / 111 / CELL_DEGREES / 0.6);
    /** The station a stop belongs to: same name if any, else the nearest. */
    const stationOf = ([lon, lat]: [number, number], name?: string) => {
        const col = Math.floor(lon / CELL_DEGREES);
        const row = Math.floor(lat / CELL_DEGREES);
        let best: RailStation | null = null;
        let bestScore = Infinity;
        for (let dx = -reach; dx <= reach; dx++) {
            for (let dy = -reach; dy <= reach; dy++) {
                for (const station of grid.get(`${col + dx},${row + dy}`) ??
                    []) {
                    const km = turf.distance(
                        [lon, lat],
                        [station.lon, station.lat],
                    );
                    if (km > MAX_STOP_DISTANCE_KM) continue;
                    const score =
                        name && station.name === name ? km - 1000 : km;
                    if (score < bestScore) {
                        best = station;
                        bestScore = score;
                    }
                }
            }
        }
        return best;
    };

    const byStation: Record<string, number[]> = {};
    lines.forEach((line, index) => {
        for (const [i, stop] of line.stops.entries()) {
            const station = stationOf(stop, line.stopNames?.[i]);
            if (!station) continue;
            const served = (byStation[station.key] ??= []);
            if (!served.includes(index)) served.push(index);
        }
    });
    return {
        lines: lines.map(({ name }) => ({ name })),
        stations: byStation,
    };
};

const STOP_ROLES = new Set([
    "stop",
    "stop_entry_only",
    "stop_exit_only",
    "platform",
    "platform_entry_only",
    "platform_exit_only",
]);

/**
 * Train lines from OPL lines of route relations and the nodes and ways they
 * reference (`osmium tags-filter … r/route=train`, then `osmium cat -f opl`).
 */
export const trainLinesFromOpl = (oplLines: Iterable<string>): TrainLine[] => {
    const nodes = new Map<number, [number, number]>();
    const nodeNames = new Map<number, string>();
    const ways = new Map<number, number[]>();
    const relations: Extract<OplObject, { kind: "relation" }>[] = [];
    for (const line of oplLines) {
        const object = parseOplLine(line);
        if (object?.kind === "node") {
            nodes.set(object.id, [object.lon, object.lat]);
            if (object.name) nodeNames.set(object.id, object.name);
        } else if (object?.kind === "way") ways.set(object.id, object.nodes);
        else if (object?.kind === "relation") relations.push(object);
    }

    const wayCenter = (id: number): [number, number] | undefined => {
        const points = (ways.get(id) ?? [])
            .map((node) => nodes.get(node))
            .filter((point) => point !== undefined);
        if (points.length === 0) return undefined;
        const [minLon, minLat, maxLon, maxLat] = turf.bbox(
            turf.multiPoint(points),
        );
        return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
    };

    return relations
        .filter((relation) => relation.tags.route === "train")
        .map((relation) => {
            const stops = relation.members
                .filter((member) => STOP_ROLES.has(member.role))
                .map((member) => ({
                    position:
                        member.type === "n"
                            ? nodes.get(member.id)
                            : member.type === "w"
                              ? wayCenter(member.id)
                              : undefined,
                    name:
                        member.type === "n"
                            ? nodeNames.get(member.id)
                            : undefined,
                }))
                .filter((stop) => stop.position !== undefined);
            return {
                name:
                    relation.tags.name ??
                    relation.tags.ref ??
                    `Train line ${relation.id}`,
                stops: stops.map((stop) => stop.position!),
                stopNames: stops.map((stop) => stop.name),
            };
        })
        .filter((line) => line.stops.length > 0);
};
