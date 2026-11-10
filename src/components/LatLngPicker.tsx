import { useStore } from "@nanostores/react";
import {
    ClipboardCopyIcon,
    ClipboardPasteIcon,
    LocateIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/useDebounce";
import { busy, isLoading } from "@/lib/context";
import { describeGeoError, locate } from "@/lib/geolocation";
import { cn } from "@/lib/utils";
import { determineName, geocode, ICON_COLORS } from "@/maps/api";

import { Button } from "./ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "./ui/command";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./ui/dialog";
import { SidebarMenuItem } from "./ui/sidebar-l";

const parseCoordinatesFromText = (
    text: string,
): { lat: number | null; lng: number | null } => {
    // Format: decimal degrees (e.g., 37.7749, -122.4194 or 37,7749, -122,4194)
    const decimalPattern = /(-?\d+[.,]\d+)\s*,\s*(-?\d+[.,]\d+)/;

    // Format: degrees, minutes, seconds (e.g., 37°46'26"N, 122°25'10"W)
    const dmsPattern =
        /(\d+)°\s*(\d+)['′]?\s*(?:(\d+(?:\.\d+)?)["″]?\s*)?([NS])[,\s]+(\d+)°\s*(\d+)['′]?\s*(?:(\d+(?:\.\d+)?)["″]?\s*)?([EW])/i;

    // Format: decimal degrees with cardinal directions (e.g., 48,89607° N, 9,09885° E or 48.89607° N, 9.09885° E)
    const decimalCardinalPattern =
        /(\d+[.,]\d+)°\s*([NS])\s*,\s*(\d+[.,]\d+)°\s*([EW])/i;

    const decimalMatch = text.match(decimalPattern);
    if (decimalMatch) {
        return {
            lat: parseFloat(decimalMatch[1].replace(",", ".")),
            lng: parseFloat(decimalMatch[2].replace(",", ".")),
        };
    }

    const dmsMatch = text.match(dmsPattern);
    if (dmsMatch) {
        let lat =
            parseInt(dmsMatch[1]) +
            parseInt(dmsMatch[2]) / 60 +
            (parseFloat(dmsMatch[3]) || 0) / 3600;
        let lng =
            parseInt(dmsMatch[5]) +
            parseInt(dmsMatch[6]) / 60 +
            (parseFloat(dmsMatch[7]) || 0) / 3600;

        if (dmsMatch[4].toUpperCase() === "S") lat = -lat;
        if (dmsMatch[8].toUpperCase() === "W") lng = -lng;

        return { lat, lng };
    }

    const decimalCardinalMatch = text.match(decimalCardinalPattern);
    if (decimalCardinalMatch) {
        let lat = parseFloat(decimalCardinalMatch[1].replace(",", "."));
        let lng = parseFloat(decimalCardinalMatch[3].replace(",", "."));

        if (decimalCardinalMatch[2].toUpperCase() === "S") lat = -lat;
        if (decimalCardinalMatch[4].toUpperCase() === "W") lng = -lng;

        return { lat, lng };
    }

    return { lat: null, lng: null };
};

const LatLngEditForm = ({
    latitude,
    longitude,
    onChange,
    disabled,
}: {
    latitude: number;
    longitude: number;
    onChange: (lat: number | null, lng: number | null) => void;
    disabled?: boolean;
}) => {
    const [inputValue, setInputValue] = useState("");
    const debouncedValue = useDebounce<string>(inputValue);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (debouncedValue === "") {
            setResults([]);
            return;
        } else {
            setLoading(true);
            setResults([]);
            geocode(debouncedValue, "en", false)
                .then((x) => {
                    setResults(x);
                    setLoading(false);
                })
                .catch(() => {
                    setError(true);
                    setLoading(false);
                });
        }
    }, [debouncedValue]);

    const _latlngLabels = results.map((r) => determineName(r));
    const _latlngLabelCounts: Record<string, number> = {};
    _latlngLabels.forEach((l) => {
        _latlngLabelCounts[l] = (_latlngLabelCounts[l] || 0) + 1;
    });
    const _latlngLabelByKey: Record<string, string> = {};
    const _latlngOcc: Record<string, number> = {};
    results.forEach((r) => {
        const key = `${r.properties.osm_id}${r.properties.name}`;
        const lbl = determineName(r);
        const idx = (_latlngOcc[lbl] = (_latlngOcc[lbl] || 0) + 1);
        _latlngLabelByKey[key] =
            _latlngLabelCounts[lbl] > 1 ? `${lbl} (${idx})` : lbl;
    });

    return (
        <>
            <Command shouldFilter={false}>
                <CommandInput
                    placeholder="Search place..."
                    onKeyUp={(x) => setInputValue(x.currentTarget.value)}
                    disabled={disabled}
                />
                <CommandList>
                    <CommandEmpty>
                        {loading
                            ? "Loading..."
                            : error
                              ? "Error loading places."
                              : "No locations found."}
                    </CommandEmpty>
                    <CommandGroup>
                        {results.map((result) => (
                            <CommandItem
                                key={`${result.properties.osm_id}${result.properties.name}`}
                                onSelect={() => {
                                    const coords = result.geometry.coordinates;
                                    onChange(coords[0], coords[1]);
                                }}
                                className="cursor-pointer"
                            >
                                {(() => {
                                    const _key = `${result.properties.osm_id}${result.properties.name}`;
                                    return (
                                        _latlngLabelByKey[_key] ||
                                        determineName(result)
                                    );
                                })()}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
            <div className="flex gap-2 items-center">
                <Label className="min-w-16">Latitude</Label>
                <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    // Six decimals: about 10 cm, and readable.
                    value={Number(Math.abs(latitude).toFixed(6))}
                    min={0}
                    max={90}
                    onChange={(e) => {
                        if (isNaN(parseFloat(e.target.value))) return;
                        onChange(
                            parseFloat(e.target.value) *
                                (latitude !== 0 ? Math.sign(latitude) : -1),
                            null,
                        );
                    }}
                    disabled={disabled}
                />
                <Button
                    variant="outline"
                    onClick={() => onChange(-latitude, null)}
                    disabled={disabled}
                >
                    {latitude > 0 ? "N" : "S"}
                </Button>
            </div>
            <div className="flex gap-2 items-center">
                <Label className="min-w-16">Longitude</Label>
                <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={Number(Math.abs(longitude).toFixed(6))}
                    min={0}
                    max={180}
                    onChange={(e) => {
                        if (isNaN(parseFloat(e.target.value))) return;
                        onChange(
                            null,
                            parseFloat(e.target.value) *
                                (longitude !== 0 ? Math.sign(longitude) : -1),
                        );
                    }}
                    disabled={disabled}
                />
                <Button
                    variant="outline"
                    onClick={() => onChange(null, -longitude)}
                    disabled={disabled}
                >
                    {longitude > 0 ? "E" : "W"}
                </Button>
            </div>
        </>
    );
};

/** "47.35650° N, 8.54359° E". */
const coordinatesText = (latitude: number, longitude: number) =>
    `${Math.abs(latitude).toFixed(5)}° ${latitude > 0 ? "N" : "S"}, ${Math.abs(
        longitude,
    ).toFixed(5)}° ${longitude > 0 ? "E" : "W"}`;

/**
 * A question's place: one row with the pin's colour, the coordinates and
 * Change, which opens Use my location, the typed coordinates, Paste and
 * Copy (round 40: one control instead of three small buttons).
 * With `inlineEdit` (the hider pin's popup, drawn points) the editor is
 * shown straight away.
 */
export const LatitudeLongitude = ({
    latitude,
    longitude,
    onChange,
    label = "Location",
    colorName,
    disabled,
    inlineEdit = false,
    readOnly = false,
}: {
    latitude: number;
    longitude: number;
    onChange: (lat: number | null, lng: number | null) => void;
    label?: string;
    colorName?: keyof typeof ICON_COLORS;
    className?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    inlineEdit?: boolean;
    /** A statement, not a control: coordinates and copy only. */
    readOnly?: boolean;
}) => {
    const $isLoading = useStore(isLoading);
    const color = colorName ? ICON_COLORS[colorName] : "transparent";

    const locateMe = () => {
        const done = busy.begin();
        toast.promise(
            locate()
                .then((position) => {
                    onChange(
                        position.coords.latitude,
                        position.coords.longitude,
                    );
                })
                .finally(done),
            {
                pending: "Getting your location…",
                success: { render: "Location set", autoClose: 500 },
                error: {
                    render: ({ data }) => describeGeoError(data),
                    autoClose: 12000,
                },
            },
        );
    };

    const paste = () => {
        if (!navigator?.clipboard) {
            toast.error("Clipboard API not supported in your browser");
            return;
        }
        const done = busy.begin();
        toast.promise(
            navigator.clipboard
                .readText()
                .then((text) => {
                    const coords = parseCoordinatesFromText(text);
                    if (coords.lat !== null && coords.lng !== null) {
                        onChange(coords.lat, coords.lng);
                        return;
                    }
                    throw new Error(
                        "Could not find coordinates in clipboard content",
                    );
                })
                .finally(done),
            {
                pending: "Reading from clipboard",
                success: "Coordinates set from clipboard",
                error: "No valid coordinates found in clipboard",
            },
            { autoClose: 1000 },
        );
    };

    const copy = () => {
        if (!navigator?.clipboard) {
            toast.error("Clipboard API not supported in your browser");
            return;
        }
        toast.promise(
            navigator.clipboard.writeText(coordinatesText(latitude, longitude)),
            {
                pending: "Copying…",
                success: "Coordinates copied",
                error: "Couldn't copy the coordinates",
            },
            { autoClose: 1000 },
        );
    };

    if (inlineEdit) {
        return (
            <SidebarMenuItem
                className={cn(
                    "mt-2 space-y-2 rounded-md p-2",
                    $isLoading && "brightness-50",
                )}
                style={{ backgroundColor: color }}
            >
                <LatLngEditForm
                    latitude={latitude}
                    longitude={longitude}
                    onChange={onChange}
                    disabled={disabled}
                />
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        onClick={locateMe}
                        disabled={disabled}
                        title="Set to current location"
                    >
                        <LocateIcon />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={paste}
                        disabled={disabled}
                        title="Paste coordinates from clipboard"
                    >
                        <ClipboardPasteIcon />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={copy}
                        title="Copy coordinates"
                    >
                        <ClipboardCopyIcon />
                    </Button>
                </div>
            </SidebarMenuItem>
        );
    }

    const title = label === "Location" ? "Asked from" : label;
    return (
        <SidebarMenuItem
            className={cn("px-3 py-1.5", $isLoading && "brightness-50")}
            data-testid="question-location"
        >
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {title}
            </p>
            <div className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3">
                <span
                    className="h-4 w-4 shrink-0 rounded-full border-2 border-white/60"
                    style={{ backgroundColor: color }}
                    aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm tabular-nums font-oxygen">
                    {coordinatesText(latitude, longitude)}
                </span>
                {readOnly ? (
                    <button
                        type="button"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 md:h-9 md:w-9 [&>svg]:h-5 [&>svg]:w-5"
                        onClick={copy}
                        title="Copy coordinates"
                        aria-label="Copy coordinates"
                    >
                        <ClipboardCopyIcon />
                    </button>
                ) : (
                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-blue-300 hover:bg-white/10 disabled:opacity-50"
                                disabled={disabled}
                                title="Move it: your location, typed or pasted coordinates"
                            >
                                Change ›
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="text-2xl">
                                    {title}
                                </DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground">
                                Or drag the pin on the map.
                            </p>
                            <DialogClose asChild>
                                <Button
                                    className="h-12 text-base"
                                    onClick={locateMe}
                                    disabled={disabled}
                                    title="Set to current location"
                                >
                                    <LocateIcon /> Use my location
                                </Button>
                            </DialogClose>
                            <LatLngEditForm
                                latitude={latitude}
                                longitude={longitude}
                                onChange={onChange}
                                disabled={disabled}
                            />
                            <DialogFooter className="grid grid-cols-2 gap-2 sm:grid">
                                <Button
                                    variant="outline"
                                    onClick={paste}
                                    disabled={disabled}
                                >
                                    <ClipboardPasteIcon /> Paste
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={copy}
                                    title="Copy coordinates"
                                >
                                    <ClipboardCopyIcon /> Copy
                                </Button>
                                <DialogClose asChild>
                                    <Button className="col-span-2">Done</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </SidebarMenuItem>
    );
};
