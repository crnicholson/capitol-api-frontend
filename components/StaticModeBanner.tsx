export default function StaticModeBanner() {
  return (
    <div className="border-b border-zinc-800 bg-zinc-900/40 px-6 py-1.5 shrink-0">
      <p className="text-xs text-zinc-400">
        Static demo mode — browsing a cached snapshot from{" "}
        <code className="text-zinc-300">public/trades.json</code>. Data doesn&apos;t update live,
        and the API Explorer is unavailable.
      </p>
    </div>
  );
}
