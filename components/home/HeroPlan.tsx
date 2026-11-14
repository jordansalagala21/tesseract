// One storefront floor plan, redrawn as three possible businesses.
// Illustration only: no data from CoStar, Matterport or Vexcel is shown here.

const uses = ["a restaurant", "a clinic", "a fitness studio"];

export function HeroPlan() {
  return (
    <figure className="plan-sheet relative overflow-hidden rounded-[28px] border bg-card p-5 sm:p-8">
      <svg
        viewBox="0 0 400 300"
        className="h-auto w-full"
        aria-hidden="true"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Shell: walls, restrooms and storefront glazing stay the same in every layout */}
        <g className="stroke-[var(--plan-ink)]" strokeWidth={3}>
          <path d="M20 256 V20 H380 V256" />
          <path d="M290 20 V90 H380 M335 20 V90" strokeWidth={2} />
        </g>
        <g className="stroke-[var(--plan-ink)]" strokeWidth={1.5}>
          <path d="M20 256 H180 M220 256 H380 M20 262 H180 M220 262 H380" />
          <path d="M60 256 V262 M100 256 V262 M140 256 V262 M260 256 V262 M300 256 V262 M340 256 V262" />
          <path d="M180 256 A40 40 0 0 1 220 216 V256" strokeDasharray="3 4" />
        </g>

        {/* Restaurant and bar */}
        <g className="plan-variant plan-v1">
          <path pathLength={1} d="M60 56 H210 V96" strokeWidth={7} />
          <rect pathLength={1} x="30" y="130" width="26" height="34" rx="4" />
          <rect pathLength={1} x="30" y="180" width="26" height="34" rx="4" />
          <circle pathLength={1} cx="120" cy="168" r="15" />
          <circle pathLength={1} cx="186" cy="200" r="15" />
          <circle pathLength={1} cx="250" cy="150" r="15" />
          <circle pathLength={1} cx="320" cy="200" r="15" />
        </g>

        {/* Clinic */}
        <g className="plan-variant plan-v2">
          <path pathLength={1} d="M110 20 V110 M200 20 V110 M20 110 H50 M80 110 H140 M170 110 H230 M260 110 H290" />
          <path pathLength={1} d="M290 90 V110" />
          <path pathLength={1} d="M150 214 Q200 184 250 214" strokeWidth={7} />
          <rect pathLength={1} x="36" y="196" width="22" height="22" rx="4" />
          <rect pathLength={1} x="66" y="196" width="22" height="22" rx="4" />
          <rect pathLength={1} x="316" y="150" width="40" height="60" rx="4" />
        </g>

        {/* Fitness studio */}
        <g className="plan-variant plan-v3">
          <path pathLength={1} d="M28 36 V240" strokeWidth={6} />
          {[0, 1, 2].flatMap((col) =>
            [0, 1, 2].map((row) => (
              <rect
                key={`${col}-${row}`}
                pathLength={1}
                x={70 + col * 64}
                y={50 + row * 62}
                width="46"
                height="24"
                rx="5"
              />
            )),
          )}
          <rect pathLength={1} x="300" y="120" width="64" height="22" rx="4" />
          <rect pathLength={1} x="300" y="170" width="64" height="22" rx="4" />
        </g>
      </svg>

      <figcaption className="mt-5 flex flex-wrap items-baseline gap-x-2 text-[17px] sm:mt-6">
        <span className="text-muted-foreground">One floor plan, as</span>
        <span className="grid font-semibold" aria-hidden="true">
          {uses.map((use, i) => (
            <span key={use} className={`plan-variant plan-v${i + 1} col-start-1 row-start-1`}>
              {use}
            </span>
          ))}
        </span>
        <span className="sr-only">a restaurant, a clinic or a fitness studio.</span>
      </figcaption>
    </figure>
  );
}
