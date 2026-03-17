import { NextResponse } from 'next/server';
import { syncPeople } from '@/lib/people/sync';

export const maxDuration = 300;

export async function POST() {
  try {
    const result = await syncPeople();
    return NextResponse.json(result);
  } catch (err) {
    console.error('People sync failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
