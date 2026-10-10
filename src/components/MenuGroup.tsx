/** A titled box in the Menu. */
export const MenuGroup = ({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) => (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3">
        <h3 className="text-sm font-semibold font-poppins text-slate-200">
            {title}
        </h3>
        {children}
    </section>
);
