import { useEffect, useState } from "react";

/** Re-renders every `ms` while `running` (for clocks and countdowns). */
export const useTick = (running: boolean, ms = 1000) => {
    const [, setNow] = useState(Date.now());
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(timer);
    }, [running, ms]);
};
