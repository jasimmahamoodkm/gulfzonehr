// Effective compensation resolution.
//
// Salary and benefits are normally grade-driven, but a promotion / demotion
// request can attach PER-EMPLOYEE overrides (employees.salary_override and the
// employee_benefit_overrides table). These helpers resolve the effective
// values: an override is always preferred over the grade default.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BenefitRow {
  id: string;
  benefit_type: string;
  benefit_value: number;
  value_type: string;       // 'fixed' | 'percentage'
  currency: string;
  active: boolean;
}

/**
 * Effective basic salary for an employee:
 *   salary_override (if set)  →  latest grade_salary_config  →  0
 */
export async function getEffectiveSalary(
  supabase: SupabaseClient,
  opts: { salaryOverride?: number | null; gradeId: string | null }
): Promise<number> {
  if (opts.salaryOverride != null) return Number(opts.salaryOverride);
  if (!opts.gradeId) return 0;
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('grade_salary_config')
    .select('salary')
    .eq('grade_id', opts.gradeId)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .limit(1);
  return data?.[0]?.salary ?? 0;
}

/**
 * Merged benefit list for an employee: the grade's active benefits, with
 * per-employee overrides applied on top (an override with active=false
 * suppresses a grade benefit; active=true adds or replaces one).
 */
export async function getMergedBenefits(
  supabase: SupabaseClient,
  employeeId: string,
  gradeId: string | null
): Promise<BenefitRow[]> {
  const base = gradeId
    ? ((await supabase
        .from('grade_benefits')
        .select('id,benefit_type,benefit_value,value_type,currency,active')
        .eq('grade_id', gradeId)
        .eq('active', true)
        .order('benefit_type')).data ?? [])
    : [];

  const { data: overrides } = await supabase
    .from('employee_benefit_overrides')
    .select('id,benefit_type,benefit_value,value_type,currency,active')
    .eq('employee_id', employeeId);

  const map = new Map<string, BenefitRow>();
  for (const b of base as BenefitRow[]) map.set(b.benefit_type, b);
  for (const o of (overrides ?? []) as BenefitRow[]) {
    if (o.active === false) map.delete(o.benefit_type);   // suppress
    else map.set(o.benefit_type, { ...o, currency: o.currency || 'AED' });
  }
  return Array.from(map.values()).sort((a, b) => a.benefit_type.localeCompare(b.benefit_type));
}
