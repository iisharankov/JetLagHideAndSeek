import { SegmentedControl } from "@/components/ui/toggle-card";
import type { Units } from "@/maps/schema";

/** km or m, for a distance typed by hand (the game is metric). */
export const UnitToggle = ({
    unit,
    onChange,
    disabled,
}: {
    unit: Units;
    onChange: (unit: Units) => void;
    disabled?: boolean;
}) => (
    <div className="w-28 shrink-0">
        <SegmentedControl<Units>
            label="Unit"
            options={[
                { value: "kilometers", label: "km" },
                { value: "meters", label: "m" },
            ]}
            value={unit}
            onValueChange={onChange}
            disabled={disabled}
        />
    </div>
);
