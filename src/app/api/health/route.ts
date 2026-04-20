import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) || 'NOT SET',
  });
}
