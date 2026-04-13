import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { data: assets, error } = await supabaseAdmin
      .from('assistant_assets')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ assets: assets || [] });
  } catch (err) {
    console.error('Admin assets error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { asset_type, asset_url } = await req.json();

    if (!asset_type || !asset_url) {
      return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 });
    }

    // If avatar, update existing or create
    if (asset_type === 'avatar') {
      const { data: existing } = await supabaseAdmin
        .from('assistant_assets')
        .select('id')
        .eq('asset_type', 'avatar')
        .single();

      if (existing) {
        await supabaseAdmin
          .from('assistant_assets')
          .update({ asset_url })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('assistant_assets')
          .insert({ asset_type, asset_url, sort_order: 0 });
      }
    } else if (asset_type === 'paid_image') {
      // Check max 2 paid images
      const { data: existing } = await supabaseAdmin
        .from('assistant_assets')
        .select('id')
        .eq('asset_type', 'paid_image');

      if (existing && existing.length >= 2) {
        return NextResponse.json({ error: 'Máximo de 2 imagens pagas' }, { status: 400 });
      }

      await supabaseAdmin
        .from('assistant_assets')
        .insert({
          asset_type,
          asset_url,
          sort_order: (existing?.length || 0) + 1,
        });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin asset save error:', err);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
