import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADMIN_ROLES = ['Super Admin', 'Company Admin', 'HR Manager'];

// Uploads a company logo: compresses to a 512×512 PNG saved under
// public/branding/companies/<slug>.png and records the path in
// branding.config.json → companyBranding[<company>].logo. The header, sidebar
// and payslip read that config path.
export async function POST(request: NextRequest) {
  try {
    // ── auth: must be an admin-level user ──
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(authHeader.substring(7));
    if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: roleRows } = await supabaseAdmin
      .from('user_roles').select('roles(name)').eq('user_id', user.id);
    const isAdmin = (roleRows || []).some((r: any) => ADMIN_ROLES.includes(r.roles?.name));
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // ── input ──
    const body = await request.json();
    const company: string = (body.company || '').trim();
    const image: string = body.image || ''; // data URL or bare base64
    if (!company || !image) {
      return NextResponse.json({ error: 'company and image are required' }, { status: 400 });
    }

    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const input = Buffer.from(base64, 'base64');
    if (input.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 413 });
    }

    // ── compress → 512×512 PNG (transparent letterboxing preserves aspect) ──
    let output: Buffer;
    try {
      output = await sharp(input)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9, palette: true, quality: 90 })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: 'Unsupported or corrupt image file' }, { status: 400 });
    }

    // ── save under public/branding/companies/<slug>.png ──
    const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'company';
    const dir = path.join(process.cwd(), 'public', 'branding', 'companies');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${slug}.png`), output);
    const publicPath = `/branding/companies/${slug}.png`;

    // ── record the path in branding.config.json (preserving colour) ──
    const cfgPath = path.join(process.cwd(), 'branding.config.json');
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8'));
    cfg.companyBranding = cfg.companyBranding || {};
    const existingKey = Object.keys(cfg.companyBranding).find(
      (k) => k.toLowerCase() === company.toLowerCase()
    );
    const key = existingKey || company;
    cfg.companyBranding[key] = { ...(cfg.companyBranding[key] || {}), logo: publicPath };
    if (cfg.companyBranding[key].color === undefined) cfg.companyBranding[key].color = '';
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

    return NextResponse.json({ path: publicPath, bytes: output.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
