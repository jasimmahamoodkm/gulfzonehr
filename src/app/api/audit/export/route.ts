import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, action, resource_type, status, start_date, end_date, user_id } = body;

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing company_id' },
        { status: 400 }
      );
    }

    // Build query to fetch all matching logs
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', company_id);

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }
    if (resource_type) {
      query = query.eq('resource_type', resource_type);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: logs, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Log audit event for export
    if (user_id) {
      await supabase
        .from('audit_logs')
        .insert({
          user_id,
          company_id,
          action: 'export_logs',
          resource_type: 'audit_logs',
          status: 'success',
          new_values: { filter_count: logs?.length || 0 },
        });
    }

    // Generate CSV
    const headers = [
      'ID',
      'User ID',
      'Action',
      'Resource Type',
      'Resource Name',
      'Status',
      'IP Address',
      'User Agent',
      'Created At',
      'Error Message',
    ];

    const rows = (logs || []).map(log => [
      log.id,
      log.user_id || '',
      log.action,
      log.resource_type,
      log.resource_name || '',
      log.status,
      log.ip_address || '',
      log.user_agent || '',
      new Date(log.created_at).toISOString(),
      log.error_message || '',
    ]);

    // Convert to CSV
    const csv = [
      headers.join(','),
      ...rows.map(row =>
        row
          .map(cell => {
            // Escape CSV values
            const stringCell = String(cell || '');
            if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
              return `"${stringCell.replace(/"/g, '""')}"`;
            }
            return stringCell;
          })
          .join(',')
      ),
    ].join('\n');

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
