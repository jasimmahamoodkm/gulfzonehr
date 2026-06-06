import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Verify caller identity and return their user_id + roles
async function getCallerInfo(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Fetch roles
  const { data: rolesData } = await supabaseAdmin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id);

  const roles: string[] = rolesData?.map((r: any) => r.roles?.name).filter(Boolean) || [];

  const isHrOrAbove = roles.some(r =>
    ['Super Admin', 'Company Admin', 'HR Manager'].includes(r)
  );

  return { user, roles, isHrOrAbove };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const callerInfo = await getCallerInfo(request);
    if ('error' in callerInfo) return callerInfo.error;

    const { user, isHrOrAbove } = callerInfo;

    if (!isHrOrAbove) {
      return NextResponse.json({ error: 'Forbidden: HR Manager or above required' }, { status: 403 });
    }

    const { id: documentId } = await params;

    // Fetch the document first to verify company access and get file path
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('id, company_id, file_url, document_type, document_number')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify the caller has access to this document's company
    const { data: companyAccess } = await supabaseAdmin
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', doc.company_id)
      .maybeSingle();

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    const hasAccess =
      companyAccess !== null ||
      userRow?.company_id === doc.company_id;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: no access to this company' }, { status: 403 });
    }

    // Delete the DB record (service role bypasses RLS)
    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Delete storage file if present
    const filePath = doc.file_url;
    if (filePath) {
      let storagePath = filePath;
      if (filePath.startsWith('http')) {
        const marker = '/object/public/documents/';
        const idx = filePath.indexOf(marker);
        if (idx !== -1) storagePath = filePath.substring(idx + marker.length).split('?')[0];
      }
      if (storagePath && !storagePath.startsWith('http')) {
        await supabaseAdmin.storage.from('documents').remove([storagePath]);
        // Non-critical — don't fail the request if storage delete fails
      }
    }

    // Audit log (non-blocking)
    try {
      const { logAuditEvent, getIpAddress, getUserAgent } = await import('@/lib/audit');
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({
        user_id: user.id,
        company_id: doc.company_id,
        action: 'delete_document',
        resource_type: 'documents',
        resource_id: documentId,
        resource_name: `${doc.document_type ?? 'Document'}${doc.document_number ? ' — ' + doc.document_number : ''}`,
        status: 'success',
        ip_address: getIpAddress(hdrs),
        user_agent: getUserAgent(hdrs),
      });
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Document delete error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
