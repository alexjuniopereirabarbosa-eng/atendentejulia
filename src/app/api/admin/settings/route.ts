import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('admin_settings')
      .select('*');

    if (error) throw error;

    const result: Record<string, string> = {};
    (settings || []).forEach((s: { setting_key: string; setting_value: string }) => {
      result[s.setting_key] = s.setting_value;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Admin settings error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Update each setting
    for (const [key, value] of Object.entries(body)) {
      await supabaseAdmin
        .from('admin_settings')
        .upsert(
          { setting_key: key, setting_value: String(value), updated_at: new Date().toISOString() },
          { onConflict: 'setting_key' }
        );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin settings update error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
