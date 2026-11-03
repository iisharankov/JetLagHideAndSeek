/** A titled box in the Menu. */
export const MenuGroup = ({
    title,
    children,
    tutorialId,
}: {
    title: string;
    children: React.ReactNode;
    /** For the tutorial to point at. */
    tutorialId?: string;
}) => (
    <section
        className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3"
        data-tutorial-id={tutorialId}
    >
        <h3 className="text-sm font-semibold font-poppins text-slate-200">
            {title}
        </h3>
        {children}
    </section>
);
