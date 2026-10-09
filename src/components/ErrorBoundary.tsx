import {
    Component,
    type ComponentType,
    type ErrorInfo,
    type ReactNode,
} from "react";

interface Props {
    /** Shown to the player, e.g. "question sidebar". */
    name: string;
    /**
     * Saved settings (localStorage keys) that could keep the panel crashing
     * after a reload; offered as "Reset settings".
     */
    resetKeys?: string[];
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/** Keeps a crash in one panel from blanking it with no explanation. */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`The ${this.props.name} crashed:`, error, info);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div
                role="alert"
                className="m-2 rounded-md border border-red-500 bg-slate-900 p-3 text-sm text-slate-50"
            >
                <p className="font-semibold">
                    The {this.props.name} ran into a problem.
                </p>
                <p className="mt-1 break-words text-slate-300">
                    {error.message}
                </p>
                <div className="mt-2 flex gap-2">
                    <button
                        className="rounded bg-slate-700 px-2 py-1"
                        onClick={() => this.setState({ error: null })}
                    >
                        Try again
                    </button>
                    <button
                        className="rounded bg-blue-600 px-2 py-1"
                        onClick={() => window.location.reload()}
                    >
                        Reload
                    </button>
                    {this.props.resetKeys && (
                        <button
                            className="rounded bg-amber-700 px-2 py-1"
                            onClick={() => {
                                for (const key of this.props.resetKeys!) {
                                    try {
                                        localStorage.removeItem(key);
                                    } catch {
                                        // Storage blocked: the reload still helps.
                                    }
                                }
                                window.location.reload();
                            }}
                        >
                            Reset its settings
                        </button>
                    )}
                </div>
                {this.props.resetKeys && (
                    <p className="mt-2 text-xs text-slate-400">
                        If it keeps happening, &ldquo;Reset its settings&rdquo;
                        puts this panel&apos;s options back to the defaults.
                        Your questions are kept.
                    </p>
                )}
            </div>
        );
    }
}

export const withErrorBoundary = <P extends object>(
    Wrapped: ComponentType<P>,
    name: string,
    resetKeys?: string[],
) => {
    const Bounded = (props: P) => (
        <ErrorBoundary name={name} resetKeys={resetKeys}>
            <Wrapped {...props} />
        </ErrorBoundary>
    );
    Bounded.displayName = `withErrorBoundary(${Wrapped.displayName ?? Wrapped.name})`;
    return Bounded;
};
