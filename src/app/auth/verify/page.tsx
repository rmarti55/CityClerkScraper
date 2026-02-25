import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-600 mb-6">
          We sent you a magic link to sign in. Click the link in your email to continue.
        </p>
        <div className="text-sm text-gray-500 space-y-2">
          <p>The link will expire in 24 hours.</p>
          <p>
            Didn&apos;t receive an email?{" "}
            <Link href="/" className="text-blue-600 hover:underline">
              Try again
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
