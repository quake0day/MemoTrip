export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-blue-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-white/10 px-4 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 shadow">
            Travel expenses • Photo sharing • Local first
          </span>
          <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
            Split costs. Share memories. Keep everything under your control.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-700 dark:text-gray-300">
            MemoTrip combines household-based cost sharing, AI-ready receipt parsing, and a beautiful gallery into one self-hosted platform built for groups on the go.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/register"
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-colors"
            >
              Create an account
            </a>
            <a
              href="/login"
              className="px-6 py-3 rounded-xl border border-blue-600 text-blue-700 dark:text-blue-300 font-semibold hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
            >
              Sign in
            </a>
            <a
              href="/playground"
              className="px-6 py-3 rounded-xl bg-white/80 text-blue-700 font-semibold shadow hover:bg-white transition-colors dark:bg-white/10 dark:text-blue-200 dark:hover:bg-white/20"
            >
              Explore the API playground
            </a>
          </div>

          <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
            Running with Docker? Visit
            {' '}
            <a
              className="font-semibold underline decoration-dotted underline-offset-4"
              href="http://localhost:3001/"
            >
              http://localhost:3001
            </a>
            {' '}after the containers are ready to access the full web experience instead of the raw API endpoint.
          </p>
        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-3">
          <div className="rounded-2xl bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Household-first settlements</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              Assign adult and child weights, track who paid what, and generate minimum-transfer settlement plans with version history.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>• Weighted participants per trip</li>
              <li>• Duplicate receipt detection via hashing</li>
              <li>• One-click settlement recalculation</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Receipts &amp; photo gallery</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              Upload receipts and photos directly to your server. Preview images instantly through the secure file proxy.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>• AI-ready parsing pipeline</li>
              <li>• Local filesystem storage with hashing</li>
              <li>• Rich gallery with uploader metadata</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Exports &amp; automation ready</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              Dedicated export routes make it easy to render settlements as PNG or PDF and plug into future automation workflows.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>• Headless-friendly export templates</li>
              <li>• API-first design for integrations</li>
              <li>• Redis/BullMQ ready when you scale</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
