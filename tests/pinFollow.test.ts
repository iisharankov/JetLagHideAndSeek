import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it } from "vitest";

import { hiderMode, hidingRadius, hidingRadiusUnits } from "@/lib/context";
import {
    chosenStation,
    followPin,
    hiderChoosing,
    pinDrivenElsewhere,
    pinFollowsGps,
    pinLocked,
} from "@/lib/hiderSpot";

const station = { id: "hb", name: "Zürich HB", lat: 47.3779, lng: 8.5403 };
/** A spot `metres` north of the station. */
const north = (metres: number, at: number) => {
    const [longitude, latitude] = turf.getCoord(
        turf.destination([station.lng, station.lat], metres / 1000, 0, {
            units: "kilometers",
        }),
    );
    return { latitude, longitude, at };
};
const pinFromStation = () => {
    const pin = hiderMode.get();
    if (pin === false) throw new Error("no pin");
    return (
        turf.distance(
            [station.lng, station.lat],
            [pin.longitude, pin.latitude],
            { units: "kilometers" },
        ) * 1000
    );
};

describe("the hider's pin following their GPS", () => {
    beforeEach(() => {
        hidingRadius.set(0.5);
        hidingRadiusUnits.set("kilometers");
        chosenStation.set(station);
        hiderChoosing.set(false);
        pinLocked.set(false);
        hiderMode.set({ latitude: station.lat, longitude: station.lng });
        pinDrivenElsewhere.set(null);
        pinFollowsGps.set(false);
        pinFollowsGps.set(true);
    });

    it("moves the pin to where the hider is", () => {
        expect(followPin(north(200, 1000))).toBe("moved");
        expect(pinFromStation()).toBeCloseTo(200, 0);
    });

    it("keeps it inside the zone: outside, it waits at the edge", () => {
        expect(followPin(north(900, 1000))).toBe("clamped");
        expect(pinFromStation()).toBeLessThan(500);
        expect(pinFromStation()).toBeGreaterThan(450);
    });

    it("follows at most every 15 s, and not for a few steps", () => {
        expect(followPin(north(200, 1000))).toBe("moved");
        // Each move goes to the game: not every second.
        expect(followPin(north(300, 6000))).toBe("waiting");
        expect(pinFromStation()).toBeCloseTo(200, 0);
        expect(followPin(north(300, 16_000))).toBe("moved");
        // A few metres is GPS jitter, not a move.
        expect(followPin(north(305, 40_000))).toBe("waiting");
        expect(pinFromStation()).toBeCloseTo(300, 0);
    });

    it("leaves the pin alone when off, while picking the station, or once it's fixed", () => {
        pinFollowsGps.set(false);
        expect(followPin(north(200, 1000))).toBe("off");
        pinFollowsGps.set(true);
        hiderChoosing.set(true);
        expect(followPin(north(200, 2000))).toBe("off");
        hiderChoosing.set(false);
        pinLocked.set(true);
        expect(followPin(north(200, 3000))).toBe("off");
        expect(pinFromStation()).toBeCloseTo(0, 0);
    });

    it("gives way to another hider phone moving the pin: it stops following after 30 s", () => {
        expect(followPin(north(200, 1000))).toBe("moved");
        // Dan's phone (same team) moved the pin after this one turned on.
        pinDrivenElsewhere.set({ by: "p-Dan", since: 5000 });
        expect(followPin(north(300, 20_000))).toBe("waiting");
        expect(pinFromStation()).toBeCloseTo(200, 0);
        expect(followPin(north(300, 36_000))).toBe("taken");
        expect(pinFollowsGps.get()).toBe(false);
        expect(followPin(north(300, 40_000))).toBe("off");
    });

    it("takes over when turned on after another phone moved the pin", () => {
        pinDrivenElsewhere.set({ by: "p-Dan", since: 500 });
        pinFollowsGps.set(false);
        pinFollowsGps.set(true);
        expect(followPin(north(200, 1000))).toBe("moved");
    });
});
