"use client";

import { useState, useEffect } from "react";

interface LatestBusinessCardProps {
  committeeSlug: string;
  committeeName: string;
}

interface SummaryData {
  summary: string;
  generatedAt: string;
  model: string;
  cached: boolean;
}

export function LatestBusinessCard({ committeeSlug, committeeName }: LatestBusinessCardProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSummary = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const url = `/api/committees/${committeeSlug}/summary${refresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [committeeSlug]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-6 bg-gray-200 rounded w-40" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
        <div className="mt-4 h-3 bg-gray-100 rounded w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Unable to load summary</span>
        </div>
        <p className="text-sm text-gray-600 mb-3">{error}</p>
        <button
          onClick={() => fetchSummary()}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Latest Business</h2>
        </div>
        <button
          onClick={() => fetchSummary(true)}
          disabled={isRefreshing}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 disabled:opacity-50"
          title="Refresh summary"
        >
          <svg 
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRefreshing ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {data && (
        <>
          <div className="prose prose-sm prose-gray max-w-none">
            {data.summary.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-gray-700 leading-relaxed mb-3 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-indigo-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Updated {formatDate(data.generatedAt)}
              {data.cached && ' (cached)'}
            </span>
            <span className="text-indigo-400">
              AI-generated summary
            </span>
          </div>
        </>
      )}
    </div>
  );
}
