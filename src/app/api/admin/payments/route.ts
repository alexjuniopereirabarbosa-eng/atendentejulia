import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ payments: payments || [] });
  } catch (err) {
    console.error('Admin payments error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
