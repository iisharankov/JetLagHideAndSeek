import { useStore } from "@nanostores/react";
import { useState } from "react";
import { Marker } from "react-leaflet";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    animateMapMovements,
    leafletMapContext,
    type NotePin,
    notePins,
} from "@/lib/context";
import { noteIcon } from "@/maps/markerIcon";

// A seeker's own notes on the map: places worth remembering, kept on this
// phone only (never shared, not part of the game).

export const addNotePin = (lat: number, lng: number, label = "") => {
    const note: NotePin = {
        id: crypto.randomUUID(),
        lat,
        lng,
        label,
        createdAt: Date.now(),
    };
    notePins.set([...notePins.get(), note]);
    return note;
};

const updateNote = (id: string, changes: Partial<NotePin>) =>
    notePins.set(
        notePins
            .get()
            .map((note) => (note.id === id ? { ...note, ...changes } : note)),
    );

const removeNote = (id: string) =>
    notePins.set(notePins.get().filter((note) => note.id !== id));

const goTo = (note: NotePin) => {
    const map = leafletMapContext.get();
    if (!map) return;
    if (animateMapMovements.get()) map.flyTo([note.lat, note.lng], 15);
    else map.setView([note.lat, note.lng], 15);
};

/** The note's pin on the map: drag to move, tap to name or delete it. */
export const NotePinMarker = ({ note }: { note: NotePin }) => {
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState(note.label);
    return (
        <>
            <Marker
                position={[note.lat, note.lng]}
                icon={noteIcon()}
                title={note.label || "Note"}
                alt="Note"
                draggable
                eventHandlers={{
                    dragend: (event) => {
                        const { lat, lng } = event.target.getLatLng();
                        updateNote(note.id, { lat, lng });
                    },
                    click: () => {
                        setLabel(note.label);
                        setOpen(true);
                    },
                }}
            />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                    <DialogHeader>
                        <DialogTitle>Note</DialogTitle>
                        <DialogDescription>
                            Only on this phone: the others don&apos;t see it.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="flex flex-col gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            updateNote(note.id, {
                                label: String(
                                    new FormData(event.currentTarget).get(
                                        "label",
                                    ),
                                ).slice(0, 80),
                            });
                            setOpen(false);
                        }}
                    >
                        <input
                            name="label"
                            defaultValue={label}
                            placeholder="e.g. quiet corner behind the station"
                            maxLength={80}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="submit">Save</Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    removeNote(note.id);
                                    setOpen(false);
                                }}
                            >
                                Delete note
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};

/** Questions tab: the notes, to jump back to them. */
export const NotePinList = () => {
    const $notes = useStore(notePins);
    const [open, setOpen] = useState(false);
    if ($notes.length === 0) return null;
    return (
        <details
            className="mx-2 mb-1 rounded-md border border-violet-500/50 px-2 py-1 text-sm"
            open={open}
            onToggle={(event) =>
                setOpen((event.target as HTMLDetailsElement).open)
            }
        >
            <summary className="cursor-pointer font-semibold">
                My notes ({$notes.length})
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
                {$notes.map((note) => (
                    <li key={note.id} className="flex items-center gap-2">
                        <button
                            type="button"
                            className="flex-1 truncate text-left text-blue-400 underline"
                            onClick={() => goTo(note)}
                        >
                            {note.label || "Unnamed note"}
                        </button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeNote(note.id)}
                        >
                            Delete
                        </Button>
                    </li>
                ))}
            </ul>
            <p className="mt-1 text-xs text-slate-400">
                Add one with a long press (right-click) on the map.
            </p>
        </details>
    );
};

export { Input as NoteInput };
