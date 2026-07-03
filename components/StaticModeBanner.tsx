export default function StaticModeBanner() {
  return (
    <div className="border-b border-amber-900/40 bg-amber-950/30 px-6 py-1.5 shrink-0">
      <p className="text-xs text-amber-400/90">
        Static demo mode — browsing a cached snapshot from{" "}
        <code className="text-amber-300">public/trades.json</code>. Data doesn&apos;t update live,
        and the API Explorer is unavailable.
      </p>
    </div>
  );
}
