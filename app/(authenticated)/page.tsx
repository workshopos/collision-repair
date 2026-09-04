export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c0522e]">
          Workshop overview
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#202c2b] sm:text-5xl">
          The day starts here.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[#5d6864]">
          Your operational workspace is ready for the next repair decision.
        </p>
      </div>
      <div className="mt-12 grid gap-4 border-t border-[#d8d0c4] pt-6 sm:grid-cols-3">
        <div className="border-l-2 border-[#e1a84b] pl-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[#7c8780]">
            Shell status
          </p>
          <p className="mt-2 font-serif text-2xl">Online</p>
        </div>
        <div className="border-l-2 border-[#c0522e] pl-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[#7c8780]">
            Workspace
          </p>
          <p className="mt-2 font-serif text-2xl">Active</p>
        </div>
        <div className="border-l-2 border-[#6f8f78] pl-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[#7c8780]">
            Next action
          </p>
          <p className="mt-2 font-serif text-2xl">Review queue</p>
        </div>
      </div>
    </div>
  );
}