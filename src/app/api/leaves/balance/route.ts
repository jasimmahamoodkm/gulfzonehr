import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id, year } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: 'Missing employee_id' },
        { status: 400 }
      );
    }

    const currentYear = year || new Date().getFullYear();

    // Get leave balances for employee
    const { data: balances, error: balanceError } = await supabase
      .from('employee_leave_balance')
      .select(`
        id,
        employee_id,
        leave_type_id,
        year,
        total_days,
        used_days,
        pending_days,
        remaining_days,
        last_updated,
        leave_types(name, color)
      `)
      .eq('employee_id', employee_id)
      .eq('year', currentYear);

    if (balanceError) throw balanceError;

    // Transform response
    const formattedBalances = (balances || []).map(balance => ({
      id: balance.id,
      employee_id: balance.employee_id,
      leave_type_id: balance.leave_type_id,
      leave_type_name: (balance.leave_types as any)?.name,
      leave_type_color: (balance.leave_types as any)?.color,
      year: balance.year,
      total_days: balance.total_days,
      used_days: balance.used_days,
      pending_days: balance.pending_days,
      remaining_days: balance.remaining_days,
      usage_percentage: Math.round((balance.used_days / balance.total_days) * 100),
      last_updated: balance.last_updated,
    }));

    return NextResponse.json({
      success: true,
      balances: formattedBalances,
      year: currentYear,
      total_remaining: formattedBalances.reduce((sum, b) => sum + b.remaining_days, 0),
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave balance' },
      { status: 500 }
    );
  }
}
