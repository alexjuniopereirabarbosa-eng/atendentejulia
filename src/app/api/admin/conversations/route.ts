import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ conversations: conversations || [] });
  } catch (err) {
    console.error('Admin conversations error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
