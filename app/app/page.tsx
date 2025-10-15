export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            MemoTrip
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Track expenses and share memories with your travel companions
          </p>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">Expense Splitting</h2>
              <p className="text-gray-600 dark:text-gray-300">
                AI-powered receipt parsing and fair expense splitting with configurable household weights
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">Photo Gallery</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Share trip photos with EXIF metadata and timeline organization
              </p>
            </div>
          </div>

          <div className="mt-12 flex gap-4 justify-center">
            <a
              href="/register"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </a>
            <a
              href="/login"
              className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
