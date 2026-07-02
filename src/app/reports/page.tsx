'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Download, BarChart3, FileSpreadsheet } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

interface ReportResult { id: string; title: string; columns: string[]; rows: Record<string, any>[] }
interface Ctx {
  employees: any[];
  empIds: string[];
  nameById: Map<string, string>;
  salaryOf: (e: any) => number;
  from: string | null;
  to: string | null;
}

const REPORTS = [
  { id: 'employee-summary', title: 'Employee Summary Report', description: 'All employees with grade, salary and status' },
  { id: 'attendance', title: 'Attendance Report', description: 'Attendance records over the selected period' },
  { id: 'payroll', title: 'Payroll Report', description: 'Processed payroll and salary breakdown' },
  { id: 'leave', title: 'Leave Utilization Report', description: 'Leave requests over the selected period' },
  { id: 'turnover', title: 'Turnover Analysis', description: 'Headcount, active/inactive and turnover metrics' },
  { id: 'department', title: 'Department Performance Report', description: 'Headcount and payroll by department' },
];

const DATE_RANGES: Record<string, string> = {
  '30': 'Last 30 Days', '90': 'Last 90 Days', quarter: 'This Quarter', year: 'This Year', all: 'All Time', custom: 'Custom Range',
};
const STATUSES = ['Active', 'On Leave', 'Inactive', 'Archived'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract'];
const inputCls = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

function rangeToDates(key: string): { from: string | null; to: string | null } {
  const to = new Date();
  const from = new Date();
  if (key === '30') from.setDate(to.getDate() - 30);
  else if (key === '90') from.setDate(to.getDate() - 90);
  else if (key === 'quarter') { from.setMonth(Math.floor(to.getMonth() / 3) * 3); from.setDate(1); }
  else if (key === 'year') { from.setMonth(0); from.setDate(1); }
  else return { from: null, to: null };
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

// ── Report generators ──────────────────────────────────────────────
const GENERATORS: Record<string, (ctx: Ctx) => Promise<{ columns: string[]; rows: Record<string, any>[] }>> = {
  'employee-summary': async (ctx) => ({
    columns: ['Name', 'Email', 'Phone', 'Position', 'Department', 'Grade', 'Salary', 'Status', 'Date of Joining'],
    rows: ctx.employees.map((e) => ({
      Name: `${e.first_name} ${e.last_name}`,
      Email: e.email || '',
      Phone: e.phone || '',
      Position: e.position || '',
      Department: e.department || '',
      Grade: e.employee_grades?.name || '',
      Salary: ctx.salaryOf(e),
      Status: e.archived_at ? 'Archived' : (e.status || ''),
      'Date of Joining': e.date_of_joining || '',
    })),
  }),

  attendance: async (ctx) => {
    let q = supabase.from('attendance')
      .select('employee_id,date,check_in,check_out,status')
      .in('employee_id', ctx.empIds.length ? ctx.empIds : ['00000000-0000-0000-0000-000000000000'])
      .order('date', { ascending: false });
    if (ctx.from) q = q.gte('date', ctx.from).lte('date', ctx.to!);
    const { data, error } = await q;
    if (error) throw error;
    return {
      columns: ['Employee', 'Date', 'Check In', 'Check Out', 'Status'],
      rows: (data || []).map((a: any) => ({
        Employee: ctx.nameById.get(a.employee_id) || '', Date: a.date,
        'Check In': a.check_in || '', 'Check Out': a.check_out || '', Status: a.status || '',
      })),
    };
  },

  payroll: async (ctx) => {
    const { data, error } = await supabase.from('payroll')
      .select('employee_id,month,salary,bonus,deductions,net_pay,status')
      .in('employee_id', ctx.empIds.length ? ctx.empIds : ['00000000-0000-0000-0000-000000000000'])
      .order('month', { ascending: false });
    if (error) throw error;
    let rows = data || [];
    if (ctx.from) { const fromMonth = ctx.from.slice(0, 7); rows = rows.filter((p: any) => (p.month || '') >= fromMonth); }
    return {
      columns: ['Employee', 'Month', 'Basic Salary', 'Bonus', 'Deductions', 'Net Pay', 'Status'],
      rows: rows.map((p: any) => ({
        Employee: ctx.nameById.get(p.employee_id) || '', Month: p.month || '',
        'Basic Salary': p.salary ?? 0, Bonus: p.bonus ?? 0, Deductions: p.deductions ?? 0,
        'Net Pay': p.net_pay ?? 0, Status: p.status || '',
      })),
    };
  },

  leave: async (ctx) => {
    let q = supabase.from('leaves')
      .select('employee_id,leave_type,start_date,end_date,days,status,approval_status')
      .in('employee_id', ctx.empIds.length ? ctx.empIds : ['00000000-0000-0000-0000-000000000000'])
      .order('start_date', { ascending: false });
    if (ctx.from) q = q.gte('start_date', ctx.from).lte('start_date', ctx.to!);
    const { data, error } = await q;
    if (error) throw error;
    return {
      columns: ['Employee', 'Type', 'Start Date', 'End Date', 'Days', 'Status'],
      rows: (data || []).map((l: any) => ({
        Employee: ctx.nameById.get(l.employee_id) || '', Type: l.leave_type || '',
        'Start Date': l.start_date, 'End Date': l.end_date, Days: l.days ?? '',
        Status: l.approval_status || l.status || '',
      })),
    };
  },

  turnover: async (ctx) => {
    const emps = ctx.employees;
    const total = emps.length;
    const active = emps.filter((e) => !e.archived_at && /active/i.test(e.status || '')).length;
    const inactive = emps.filter((e) => e.archived_at || /inactive/i.test(e.status || '')).length;
    const joined = ctx.from
      ? emps.filter((e) => e.date_of_joining && e.date_of_joining >= ctx.from! && e.date_of_joining <= ctx.to!).length
      : emps.filter((e) => e.date_of_joining).length;
    const rate = total ? Math.round((inactive / total) * 1000) / 10 : 0;
    return {
      columns: ['Metric', 'Value'],
      rows: [
        { Metric: 'Total Employees', Value: total },
        { Metric: 'Active', Value: active },
        { Metric: 'Inactive / Archived', Value: inactive },
        { Metric: ctx.from ? 'Joined (in range)' : 'With Joining Date', Value: joined },
        { Metric: 'Turnover Rate (%)', Value: rate },
      ],
    };
  },

  department: async (ctx) => {
    const map: Record<string, any> = {};
    ctx.employees.forEach((e) => {
      const d = e.department || 'Unassigned';
      if (!map[d]) map[d] = { Department: d, Headcount: 0, Active: 0, 'On Leave': 0, Inactive: 0, 'Total Payroll': 0 };
      const m = map[d];
      m.Headcount++;
      if (e.archived_at || /inactive/i.test(e.status || '')) m.Inactive++;
      else if (/leave/i.test(e.status || '')) m['On Leave']++;
      else m.Active++;
      m['Total Payroll'] += ctx.salaryOf(e) || 0;
    });
    return { columns: ['Department', 'Headcount', 'Active', 'On Leave', 'Inactive', 'Total Payroll'], rows: Object.values(map) };
  },
};

const ReportsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [dateRange, setDateRange] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [department, setDepartment] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [status, setStatus] = useState('all');
  const [employmentType, setEmploymentType] = useState('all');
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCompany?.id) { setDepartments([]); return; }
    supabase.from('employees').select('department').eq('company_id', selectedCompany.id).then(({ data }) => {
      setDepartments([...new Set((data || []).map((e: any) => e.department).filter(Boolean))].sort());
    });
  }, [selectedCompany?.id]);

  const buildContext = useCallback(async (): Promise<Ctx> => {
    const today = new Date().toISOString().split('T')[0];
    const { data: emps, error: empErr } = await supabase
      .from('employees')
      .select('id,first_name,last_name,email,phone,position,department,employment_type,status,date_of_joining,archived_at,grade_id,salary_override,employee_grades(name)')
      .eq('company_id', selectedCompany!.id);
    if (empErr) throw empErr;
    const matchStatus = (e: any) => {
      if (status === 'all') return true;
      if (status === 'Archived') return !!e.archived_at;
      return (e.status || '').toLowerCase() === status.toLowerCase();
    };
    const employees = (emps || []).filter((e: any) =>
      (department === 'all' || e.department === department) &&
      (employmentType === 'all' || e.employment_type === employmentType) &&
      matchStatus(e));
    const empIds = employees.map((e: any) => e.id);

    const gradeIds = [...new Set(employees.map((e: any) => e.grade_id).filter(Boolean))] as string[];
    const salMap: Record<string, number> = {};
    if (gradeIds.length) {
      const { data: sc } = await supabase.from('grade_salary_config')
        .select('grade_id,salary,effective_from').in('grade_id', gradeIds)
        .lte('effective_from', today).order('effective_from', { ascending: false });
      (sc || []).forEach((s: any) => { if (salMap[s.grade_id] === undefined) salMap[s.grade_id] = s.salary; });
    }
    const salaryOf = (e: any) => (e.salary_override ?? (e.grade_id ? salMap[e.grade_id] : 0) ?? 0) as number;
    const nameById = new Map<string, string>(employees.map((e: any) => [e.id, `${e.first_name} ${e.last_name}`]));
    const { from, to } = dateRange === 'custom'
      ? { from: customFrom || null, to: customTo || null }
      : rangeToDates(dateRange);
    return { employees, empIds, nameById, salaryOf, from, to };
  }, [selectedCompany, department, dateRange, customFrom, customTo, status, employmentType]);

  const generate = async (report: { id: string; title: string }) => {
    if (!selectedCompany) return;
    setGenerating(report.id);
    setError(null);
    try {
      const ctx = await buildContext();
      const { columns, rows } = await GENERATORS[report.id](ctx);
      setResult({ id: report.id, title: report.title, columns, rows });
    } catch (err) {
      setError(`Failed to generate ${report.title}: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setGenerating(null);
    }
  };

  const exportCsv = async () => {
    if (!result) return;
    // Loaded on demand so the CSV library stays out of the initial page bundle.
    const Papa = (await import('papaparse')).default;
    const csv = Papa.unparse(result.rows, { columns: result.columns });
    const stamp = new Date().toISOString().split('T')[0];
    const filename = `${result.title.replace(/\s+/g, '_')}_${selectedCompany?.name?.replace(/\s+/g, '_') || 'report'}_${stamp}.csv`;
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
            {selectedCompany ? `Generate and export reports for ${selectedCompany.name}` : 'Select a company to generate reports'}
          </p>
        </div>

        {!selectedCompany ? (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to generate reports</p>
          </Card>
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}

            {/* Filters */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className={inputCls}>
                    {Object.entries(DATE_RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {dateRange === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                      <input type="date" value={customFrom} max={customTo || undefined}
                        onChange={(e) => setCustomFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                      <input type="date" value={customTo} min={customFrom || undefined}
                        onChange={(e) => setCustomTo(e.target.value)} className={inputCls} />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls}>
                    <option value="all">All Departments</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                    <option value="all">All Statuses</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                  <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className={inputCls}>
                    <option value="all">All Types</option>
                    {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <input readOnly value={selectedCompany.name}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600" />
                </div>
              </div>
            </Card>

            {/* Report cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {REPORTS.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                      </div>
                      <div className="p-2 bg-blue-100 rounded-lg"><BarChart3 size={20} className="text-blue-600" /></div>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                      <Button variant="primary" size="sm" className="w-full gap-2"
                        onClick={() => generate(report)} disabled={generating !== null}>
                        <Download size={16} />
                        {generating === report.id ? 'Generating…' : 'Generate'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Result modal */}
      <Modal isOpen={!!result} onClose={() => setResult(null)} title={result?.title || 'Report'} size="4xl">
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-500">
                {result.rows.length} row(s) · {DATE_RANGES[dateRange]}
                {dateRange === 'custom' && customFrom && ` (${customFrom} → ${customTo || 'now'})`}
                {department !== 'all' && ` · ${department}`}
                {status !== 'all' && ` · ${status}`}
                {employmentType !== 'all' && ` · ${employmentType}`}
              </p>
              <Button onClick={exportCsv} className="gap-2" disabled={result.rows.length === 0}>
                <FileSpreadsheet size={16} /> Export CSV
              </Button>
            </div>
            {result.rows.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No data for this report / period.</p>
            ) : (
              <div className="overflow-auto max-h-[65vh] border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{result.columns.map((c) => <th key={c} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{c}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.rows.slice(0, 100).map((row, i) => (
                      <tr key={i}>
                        {result.columns.map((c) => <td key={c} className="px-3 py-1.5 text-gray-800 whitespace-nowrap">{String(row[c] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.rows.length > 100 && (
              <p className="text-xs text-gray-400">Showing first 100 rows — the CSV export contains all {result.rows.length}.</p>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default ReportsPage;
