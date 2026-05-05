import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center max-w-md mx-auto p-8">
        <h2 className="text-4xl font-bold text-white mb-4">404</h2>
        <p className="text-xl text-slate-400 mb-2">Page Not Found</p>
        <p className="text-slate-500 mb-6">The page you're looking for doesn't exist.</p>
        <Link
          href="/dashboard"
          className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}

