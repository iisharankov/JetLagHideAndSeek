/**
 * The question can't be asked at its location, for example a "district"
 * zone question in a canton that has no districts. It's reported as "not
 * applicable" rather than as an error, and eliminates nothing.
 */
export class NotApplicableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotApplicableError";
    }
}

export const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
