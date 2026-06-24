'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import { ArrowLeft, Mail, Phone, Briefcase, Calendar, Award, UserCheck, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ChangeRow {
  id: string;
  change_type: 'grade' | 'salary';
  old_salary: number | null;
  new_salary: number | null;
  currency: string;
  effective_month: string | null;
  note: string | null;
  changed_at: string;
}

const monthLabel = (ym: string) =>
  new Date(ym + '-01').toLocaleString('default', { month: 'short', year: '2-digit' });

/** Build a month-by-month salary series from joining date to now. */
function buildSalarySeries(joinDate: string | null, currentSalary: number | null, history: ChangeRow[]) {
  if (!joinDate) return [] as { month: string; salary: number | null }[];
  const start = new Date(joinDate);
  start.setDate(1);
  const end = new Date();
  end.setDate(1);

  // Sort history oldest-first; map effective_month -> new_salary
  const changes = [...history]
    .filter(h => h.effective_month && h.new_salary != null)
    .sort((a, b) => (a.effective_month! < b.effective_month! ? -1 : 1));

  // Baseline = earliest change's old_salary, else first change new_salary, else current
  let salary: number | null =
    changes[0]?.old_salary ?? changes[0]?.new_salary ?? currentSalary ?? null;

  const series: { month: string; salary: number | null }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const ym = cursor.toISOString().slice(0, 7);
    const applied = changes.filter(c => c.effective_month === ym);
    if (applied.length) salary = applied[applied.length - 1].new_salary ?? salary;
    series.push({ month: ym, salary });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // If still null everywhere, fall back to current salary flat
  if (series.every(s => s.salary == null) && currentSalary != null) {
    return series.map(s => ({ ...s, salary: currentSalary }));
  }
  return series;
}

/** Self-contained SVG step-line chart for the salary journey. */
function JourneyChart({ series, changes }: { series: { month: string; salary: number | null }[]; changes: ChangeRow[] }) {
  const W = 720, H = 260, PADL = 56, PADR = 20, PADT = 20, PADB = 36;
  const pts = series.filter(s => s.salary != null) as { month: string; salary: number }[];
  if (pts.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No salary data to plot yet.</p>;
  }
  const maxSal = Math.max(...pts.map(p => p.salary));
  const minSal = Math.min(...pts.map(p => p.salary));
  const span = maxSal - minSal || maxSal || 1;
  const yMax = maxSal + span * 0.15;
  const yMin = Math.max(0, minSal - span * 0.15);

  const x = (i: number) => PADL + (i / Math.max(1, series.length - 1)) * (W - PADL - PADR);
  const y = (v: number) => PADT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PADT - PADB);

  // Build a step line: horizontal hold then vertical jump on each change.
  let d = '';
  let lastY: number | null = null;
  series.forEach((s, i) => {
    if (s.salary == null) return;
    const px = x(i), py = y(s.salary);
    if (lastY === null) { d = `M ${px} ${py}`; }
    else { d += ` L ${px} ${lastY} L ${px} ${py}`; }
    lastY = py;
  });

  // change markers
  const changeMonths = new Set(changes.filter(c => c.effective_month).map(c => c.effective_month!));
  const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => yMin + f * (yMax - yMin));
  // X tick every ~Nth month to avoid crowding
  const tickEvery = Math.ceil(series.length / 8) || 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
      {/* grid + y labels */}
      {gridY.map((g, i) => (
        <g key={i}>
          <line x1={PADL} y1={y(g)} x2={W - PADR} y2={y(g)} stroke="#E5E7EB" strokeWidth="1" />
          <text x={PADL - 8} y={y(g) + 4} textAnchor="end" fontSize="10" fill="#6B7280">
            {Math.round(g).toLocaleString()}
          </text>
        </g>
      ))}
      {/* x labels */}
      {series.map((s, i) => (i % tickEvery === 0 ? (
        <text key={s.month} x={x(i)} y={H - PADB + 18} textAnchor="middle" fontSize="9" fill="#6B7280">
          {monthLabel(s.month)}
        </text>
      ) : null))}
      {/* area + line */}
      <path d={d} fill="none" stroke="#2563EB" strokeWidth="2.5" />
      {/* change markers */}
      {series.map((s, i) => (s.salary != null && changeMonths.has(s.month) ? (
        <g key={'m' + i}>
          <circle cx={x(i)} cy={y(s.salary)} r="5" fill="#0D9488" stroke="white" strokeWidth="2" />
        </g>
      ) : null))}
      {/* endpoint */}
      {(() => {
        const last = [...series].reverse().find(s => s.salary != null);
        if (!last) return null;
        const i = series.findIndex(s => s.month === last.month);
        return <circle cx={x(i)} cy={y(last.salary!)} r="4" fill="#2563EB" />;
      })()}
    </svg>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const isAdminOrHR = user?.roles?.some(r =>
    ['Super Admin', 'Company Admin', 'HR Manager'].includes(r.role_name || '')) ?? false;

  const [loading, setLoading] = useState(true);
  const [emp, setEmp] = useState<any | null>(null);
  const [gradeName, setGradeName] = useState<string>('—');
  const [managerName, setManagerName] = useState<string>('—');
  const [currentSalary, setCurrentSalary] = useState<number | null>(null);
  const [currency, setCurrency] = useState('AED');
  const [history, setHistory] = useState<ChangeRow[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: e } = await supabase
        .from('employees')
        .select('*, employee_grades(name), manager:manager_id(first_name,last_name)')
        .eq('id', id)
        .single();
      setEmp(e);
      setGradeName((e?.employee_grades as any)?.name ?? '—');
      const mgr = (e as any)?.manager;
      setManagerName(mgr ? `${mgr.first_name} ${mgr.last_name}` : '—');

      if (e?.grade_id) {
        const today = new Date().toISOString().split('T')[0];
        const { data: sal } = await supabase
          .from('grade_salary_config')
          .select('salary, currency')
          .eq('grade_id', e.grade_id)
          .lte('effective_from', today)
          .order('effective_from', { ascending: false })
          .limit(1);
        setCurrentSalary(sal?.[0]?.salary ?? null);
        setCurrency(sal?.[0]?.currency ?? 'AED');
      }

      const { data: h } = await supabase
        .from('employee_change_history')
        .select('id, change_type, old_salary, new_salary, currency, effective_month, note, changed_at')
        .eq('employee_id', id)
        .order('changed_at', { ascending: true });
      setHistory((h as ChangeRow[]) || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number | null) => (n == null ? '—' : `${currency} ${n.toLocaleString()}`);
  const series = buildSalarySeries(emp?.date_of_joining ?? null, currentSalary, history);

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div></Layout>;
  }
  if (!emp) {
    return <Layout><Card className="p-8 text-center text-gray-500">Employee not found.</Card></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/employees')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft size={18} /> Back to Employees
          </button>
        </div>

        {/* Profile card */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold">
              {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{emp.first_name} {emp.last_name}</h1>
              <p className="text-gray-500">{emp.position || emp.department || '—'}</p>
              <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                emp.status === 'Active' || emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>{emp.status || 'Active'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 text-sm">
            <Info icon={<Mail size={15} />} label="Email" value={emp.email} />
            <Info icon={<Phone size={15} />} label="Phone" value={emp.phone || '—'} />
            <Info icon={<Briefcase size={15} />} label="Department" value={emp.department || '—'} />
            <Info icon={<Award size={15} />} label="Grade" value={gradeName} />
            <Info icon={<UserCheck size={15} />} label="Manager" value={managerName} />
            <Info icon={<Calendar size={15} />} label="Joined" value={emp.date_of_joining || '—'} />
            <Info icon={<TrendingUp size={15} />} label="Current Salary" value={fmt(currentSalary)} />
          </div>
        </Card>

        {/* Journey widget */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Employee Journey</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Salary from joining date to date — markers show grade/salary changes.</p>
          <JourneyChart series={series} changes={history} />
        </Card>

        {/* Change history table */}
        <Card header={<h2 className="text-lg font-semibold">Change History</h2>} noPadding>
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No recorded changes yet. Grade and salary changes will appear here.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-gray-500">
                  <th className="text-left px-6 py-2 font-medium">When</th>
                  <th className="text-left px-6 py-2 font-medium">Type</th>
                  <th className="text-right px-6 py-2 font-medium">From</th>
                  <th className="text-right px-6 py-2 font-medium">To</th>
                  <th className="text-left px-6 py-2 font-medium">Effective</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...history].reverse().map(h => (
                  <tr key={h.id}>
                    <td className="px-6 py-2 text-gray-700">{new Date(h.changed_at).toLocaleDateString()}</td>
                    <td className="px-6 py-2"><span className="capitalize">{h.change_type}</span></td>
                    <td className="px-6 py-2 text-right text-gray-600">{h.old_salary == null ? '—' : `${h.currency} ${h.old_salary.toLocaleString()}`}</td>
                    <td className="px-6 py-2 text-right font-medium text-gray-900">{h.new_salary == null ? '—' : `${h.currency} ${h.new_salary.toLocaleString()}`}</td>
                    <td className="px-6 py-2 text-gray-600">{h.effective_month ? monthLabel(h.effective_month) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Operations placeholder — wired in feature 5 */}
        {isAdminOrHR && (
          <Card className="p-4">
            <p className="text-xs text-gray-400">Management actions (edit, grade, manager, password, delete) are added in the next step.</p>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-gray-400 text-xs uppercase tracking-wide">{icon}{label}</div>
      <p className="text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
