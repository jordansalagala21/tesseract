// OWNER: Developer 3 — placeholder only. The real homepage (Property / Capital / Idea entry points) is UI-01.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-24 sm:px-8">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">HackPrinceton 2026 · CoStar track</p>
      <h1 className="text-4xl font-semibold tracking-tight">Tesseract</h1>
      <p className="text-lg text-muted-foreground">Discover what spaces could become.</p>
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Scaffold only. See <code>CLAUDE.md</code> and <code>docs/</code> for the plan; API routes return
        <code> 501 Not Implemented</code> until their issues land.
      </div>
    </main>
  );
}
