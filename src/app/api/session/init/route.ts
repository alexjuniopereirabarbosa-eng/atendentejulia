import { NextResponse } from 'next/server';

/**
 * Session init — stateless version.
 *
 * This endpoint no longer creates any DB record or saves any conversation.
 * The frontend uses it only to confirm the server is reachable and get a
 * fresh session token for the current page load.
 *
 * All conversation history lives exclusively in the React/Zustand store
 * in the browser and is discarded when the page is closed or refreshed.
 */
export async function POST() {
  return NextResponse.json({
    ok: true,
    sessionId: crypto.randomUUID(),
  });
}
