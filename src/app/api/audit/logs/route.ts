import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ITEMS_PER_PAGE = 50;

export async function GET(request: NextRequest) {
  try {
    const company_id = request.nextUrl.searchParams.get('company_id');
    const action = request.nextUrl.searchParams.get('action');
    const resource_type = request.nextUrl.searchParams.get('resource_type');
    const status = request.nextUrl.searchParams.get('status');
    const start_date = request.nextUrl.searchParams.get('start_date');
    const end_date = request.nextUrl.searchParams.get('end_date');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing company_id' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
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

    // Pagination
    const offset = (page - 1) * ITEMS_PER_PAGE;
    query = query.order('created_at', { ascending: false }).range(offset, offset + ITEMS_PER_PAGE - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);

    return NextResponse.json({
      success: true,
      logs: data || [],
      pagination: {
        page,
        per_page: ITEMS_PER_PAGE,
        total: count || 0,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
