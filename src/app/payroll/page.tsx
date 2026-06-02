'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { Plus, Download, Calendar, Info, Plane, Users, CheckCircle, XCircle, SkipForward, Trash2 } from 'lucide-react';

// ── Universal month/year selector (works in all browsers) ──────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const MonthSelect: React.FC<{ value: string; onChange: (v: string) => void; className?: string }> = ({ value, onChange, className = '' }) => {
  const [y, m] = value ? value.split('-') : [String(new Date().getFullYear()), String(new Date().getMonth() + 1).padStart(2,'0')];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const update = (newY: string, newM: string) => onChange(`${newY}-${newM.padStart(2,'0')}`);
  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={m}
        onChange={e => update(y, e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
      >
        {MONTHS.map((name, idx) => (
          <option key={idx} value={String(idx + 1).padStart(2,'0')}>{name}</option>
        ))}
      </select>
      <select
        value={y}
        onChange={e => update(e.target.value, m)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
      >
        {years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
};
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  grade_id: string | null;
}

interface BenefitLine {
  id: string;
  benefit_type: string;
  benefit_value: number;
  value_type: 'fixed' | 'percentage';
  currency: string;
  computed_amount: number;
  included: boolean;
  reason_excluded?: string;
}

interface BatchResult {
  employee_id: string;
  employee_name: string;
  status: 'processed' | 'skipped' | 'error' | 'no_grade';
  net_pay?: number;
  reason?: string;
}

interface LeaveBalanceLine {
  leave_type_id: string;
  leave_type_name: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  excess_days: number;
}

const PayrollPage: React.FC = () => {
  const { selectedCompany } = useCompany();

  // List state
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState(new Date().toISOString().substring(0, 7));
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [benefitLines, setBenefitLines] = useState<BenefitLine[]>([]);
  const [deductions, setDeductions] = useState<number>(0);
  const [loadingBenefits, setLoadingBenefits] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceLine[]>([]);
  const [monthLeaves, setMonthLeaves] = useState<{ leave_type: string; days: number; status: string; start_date: string; end_date: string }[]>([]);
  const [leaveDeductionDays, setLeaveDeductionDays] = useState<number>(0);
  const [leaveDeductionUnauthorized, setLeaveDeductionUnauthorized] = useState<number>(0);
  const [leaveDeductionAmount, setLeaveDeductionAmount] = useState<number>(0);

  // Payslip state
  const [showPayslip, setShowPayslip] = useState(false);
  const [payslipRecord, setPayslipRecord] = useState<any | null>(null);
  const [payslipLines, setPayslipLines] = useState<BenefitLine[]>([]);
  const [loadingPayslip, setLoadingPayslip] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [payslipLeaveBalances, setPayslipLeaveBalances] = useState<LeaveBalanceLine[]>([]);

  // Batch payroll state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchMonth, setBatchMonth] = useState(new Date().toISOString().substring(0, 7));
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchDone, setBatchDone] = useState(false);

  // Derived values
  const isJune = (month: string) => month.endsWith('-06');
  const isJanuary = (month: string) => month.endsWith('-01');

  const totalAllowances = benefitLines
    .filter(b => b.included)
    .reduce((sum, b) => sum + b.computed_amount, 0);

  const netPay = basicSalary + totalAllowances - deductions - leaveDeductionAmount;

  // ── Data fetching ──────────────────────────────────────────────

  const fetchPayroll = useCallback(async () => {
    if (!selectedCompany) { setPayrollData([]); return; }
    try {
      setLoading(true);

      const { data: empData } = await supabase
        .from('employees')
        .select('id,first_name,last_name,position,grade_id')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'Active');
      setEmployees(empData || []);

      const empIds = (empData || []).map((e: any) => e.id);
      if (empIds.length === 0) { setPayrollData([]); return; }

      const { data: payData, error } = await supabase
        .from('payroll')
        .select('id,employee_id,month,salary,bonus,deductions,net_pay,status,created_at')
        .in('employee_id', empIds)
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayrollData(payData || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load payroll records' });
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, selectedMonth]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  // Load benefits whenever employee or month changes in modal
  useEffect(() => {
    if (!selectedEmployeeId) {
      setBasicSalary(0);
      setBenefitLines([]);
      return;
    }
    loadEmployeeBenefits(selectedEmployeeId, selectedPayrollMonth);
  }, [selectedEmployeeId, selectedPayrollMonth]);

  // ── Shared helper: fetch leave balances for an employee+year ──────
  // Reads actual approved leaves from the `leaves` table directly (not used_days
  // from employee_leave_balance which can be stale). Quota comes from
  // employee_leave_balance.total_days.
  const fetchLeaveBalances = async (employeeId: string, year: number): Promise<LeaveBalanceLine[]> => {
    // Quota per leave type (total_days)
    const { data: quotaData } = await supabase
      .from('employee_leave_balance')
      .select('leave_type_id, total_days, leave_types(name)')
      .eq('employee_id', employeeId)
      .eq('year', year);

    // Approved leave days for this year grouped by leave_type name
    const { data: approvedLeaves } = await supabase
      .from('leaves')
      .select('leave_type, days')
      .eq('employee_id', employeeId)
      .eq('status', 'Approved')
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`);

    // Build: leave_type_name (lower) → total approved days
    const approvedByType: Record<string, number> = {};
    (approvedLeaves || []).forEach((l: any) => {
      const key = (l.leave_type ?? '').toLowerCase();
      approvedByType[key] = (approvedByType[key] || 0) + (l.days || 0);
    });

    // Merge quota rows with actual approved days (case-insensitive name match)
    const lines: LeaveBalanceLine[] = (quotaData || []).map((row: any) => {
      const name = row.leave_types?.name ?? '';
      const used = approvedByType[name.toLowerCase()] ?? 0;
      const total = row.total_days ?? 0;
      return {
        leave_type_id: row.leave_type_id,
        leave_type_name: name,
        total_days: total,
        used_days: used,
        pending_days: 0,
        remaining_days: Math.max(0, total - used),
        excess_days: Math.max(0, used - total),
      };
    });

    // Add any leave types from the leaves table that have no quota entry
    const knownNames = new Set(lines.map(l => l.leave_type_name.toLowerCase()));
    Object.entries(approvedByType).forEach(([key, used]) => {
      if (!knownNames.has(key)) {
        lines.push({
          leave_type_id: key,
          leave_type_name: key.charAt(0).toUpperCase() + key.slice(1),
          total_days: 0,
          used_days: used,
          pending_days: 0,
          remaining_days: 0,
          excess_days: used, // all excess — no quota configured
        });
      }
    });

    return lines;
  };

  // ── Fetch leaves for a specific payroll month (for modal display) ──
  const fetchMonthLeaves = async (employeeId: string, month: string) => {
    const [y, m] = month.split('-');
    const monthStart = `${y}-${m}-01`;
    const monthEnd = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('leaves')
      .select('leave_type, days, status, start_date, end_date')
      .eq('employee_id', employeeId)
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd)
      .order('start_date');

    return (data || []) as { leave_type: string; days: number; status: string; start_date: string; end_date: string }[];
  };

  // ── Shared helper: compute leave deduction for a payroll month ──
  // Deduction is scoped to the specific payroll month only.
  // Excess = approved leaves THIS month that exceed remaining annual quota.
  // Unauthorized = non-approved leaves THIS month.
  const computeLeaveDeduction = async (
    employeeId: string,
    month: string,
    monthlySalary: number,
    monthlyAllowances: number,
  ): Promise<{ excessDays: number; unauthorizedDays: number; deductionAmount: number }> => {
    const year = parseInt(month.split('-')[0]);
    const [y, m] = month.split('-');
    const monthStart = `${y}-${m}-01`;
    const monthEnd  = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0];

    // All leaves starting in this payroll month
    const { data: monthLeavesRaw } = await supabase
      .from('leaves')
      .select('leave_type, days, status')
      .eq('employee_id', employeeId)
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    if (!monthLeavesRaw || monthLeavesRaw.length === 0) {
      return { excessDays: 0, unauthorizedDays: 0, deductionAmount: 0 };
    }

    // Split into approved vs unauthorized for this month
    const approvedThisMonth: Record<string, number> = {};
    let unauthorizedDays = 0;
    monthLeavesRaw.forEach((l: any) => {
      if (l.status === 'Approved') {
        const key = (l.leave_type ?? '').toLowerCase();
        approvedThisMonth[key] = (approvedThisMonth[key] || 0) + (l.days || 0);
      } else if (l.status !== 'Cancelled') {
        unauthorizedDays += l.days || 0;
      }
    });

    // Approved leaves taken BEFORE this month (to calculate remaining quota)
    const prevMonthEnd = new Date(parseInt(y), parseInt(m) - 1, 0).toISOString().split('T')[0];
    const { data: prevLeaves } = await supabase
      .from('leaves')
      .select('leave_type, days')
      .eq('employee_id', employeeId)
      .eq('status', 'Approved')
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', prevMonthEnd);

    const approvedBefore: Record<string, number> = {};
    (prevLeaves || []).forEach((l: any) => {
      const key = (l.leave_type ?? '').toLowerCase();
      approvedBefore[key] = (approvedBefore[key] || 0) + (l.days || 0);
    });

    // Annual quotas from employee_leave_balance
    const { data: quotaData } = await supabase
      .from('employee_leave_balance')
      .select('total_days, leave_types(name)')
      .eq('employee_id', employeeId)
      .eq('year', year);

    const quotaByType: Record<string, number> = {};
    (quotaData || []).forEach((row: any) => {
      const key = (row.leave_types?.name ?? '').toLowerCase();
      quotaByType[key] = row.total_days ?? 0;
    });

    // Excess = approved days in this month beyond remaining quota
    let excessDays = 0;
    Object.entries(approvedThisMonth).forEach(([type, taken]) => {
      const quota = quotaByType[type] ?? 0;
      const usedBefore = approvedBefore[type] ?? 0;
      const remainingQuota = Math.max(0, quota - usedBefore);
      excessDays += Math.max(0, taken - remainingQuota);
    });

    const dailyWage = (monthlySalary + monthlyAllowances) / 30;
    const deductionAmount = Math.round((excessDays + unauthorizedDays) * dailyWage * 100) / 100;

    return { excessDays, unauthorizedDays, deductionAmount };
  };

  const loadEmployeeBenefits = async (employeeId: string, month: string) => {
    setLoadingBenefits(true);
    setModalError(null);
    setLeaveBalances([]);
    setMonthLeaves([]);
    setLeaveDeductionDays(0);
    setLeaveDeductionUnauthorized(0);
    setLeaveDeductionAmount(0);
    try {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp?.grade_id) {
        setBasicSalary(0);
        setBenefitLines([]);
        setModalError('This employee has no grade assigned. Assign a grade first to auto-calculate payroll.');
        return;
      }

      // Fetch grade salary
      const today = new Date().toISOString().split('T')[0];
      const { data: salaryData } = await supabase
        .from('grade_salary_config')
        .select('salary, currency')
        .eq('grade_id', emp.grade_id)
        .lte('effective_from', today)
        .order('effective_from', { ascending: false })
        .limit(1);

      const salary = salaryData?.[0]?.salary ?? 0;
      setBasicSalary(salary);

      // Fetch grade benefits
      const { data: benefitsData, error: bErr } = await supabase
        .from('grade_benefits')
        .select('id,benefit_type,benefit_value,value_type,currency,active')
        .eq('grade_id', emp.grade_id)
        .eq('active', true)
        .order('benefit_type');

      if (bErr) throw bErr;

      const june = isJune(month);

      const lines: BenefitLine[] = (benefitsData || []).map((b: any) => {
        const isAnnualTicket = b.benefit_type === 'Annual Flight Ticket';
        const isAnnualBonus  = b.benefit_type === 'Annual Bonus';
        const included =
          (!isAnnualTicket || june) &&
          (!isAnnualBonus  || isJanuary(month));
        const raw = b.benefit_value ?? 0;
        const computed = b.value_type === 'percentage'
          ? Math.round((raw / 100) * salary * 100) / 100
          : raw;

        const reason_excluded = !included
          ? isAnnualTicket ? 'Annual Flight Ticket is only paid in June'
          : isAnnualBonus  ? 'Annual Bonus is only paid in January'
          : undefined
          : undefined;

        return {
          id: b.id,
          benefit_type: b.benefit_type,
          benefit_value: raw,
          value_type: b.value_type,
          currency: b.currency || 'AED',
          computed_amount: included ? computed : 0,
          included,
          reason_excluded,
        };
      });

      setBenefitLines(lines);

      // Monthly allowances = regular benefits (not annual ticket / annual bonus)
      const monthlyAllowances = lines
        .filter(l => l.included && l.benefit_type !== 'Annual Flight Ticket' && l.benefit_type !== 'Annual Bonus')
        .reduce((s, l) => s + l.computed_amount, 0);

      // Fetch leave balances (year-to-date) and month-specific leaves in parallel
      const year = parseInt(month.split('-')[0]);
      const [balances, thisMonthLeaves] = await Promise.all([
        fetchLeaveBalances(employeeId, year),
        fetchMonthLeaves(employeeId, month),
      ]);
      setLeaveBalances(balances);
      setMonthLeaves(thisMonthLeaves);

      // Compute leave deduction
      const { excessDays, unauthorizedDays, deductionAmount } = await computeLeaveDeduction(employeeId, month, salary, monthlyAllowances);
      setLeaveDeductionDays(excessDays);
      setLeaveDeductionUnauthorized(unauthorizedDays);
      setLeaveDeductionAmount(deductionAmount);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load grade benefits';
      setModalError(msg);
    } finally {
      setLoadingBenefits(false);
    }
  };

  // ── Shared: compute payroll figures for one employee ───────────
  const computePayrollForEmployee = async (
    emp: Employee,
    month: string
  ): Promise<{ basicSalary: number; allowances: number; leaveDeductionDays: number; leaveDeductionAmount: number; netPay: number } | null> => {
    if (!emp.grade_id) return null;

    const today = new Date().toISOString().split('T')[0];

    const { data: salaryData } = await supabase
      .from('grade_salary_config')
      .select('salary')
      .eq('grade_id', emp.grade_id)
      .lte('effective_from', today)
      .order('effective_from', { ascending: false })
      .limit(1);

    const salary = salaryData?.[0]?.salary ?? 0;

    const { data: benefitsData } = await supabase
      .from('grade_benefits')
      .select('benefit_type, benefit_value, value_type, active')
      .eq('grade_id', emp.grade_id)
      .eq('active', true);

    const june = isJune(month);
    const jan  = isJanuary(month);

    const allowances = (benefitsData || []).reduce((sum: number, b: any) => {
      const isTicket = b.benefit_type === 'Annual Flight Ticket';
      const isBonus  = b.benefit_type === 'Annual Bonus';
      if (isTicket && !june) return sum;
      if (isBonus  && !jan)  return sum;
      const raw = b.benefit_value ?? 0;
      const amount = b.value_type === 'percentage'
        ? Math.round((raw / 100) * salary * 100) / 100
        : raw;
      return sum + amount;
    }, 0);

    // Monthly allowances for daily wage (exclude annual-only benefits)
    const monthlyAllowances = (benefitsData || []).reduce((sum: number, b: any) => {
      if (b.benefit_type === 'Annual Flight Ticket' || b.benefit_type === 'Annual Bonus') return sum;
      const raw = b.benefit_value ?? 0;
      const amount = b.value_type === 'percentage' ? Math.round((raw / 100) * salary * 100) / 100 : raw;
      return sum + amount;
    }, 0);

    // Compute leave deduction
    const { excessDays, unauthorizedDays, deductionAmount } = await computeLeaveDeduction(emp.id, month, salary, monthlyAllowances);

    return {
      basicSalary: salary,
      allowances,
      leaveDeductionDays: excessDays + unauthorizedDays,
      leaveDeductionAmount: deductionAmount,
      netPay: salary + allowances - deductionAmount,
    };
  };

  // ── Batch: process payroll for all active employees ────────────
  const runBatchPayroll = async () => {
    if (!selectedCompany || employees.length === 0) return;
    setBatchRunning(true);
    setBatchResults([]);
    setBatchProgress(0);
    setBatchDone(false);


    // Fetch already-processed employee IDs for this month
    const { data: existing } = await supabase
      .from('payroll')
      .select('employee_id')
      .in('employee_id', employees.map(e => e.id))
      .eq('month', batchMonth);

    const alreadyDone = new Set((existing || []).map((r: any) => r.employee_id));

    const results: BatchResult[] = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const name = `${emp.first_name} ${emp.last_name}`;

      if (alreadyDone.has(emp.id)) {
        results.push({ employee_id: emp.id, employee_name: name, status: 'skipped', reason: 'Already processed this month' });
        setBatchProgress(i + 1);
        setBatchResults([...results]);
        continue;
      }

      if (!emp.grade_id) {
        results.push({ employee_id: emp.id, employee_name: name, status: 'no_grade', reason: 'No grade assigned' });
        setBatchProgress(i + 1);
        setBatchResults([...results]);
        continue;
      }

      try {
        const calc = await computePayrollForEmployee(emp, batchMonth);
        if (!calc) throw new Error('Calculation failed');

        const payload: Record<string, unknown> = {
          employee_id: emp.id,
          month: batchMonth,
          salary: calc.basicSalary,
          bonus: calc.allowances,
          deductions: calc.leaveDeductionAmount,
          net_pay: calc.netPay,
          leave_deduction_days: calc.leaveDeductionDays,
          leave_deduction_amount: calc.leaveDeductionAmount,
          status: 'Processed',
        };
        if (selectedCompany?.id) payload.company_id = selectedCompany.id;

        const { error } = await supabase.from('payroll').insert(payload);

        if (error) {
          if (error.message?.includes('company_id') || error.code === '42703') {
            delete payload.company_id;
            const { error: e2 } = await supabase.from('payroll').insert(payload);
            if (e2) throw new Error(e2.message);
          } else {
            throw new Error(error.message);
          }
        }

        results.push({ employee_id: emp.id, employee_name: name, status: 'processed', net_pay: calc.netPay });
      } catch (err) {
        results.push({ employee_id: emp.id, employee_name: name, status: 'error', reason: err instanceof Error ? err.message : 'Unknown error' });
      }

      setBatchProgress(i + 1);
      setBatchResults([...results]);
    }

    setBatchRunning(false);
    setBatchDone(true);
    fetchPayroll();
  };

  const closeBatchModal = () => {
    if (batchRunning) return;
    setShowBatchModal(false);
    setBatchResults([]);
    setBatchProgress(0);
    setBatchDone(false);
  };

  // ── Submit ─────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedEmployeeId || !selectedPayrollMonth) {
      setModalError('Please select an employee and month.');
      return;
    }
    if (basicSalary === 0 && benefitLines.length === 0) {
      setModalError('Cannot process payroll: no salary or benefits configured for this employee\'s grade.');
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      // Enforce one payroll per employee per month
      const { data: existing } = await supabase
        .from('payroll')
        .select('id, status')
        .eq('employee_id', selectedEmployeeId)
        .eq('month', selectedPayrollMonth)
        .maybeSingle();

      if (existing) {
        const isPaid = existing.status === 'Paid';
        setModalError(
          isPaid
            ? 'Payroll for this employee is already marked as Paid and cannot be reprocessed.'
            : 'Payroll already processed for this month. Delete the existing record first to reprocess.'
        );
        return;
      }

      const totalDeductions = (deductions || 0) + leaveDeductionAmount;

      const insertPayload: Record<string, unknown> = {
        employee_id: selectedEmployeeId,
        month: selectedPayrollMonth,
        salary: basicSalary,
        bonus: totalAllowances,
        deductions: totalDeductions,
        net_pay: basicSalary + totalAllowances - totalDeductions,
        leave_deduction_days: leaveDeductionDays + leaveDeductionUnauthorized,
        leave_deduction_amount: leaveDeductionAmount,
        status: 'Processed',
      };

      if (selectedCompany?.id) insertPayload.company_id = selectedCompany.id;

      const { error } = await supabase.from('payroll').insert(insertPayload);

      if (error) {
        if (error.message?.includes('company_id') || error.code === '42703') {
          delete insertPayload.company_id;
          const { error: retryError } = await supabase.from('payroll').insert(insertPayload);
          if (retryError) throw new Error(retryError.message || JSON.stringify(retryError));
        } else {
          throw new Error(error.message || JSON.stringify(error));
        }
      }

      setMessage({ type: 'success', text: 'Payroll processed successfully' });
      closeModal();
      fetchPayroll();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setModalError(`Failed to process payroll: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployeeId('');
    setSelectedPayrollMonth(new Date().toISOString().substring(0, 7));
    setBasicSalary(0);
    setBenefitLines([]);
    setDeductions(0);
    setModalError(null);
    setLeaveBalances([]);
    setMonthLeaves([]);
    setLeaveDeductionDays(0);
    setLeaveDeductionUnauthorized(0);
    setLeaveDeductionAmount(0);
  };

  // ── Delete payroll record ──────────────────────────────────────
  const deletePayroll = async (id: string) => {
    const { error } = await supabase.from('payroll').delete().eq('id', id);
    if (!error) fetchPayroll();
  };

  // ── Payslip ────────────────────────────────────────────────────

  const viewPayslip = async (record: any) => {
    setPayslipRecord(record);
    setPayslipLines([]);
    setShowPayslip(true);
    setLoadingPayslip(true);
    try {
      const emp = employees.find(e => e.id === record.employee_id);
      if (!emp?.grade_id) { setLoadingPayslip(false); return; }

      const today = new Date().toISOString().split('T')[0];
      const { data: salaryData } = await supabase
        .from('grade_salary_config')
        .select('salary, currency')
        .eq('grade_id', emp.grade_id)
        .lte('effective_from', today)
        .order('effective_from', { ascending: false })
        .limit(1);

      const baseSalary = salaryData?.[0]?.salary ?? record.salary ?? 0;

      const { data: benefitsData } = await supabase
        .from('grade_benefits')
        .select('id,benefit_type,benefit_value,value_type,currency,active')
        .eq('grade_id', emp.grade_id)
        .eq('active', true)
        .order('benefit_type');

      const june = isJune(record.month);
      const jan  = isJanuary(record.month);

      const lines: BenefitLine[] = (benefitsData || []).map((b: any) => {
        const isTicket = b.benefit_type === 'Annual Flight Ticket';
        const isBonus  = b.benefit_type === 'Annual Bonus';
        const included = (!isTicket || june) && (!isBonus || jan);
        const raw = b.benefit_value ?? 0;
        const computed = b.value_type === 'percentage'
          ? Math.round((raw / 100) * baseSalary * 100) / 100
          : raw;
        return {
          id: b.id, benefit_type: b.benefit_type,
          benefit_value: raw, value_type: b.value_type, currency: b.currency || 'AED',
          computed_amount: included ? computed : 0, included,
          reason_excluded: !included
            ? (isTicket ? 'Only in June' : isBonus ? 'Only in January' : undefined)
            : undefined,
        };
      });
      setPayslipLines(lines);

      // Load leave balances for the payslip year
      const year = parseInt(record.month.split('-')[0]);
      const balances = await fetchLeaveBalances(record.employee_id, year);
      setPayslipLeaveBalances(balances);

    } catch { /* silent */ }
    finally { setLoadingPayslip(false); }
  };

  const markAsPaid = async (payrollId: string) => {
    setMarkingPaid(true);
    try {
      const { error } = await supabase
        .from('payroll').update({ status: 'Paid' }).eq('id', payrollId);
      if (error) throw error;
      setPayslipRecord((prev: any) => prev ? { ...prev, status: 'Paid' } : prev);
      fetchPayroll();
    } catch { /* silent */ }
    finally { setMarkingPaid(false); }
  };

  // ── Summary ────────────────────────────────────────────────────

  const summary = {
    total_salary: payrollData.reduce((s, p) => s + (p.salary || 0), 0),
    total_allowances: payrollData.reduce((s, p) => s + (p.bonus || 0), 0),
    total_deductions: payrollData.reduce((s, p) => s + (p.deductions || 0), 0),
    total_net: payrollData.reduce((s, p) => s + (p.net_pay || 0), 0),
    paid: payrollData.filter(p => p.status === 'Paid').length,
    processed: payrollData.filter(p => p.status === 'Processed').length,
  };

  const fmt = (n: number) => `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const columns = [
    {
      key: 'employee_id', label: 'Employee',
      render: (value: string) => {
        const emp = employees.find(e => e.id === value);
        return emp ? `${emp.first_name} ${emp.last_name}` : '—';
      },
    },
    { key: 'salary', label: 'Basic Salary', render: (v: number) => fmt(v) },
    { key: 'bonus', label: 'Allowances', render: (v: number) => fmt(v) },
    { key: 'deductions', label: 'Deductions', render: (v: number) => fmt(v) },
    {
      key: 'net_pay', label: 'Net Pay',
      render: (v: number) => <span className="font-bold text-green-700">{fmt(v)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (v: string) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          v === 'Paid' ? 'bg-green-100 text-green-800' :
          v === 'Processed' ? 'bg-blue-100 text-blue-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>{v}</span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (_: any, row: any) => (
        <div className="flex gap-2 justify-end items-center">
          <button
            onClick={() => viewPayslip(row)}
            className="text-xs px-2.5 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition"
          >
            Payslip
          </button>
          {row.status !== 'Paid' && (
            <button
              onClick={async () => {
                await supabase.from('payroll').update({ status: 'Paid' }).eq('id', row.id);
                fetchPayroll();
              }}
              className="text-xs px-2.5 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50 transition"
            >
              Mark Paid
            </button>
          )}
          {row.status !== 'Paid' ? (
            <button
              onClick={() => {
                if (confirm('Delete this payroll record? The employee can then be re-processed for this month.')) {
                  deletePayroll(row.id);
                }
              }}
              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
              title="Delete to allow reprocessing"
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <span className="text-xs text-gray-400 px-1.5" title="Paid records cannot be deleted">🔒</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
            <p className="text-gray-600 mt-1">
              {selectedCompany ? `Manage payroll for ${selectedCompany.name}` : 'Select a company to manage payroll'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowBatchModal(true)} disabled={!selectedCompany} className="gap-2 disabled:opacity-50">
              <Users size={20} /> Process All Employees
            </Button>
            <Button variant="primary" onClick={() => setShowModal(true)} disabled={!selectedCompany} className="gap-2 disabled:opacity-50">
              <Plus size={20} /> Process Single
            </Button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to manage payroll</p>
          </Card>
        )}

        {selectedCompany && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Month Selector */}
                <Card>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Calendar size={16} /> Select Month:
                    </label>
                    <MonthSelect value={selectedMonth} onChange={setSelectedMonth} />
                  </div>
                </Card>

                {/* Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Basic Salary', value: summary.total_salary, color: 'text-gray-900' },
                    { label: 'Total Allowances', value: summary.total_allowances, color: 'text-blue-600' },
                    { label: 'Total Deductions', value: summary.total_deductions, color: 'text-red-600' },
                    { label: 'Net Payroll', value: summary.total_net, color: 'text-green-600' },
                  ].map(s => (
                    <Card key={s.label}>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                        <p className={`text-lg font-bold ${s.color}`}>{fmt(s.value)}</p>
                      </div>
                    </Card>
                  ))}
                  <Card>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs mb-1">Status</p>
                      <p className="text-sm mt-1">
                        <span className="font-semibold text-green-600">{summary.paid}</span> Paid ·{' '}
                        <span className="font-semibold text-blue-600">{summary.processed}</span> Processed
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Table */}
                <Card header={<h2 className="text-lg font-semibold">Payroll Details — {selectedMonth}</h2>} noPadding>
                  {payrollData.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No payroll records for {selectedMonth}</div>
                  ) : (
                    <Table columns={columns} data={payrollData} />
                  )}
                </Card>

                <div className="flex gap-4">
                  <Button variant="outline" className="gap-2"><Download size={20} /> Export Report</Button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Process Payroll Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Process Payroll"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || loadingBenefits}>
              {isSubmitting ? 'Processing...' : 'Confirm & Process'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{modalError}</div>
          )}

          {/* Employee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee *</label>
            <select
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}{emp.position ? ` — ${emp.position}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <Calendar size={14} /> Payroll Month *
            </label>
            <MonthSelect value={selectedPayrollMonth} onChange={setSelectedPayrollMonth} className="w-full" />
            {isJune(selectedPayrollMonth) && (
              <p className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
                <Plane size={12} /> June — Annual Flight Ticket will be included
              </p>
            )}
            {isJanuary(selectedPayrollMonth) && (
              <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                <Info size={12} /> January — Annual Bonus will be included
              </p>
            )}
          </div>

          {/* Benefits Breakdown */}
          {selectedEmployeeId && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Payroll Breakdown</span>
                {loadingBenefits && <span className="text-xs text-gray-400 animate-pulse">Loading grade data…</span>}
              </div>

              <div className="divide-y divide-gray-100">
                {/* Basic Salary */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">Basic Salary</span>
                  <span className="text-sm font-semibold text-gray-900">{fmt(basicSalary)}</span>
                </div>

                {/* Benefit lines */}
                {benefitLines.map(b => (
                  <div key={b.id} className={`px-4 py-3 flex items-center justify-between ${!b.included ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2">
                      {b.benefit_type === 'Annual Flight Ticket' && <Plane size={13} className="text-blue-500" />}
                      <span className="text-sm text-gray-700">{b.benefit_type}</span>
                      <span className="text-xs text-gray-400">
                        ({b.value_type === 'percentage' ? `${b.benefit_value}% of basic` : b.benefit_type})
                      </span>
                      {!b.included && b.reason_excluded && (
                        <span className="text-xs text-orange-500 flex items-center gap-1">
                          <Info size={11} /> {b.reason_excluded}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${b.included ? 'text-green-700' : 'text-gray-400 line-through'}`}>
                      + {fmt(b.value_type === 'percentage' ? Math.round((b.benefit_value / 100) * basicSalary * 100) / 100 : b.benefit_value)}
                    </span>
                  </div>
                ))}

                {benefitLines.length === 0 && !loadingBenefits && selectedEmployeeId && !modalError && (
                  <div className="px-4 py-3 text-sm text-gray-400 italic">No benefits configured for this grade</div>
                )}

                {/* Total Allowances */}
                {totalAllowances > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between bg-blue-50">
                    <span className="text-sm font-semibold text-blue-800">Total Allowances</span>
                    <span className="text-sm font-semibold text-blue-800">{fmt(totalAllowances)}</span>
                  </div>
                )}

                {/* Excess leave deduction */}
                {leaveDeductionDays > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between bg-red-50">
                    <div>
                      <span className="text-sm font-medium text-red-800">Excess Leave Deduction</span>
                      <span className="text-xs text-red-600 ml-2">({leaveDeductionDays} day{leaveDeductionDays !== 1 ? 's' : ''} over quota × daily wage)</span>
                    </div>
                    <span className="text-sm font-semibold text-red-700">
                      - {fmt(Math.round(leaveDeductionDays * ((basicSalary + benefitLines.filter(b => b.included && b.benefit_type !== 'Annual Flight Ticket' && b.benefit_type !== 'Annual Bonus').reduce((s,b) => s + b.computed_amount, 0)) / 30) * 100) / 100)}
                    </span>
                  </div>
                )}
                {/* Unauthorized leave deduction */}
                {leaveDeductionUnauthorized > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between bg-orange-50">
                    <div>
                      <span className="text-sm font-medium text-orange-800">Unauthorized Leave</span>
                      <span className="text-xs text-orange-600 ml-2">({leaveDeductionUnauthorized} day{leaveDeductionUnauthorized !== 1 ? 's' : ''} pending/unapproved × daily wage)</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-700">
                      - {fmt(Math.round(leaveDeductionUnauthorized * ((basicSalary + benefitLines.filter(b => b.included && b.benefit_type !== 'Annual Flight Ticket' && b.benefit_type !== 'Annual Bonus').reduce((s,b) => s + b.computed_amount, 0)) / 30) * 100) / 100)}
                    </span>
                  </div>
                )}

                {/* Manual deductions */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Other Deductions</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={deductions || ''}
                    onChange={e => setDeductions(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-32 text-right px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-red-600"
                  />
                </div>

                {/* Net Pay */}
                <div className="px-4 py-3 flex items-center justify-between bg-green-50">
                  <span className="text-sm font-bold text-green-900">Net Pay</span>
                  <span className="text-lg font-bold text-green-700">{fmt(netPay)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Leave for THIS payroll month */}
          {selectedEmployeeId && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-700">
                  Leaves in {new Date(selectedPayrollMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              {monthLeaves.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400 italic">No leaves recorded for this month</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Dates</th>
                      <th className="text-center px-3 py-2 font-medium">Days</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthLeaves.map((l, i) => (
                      <tr key={i} className={l.status !== 'Approved' ? 'bg-orange-50' : ''}>
                        <td className="px-4 py-2 text-gray-700">{l.leave_type}</td>
                        <td className="px-3 py-2 text-gray-500">{l.start_date} → {l.end_date}</td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-800">{l.days}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            l.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            l.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>{l.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Year-to-date leave balance vs quota */}
          {selectedEmployeeId && leaveBalances.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-700">Year-to-Date Balance ({selectedPayrollMonth.split('-')[0]})</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-center px-3 py-2 font-medium">Quota</th>
                    <th className="text-center px-3 py-2 font-medium">Taken (YTD)</th>
                    <th className="text-center px-3 py-2 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaveBalances.map(lb => (
                    <tr key={lb.leave_type_id} className={lb.excess_days > 0 ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 text-gray-700">{lb.leave_type_name}</td>
                      <td className="px-3 py-2 text-center text-gray-700">{lb.total_days}</td>
                      <td className="px-3 py-2 text-center text-gray-700">{lb.used_days}</td>
                      <td className={`px-3 py-2 text-center font-semibold ${lb.excess_days > 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {lb.excess_days > 0 ? `-${lb.excess_days} excess` : lb.remaining_days}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
      {/* Payslip Modal */}
      <Modal
        isOpen={showPayslip}
        onClose={() => setShowPayslip(false)}
        title="Payslip"
        size="lg"
        footer={
          <div className="flex gap-3 w-full justify-between">
            <div className="flex gap-2">
              {payslipRecord?.status !== 'Paid' && (
                <Button variant="primary" onClick={() => markAsPaid(payslipRecord?.id)} disabled={markingPaid}>
                  {markingPaid ? 'Marking…' : '✓ Mark as Paid'}
                </Button>
              )}
              {payslipRecord?.status === 'Paid' && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <CheckCircle size={16} /> Paid
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => window.print()} className="gap-2">
                <Download size={16} /> Print / Save PDF
              </Button>
              <Button variant="secondary" onClick={() => setShowPayslip(false)}>Close</Button>
            </div>
          </div>
        }
      >
        {loadingPayslip ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : payslipRecord && (() => {
          const emp = employees.find(e => e.id === payslipRecord.employee_id);
          const includedLines = payslipLines.filter(b => b.included);
          const monthLabel = new Date(payslipRecord.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });

          return (
            <div id="payslip-content" className="space-y-5 print:text-sm">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedCompany?.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Payslip for {monthLabel}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  payslipRecord.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>{payslipRecord.status}</span>
              </div>

              {/* Employee details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Employee</p>
                  <p className="text-base font-semibold text-gray-900 mt-0.5">
                    {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                  </p>
                  {emp?.position && <p className="text-sm text-gray-500">{emp.position}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Pay Period</p>
                  <p className="text-base font-semibold text-gray-900 mt-0.5">{monthLabel}</p>
                </div>
              </div>

              {/* Earnings breakdown */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Earnings</span>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">Basic Salary</span>
                    <span className="text-sm font-semibold text-gray-900">{fmt(payslipRecord.salary)}</span>
                  </div>
                  {includedLines.map(b => (
                    <div key={b.id} className="flex justify-between px-4 py-2.5">
                      <span className="text-sm text-gray-700">{b.benefit_type}
                        {b.value_type === 'percentage' && (
                          <span className="text-xs text-gray-400 ml-1">({b.benefit_value}%)</span>
                        )}
                      </span>
                      <span className="text-sm text-gray-800">{fmt(b.computed_amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2.5 bg-blue-50">
                    <span className="text-sm font-semibold text-blue-800">Total Earnings</span>
                    <span className="text-sm font-semibold text-blue-800">{fmt(payslipRecord.salary + payslipRecord.bonus)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              {payslipRecord.deductions > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Deductions</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {payslipRecord.leave_deduction_amount > 0 && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-gray-700">
                          Leave Deduction
                          <span className="text-xs text-red-500 ml-1">({payslipRecord.leave_deduction_days} excess day{payslipRecord.leave_deduction_days !== 1 ? 's' : ''})</span>
                        </span>
                        <span className="text-sm font-semibold text-red-600">{fmt(payslipRecord.leave_deduction_amount)}</span>
                      </div>
                    )}
                    {(payslipRecord.deductions - (payslipRecord.leave_deduction_amount || 0)) > 0 && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-gray-700">Other Deductions</span>
                        <span className="text-sm font-semibold text-red-600">{fmt(payslipRecord.deductions - (payslipRecord.leave_deduction_amount || 0))}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-2.5 bg-red-50">
                      <span className="text-sm font-semibold text-red-800">Total Deductions</span>
                      <span className="text-sm font-semibold text-red-700">{fmt(payslipRecord.deductions)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Leave Balance Summary */}
              {payslipLeaveBalances.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Leave Balance — {payslipRecord.month?.split('-')[0]}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                        <th className="text-left px-4 py-2 font-medium">Leave Type</th>
                        <th className="text-center px-3 py-2 font-medium">Total Quota</th>
                        <th className="text-center px-3 py-2 font-medium">Taken</th>
                        <th className="text-center px-3 py-2 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payslipLeaveBalances.map(lb => (
                        <tr key={lb.leave_type_id} className={lb.excess_days > 0 ? 'bg-red-50' : ''}>
                          <td className="px-4 py-2 text-gray-700">{lb.leave_type_name}</td>
                          <td className="px-3 py-2 text-center text-gray-700">{lb.total_days}</td>
                          <td className="px-3 py-2 text-center text-gray-700">{lb.used_days}</td>
                          <td className={`px-3 py-2 text-center font-semibold ${lb.excess_days > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {lb.excess_days > 0 ? `-${lb.excess_days} (excess)` : lb.remaining_days}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Net Pay */}
              <div className="flex justify-between items-center p-4 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-base font-bold text-green-900">Net Pay</span>
                <span className="text-2xl font-bold text-green-700">{fmt(payslipRecord.net_pay)}</span>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Batch Payroll Modal */}
      <Modal
        isOpen={showBatchModal}
        onClose={closeBatchModal}
        title="Process Payroll — All Employees"
        size="lg"
        footer={
          batchDone ? (
            <Button variant="primary" onClick={closeBatchModal}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeBatchModal} disabled={batchRunning}>Cancel</Button>
              <Button variant="primary" onClick={runBatchPayroll} disabled={batchRunning || !batchMonth}>
                {batchRunning ? 'Processing…' : `Run Payroll for ${employees.length} Employees`}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {/* Month picker — only before run */}
          {!batchRunning && !batchDone && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Calendar size={14} /> Payroll Month *
                </label>
                <MonthSelect value={batchMonth} onChange={setBatchMonth} />
                {isJune(batchMonth) && (
                  <p className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
                    <Plane size={12} /> June — Annual Flight Ticket will be included
                  </p>
                )}
                {isJanuary(batchMonth) && (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                    <Info size={12} /> January — Annual Bonus will be included
                  </p>
                )}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <strong>{employees.length}</strong> active employees found for <strong>{selectedCompany?.name}</strong>.
                Employees already processed this month will be skipped. Employees without a grade will be skipped.
              </div>
            </>
          )}

          {/* Progress bar */}
          {(batchRunning || batchDone) && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{batchProgress} / {employees.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${employees.length > 0 ? (batchProgress / employees.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Results summary */}
          {batchDone && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Processed', count: batchResults.filter(r => r.status === 'processed').length, color: 'bg-green-50 border-green-200 text-green-800' },
                { label: 'Skipped', count: batchResults.filter(r => r.status === 'skipped').length, color: 'bg-gray-50 border-gray-200 text-gray-600' },
                { label: 'Errors / No Grade', count: batchResults.filter(r => r.status === 'error' || r.status === 'no_grade').length, color: 'bg-red-50 border-red-200 text-red-700' },
              ].map(s => (
                <div key={s.label} className={`border rounded-lg p-3 text-center ${s.color}`}>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Per-employee results list */}
          {batchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {batchResults.map(r => (
                <div key={r.employee_id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {r.status === 'processed'  && <CheckCircle size={15} className="text-green-500 flex-shrink-0" />}
                    {r.status === 'skipped'    && <SkipForward  size={15} className="text-gray-400 flex-shrink-0" />}
                    {r.status === 'error'      && <XCircle      size={15} className="text-red-500 flex-shrink-0" />}
                    {r.status === 'no_grade'   && <XCircle      size={15} className="text-orange-400 flex-shrink-0" />}
                    <span className="text-sm text-gray-800 truncate">{r.employee_name}</span>
                    {r.reason && <span className="text-xs text-gray-400 truncate">— {r.reason}</span>}
                  </div>
                  {r.net_pay != null && (
                    <span className="text-sm font-semibold text-green-700 flex-shrink-0 ml-2">{fmt(r.net_pay)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
};

export default PayrollPage;
