import { trainLineNodeFinder } from "@/maps/api";
import { datasets } from "@/maps/datasets/load";
import { NotApplicableError } from "@/maps/errors";

/**
 * "Is your station on the same train line as mine?": a test for whether a
 * station (by OSM id, "node/123") shares a train line with `stationId`.
 * Uses the reference data's train lines, or a live query without them.
 */
export const sharesTrainLineWith = async (
    stationId: string,
    stationName = "the seeker's station",
): Promise<(otherId: string) => boolean> => {
    const fromData = await datasets.stationsOnSameLine(stationId);
    if (fromData) {
        if (fromData.lines.length === 0) {
            throw new NotApplicableError(
                `No train line found for ${stationName}.`,
            );
        }
        return (otherId) => fromData.stations.has(otherId);
    }

    const nodes = await trainLineNodeFinder(stationId);
    if (nodes.length === 0) {
        throw new NotApplicableError(`No train line found for ${stationName}.`);
    }
    return (otherId) =>
        otherId.includes("/") &&
        nodes.includes(parseInt(otherId.split("/")[1]));
};
