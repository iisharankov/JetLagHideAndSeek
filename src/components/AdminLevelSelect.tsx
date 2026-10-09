import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import { mapGeoLocation } from "@/lib/context";
import { memoizeAsync } from "@/lib/memoizeAsync";
import { adminLevelLabel } from "@/maps/adminBorders";
import { findAdminLevelsAt } from "@/maps/api";

import { Select } from "./ui/select";

export type AdminLevel = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const levelsAt = memoizeAsync(findAdminLevelsAt, (lat, lng) =>
    [lat.toFixed(5), lng.toFixed(5)].join(","),
);

const capitalize = (text: string) =>
    text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Picks an admin level by the areas that actually exist at a point, e.g.
 * "Canton: Zürich", "District: Bezirk Zürich", "Municipality: Zürich".
 * Falls back to plain level names if the lookup fails.
 */
export const AdminLevelSelect = ({
    lat,
    lng,
    value,
    onChange,
    disabled,
}: {
    lat: number;
    lng: number;
    value: AdminLevel;
    onChange: (level: AdminLevel) => void;
    disabled?: boolean;
}) => {
    const country = useStore(mapGeoLocation).properties.countrycode;
    const [zones, setZones] = useState<{ level: number; name: string }[]>();

    useEffect(() => {
        let cancelled = false;
        setZones(undefined);
        levelsAt(lat, lng).then(
            (found) => !cancelled && setZones(found),
            () => !cancelled && setZones([]),
        );
        return () => {
            cancelled = true;
        };
    }, [lat, lng]);

    const label = (level: number) =>
        capitalize(adminLevelLabel(level, country));
    const options: Record<string, string> = {};

    const present = (zones ?? []).filter((z) => z.level >= 2 && z.level <= 10);
    if (present.length > 0) {
        for (const zone of present) {
            options[zone.level] = `${label(zone.level)}: ${zone.name}`;
        }
        if (!(value in options)) {
            options[value] = `${label(value)} (none here)`;
        }
    } else {
        for (let level = 2; level <= 10; level++) {
            options[level] = label(level);
        }
    }

    return (
        <Select
            trigger="Area level"
            options={options}
            value={String(value)}
            onValueChange={(level) => onChange(Number(level) as AdminLevel)}
            disabled={disabled}
        />
    );
};
