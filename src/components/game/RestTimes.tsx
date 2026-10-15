import { Input } from "@/components/ui/input";
import type { RestPeriod } from "@/lib/game/types";

/** From/until clock times of a rest period. */
export const RestTimes = ({
    rest,
    onChange,
}: {
    rest: RestPeriod;
    onChange: (rest: RestPeriod) => void;
}) => (
    <div className="grid grid-cols-2 gap-2" data-testid="rest-times">
        <label className="flex flex-col gap-1 text-xs">
            Rest from
            <Input
                type="time"
                aria-label="Rest from"
                value={rest.from}
                debounce={0}
                onChange={(event) => {
                    if (event.target.value) {
                        onChange({ ...rest, from: event.target.value });
                    }
                }}
            />
        </label>
        <label className="flex flex-col gap-1 text-xs">
            Until
            <Input
                type="time"
                aria-label="Rest until"
                value={rest.until}
                debounce={0}
                onChange={(event) => {
                    if (event.target.value) {
                        onChange({ ...rest, until: event.target.value });
                    }
                }}
            />
        </label>
    </div>
);
