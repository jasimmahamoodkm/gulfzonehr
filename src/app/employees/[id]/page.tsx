'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { ArrowLeft, Mail, Phone, Briefcase, Calendar, Award, UserCheck, TrendingUp, Edit2, Key, Archive, RotateCcw, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getEffectiveSalary, getMergedBenefits } from '@/lib/compensation';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import PromotionRequestModal from '@/components/employees/PromotionRequestModal';

interface ChangeRow {
  id: string;
  change_type: 'grade' | 'salary' | 'benefits';
  old_grade_id: string | null;
  new_grade_id: string | null;
  old_salary: number | null;
  new_salary: number | null;
  currency: string;
  effective_month: string | null;
  note: string | null;
  changed_at: string;
}

const monthLabel = (ym: string) =>
  new Date(ym + '-01').toLocaleString('default', { month: 'short', year: '2-digit' });

interface ChangePoint { month: string; gradeName: string; total: number | null }

/** Numeric amount from a history-note fragment like "AED 1,200" / "removed". */
function parseBenefitAmount(s: string): number {
  const t = s.trim();
  if (/removed|none/i.test(t)) return 0;
  if (/%/.test(t)) return NaN;            // percentage-of-basic: can't resolve here
  const n = t.replace(/[^0-9.]/g, '');
  return n ? parseFloat(n) : 0;
}

/** Net monthly delta a benefits change applied (sum of new − old across items). */
function benefitDelta(note: string | null): number {
  if (!note) return 0;
  let delta = 0;
  for (const part of note.split(';')) {
    const sides = part.split('→');
    if (sides.length < 2) continue;
    const oldV = parseBenefitAmount(sides[0].replace(/^[^:]*:/, ''));
    const newV = parseBenefitAmount(sides[1]);
    if (!isNaN(oldV) && !isNaN(newV)) delta += newV - oldV;
  }
  return delta;
}

/**
 * Build the total-compensation journey. The line plots the total monthly
 * package (basic + monthly benefits) and STEPS at every compensation change —
 * grade, salary, or benefits. Historical totals are reconstructed by walking
 * backward from the current effective total, undoing each change's delta.
 */
function buildPackageJourney(
  joinDate: string | null,
  history: ChangeRow[],
  gradeTotals: Record<string, number>,
  gradeNames: Record<string, string>,
  currentGradeId: string | null,
  currentTotal: number | null,
): { series: { month: string; salary: number | null }[]; points: ChangePoint[] } {
  if (!joinDate || currentTotal == null) return { series: [], points: [] };
  const start = new Date(joinDate); start.setDate(1);
  const end = new Date(); end.setDate(1);
  const joinMonth = start.toISOString().slice(0, 7);

  // All changes oldest-first.
  const changes = [...history]
    .filter(h => h.effective_month)
    .sort((a, b) => (a.effective_month! < b.effective_month! ? -1 : (a.effective_month! > b.effective_month! ? 1 : a.changed_at.localeCompare(b.changed_at))));

  const deltaOf = (h: ChangeRow): number => {
    if (h.change_type === 'grade') {
      const nt = h.new_grade_id ? gradeTotals[h.new_grade_id] : undefined;
      const ot = h.old_grade_id ? gradeTotals[h.old_grade_id] : undefined;
      if (nt != null && ot != null) return nt - ot;
      return (h.new_salary ?? 0) - (h.old_salary ?? 0);
    }
    if (h.change_type === 'salary') return (h.new_salary ?? 0) - (h.old_salary ?? 0);
    return benefitDelta(h.note);
  };

  // Total in effect AFTER each change (reconstructed backward from current).
  const totalAfter = new Array<number>(changes.length);
  let running = currentTotal;
  for (let i = changes.length - 1; i >= 0; i--) {
    totalAfter[i] = running;
    running = running - deltaOf(changes[i]);
  }
  const totalAtJoin = running;

  // Grade in effect after each change (for the marker label).
  const firstGradeChange = changes.find(h => h.change_type === 'grade');
  const joiningGrade = firstGradeChange?.old_grade_id ?? currentGradeId;
  let g = joiningGrade;
  const gradeAfter = changes.map(h => {
    if (h.change_type === 'grade' && h.new_grade_id) g = h.new_grade_id;
    return g;
  });
  const nameOf = (gid: string | null) => (gid ? (gradeNames[gid] || 'Grade') : '—');

  // Segments: joining + one per change (later same-month change wins).
  const segs: { startMonth: string; gradeName: string; total: number }[] = [
    { startMonth: joinMonth, gradeName: nameOf(joiningGrade), total: totalAtJoin },
    ...changes.map((h, i) => ({ startMonth: h.effective_month!, gradeName: nameOf(gradeAfter[i]), total: totalAfter[i] })),
  ];

  const series: { month: string; salary: number | null }[] = [];
  const cursor = new Date(start);
  let idx = 0;
  while (cursor <= end) {
    const ym = cursor.toISOString().slice(0, 7);
    while (idx + 1 < segs.length && segs[idx + 1].startMonth <= ym) idx++;
    series.push({ month: ym, salary: segs[idx]?.total ?? null });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // One marker per month (last change in a month wins).
  const byMonth = new Map<string, ChangePoint>();
  segs.forEach(s => byMonth.set(s.startMonth, { month: s.startMonth, gradeName: s.gradeName, total: s.total }));
  return { series, points: Array.from(byMonth.values()) };
}

/** Self-contained SVG step-line chart for the salary journey. */
function JourneyChart({ series, changePoints, currency = 'AED' }: { series: { month: string; salary: number | null }[]; changePoints: ChangePoint[]; currency?: string }) {
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

  // One marker per grade tenure start (joining / promotion).
  const byMonth = new Map<string, ChangePoint>();
  changePoints.forEach(cp => { if (cp.month) byMonth.set(cp.month, cp); });

  // Smooth inclining line: vertices at joining + each change + the latest month,
  // connected with a Catmull-Rom spline so the package rises gradually.
  const verts: { x: number; y: number }[] = [];
  Array.from(byMonth.values())
    .filter(cp => cp.total != null)
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .forEach(cp => {
      const i = series.findIndex(s => s.month === cp.month);
      if (i >= 0) verts.push({ x: x(i), y: y(cp.total as number) });
    });
  const lastNonNull = [...series].reverse().find(s => s.salary != null);
  if (lastNonNull) {
    const li = series.findIndex(s => s.month === lastNonNull.month);
    const lx = x(li), ly = y(lastNonNull.salary as number);
    if (!verts.length || verts[verts.length - 1].x < lx - 0.5) verts.push({ x: lx, y: ly });
  }
  let d = '';
  if (verts.length === 1) {
    d = `M ${verts[0].x} ${verts[0].y}`;
  } else if (verts.length > 1) {
    d = `M ${verts[0].x} ${verts[0].y}`;
    for (let i = 0; i < verts.length - 1; i++) {
      const p0 = verts[i - 1] || verts[i];
      const p1 = verts[i];
      const p2 = verts[i + 1];
      const p3 = verts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
  }

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
      {/* salary line */}
      <path d={d} fill="none" stroke="#2563EB" strokeWidth="2.5" />
      {/* endpoint (drawn before change markers so markers sit on top) */}
      {(() => {
        const last = [...series].reverse().find(s => s.salary != null);
        if (!last) return null;
        const i = series.findIndex(s => s.month === last.month);
        return <circle cx={x(i)} cy={y(last.salary!)} r="3.5" fill="#2563EB" />;
      })()}
      {/* grade tenure markers — grade name + total package, with hover detail */}
      {Array.from(byMonth.entries()).map(([month, cp]) => {
        const i = series.findIndex(s => s.month === month);
        if (i < 0) return null;
        const s = series[i];
        if (s.salary == null) return null;
        const px = x(i), py = y(s.salary);
        const amt = cp.total != null ? `${currency} ${Math.round(cp.total).toLocaleString()}` : '—';
        const w = Math.max(cp.gradeName.length, amt.length) * 6 + 14;
        const above = py - 34 > PADT;
        const topY = above ? py - 34 : py + 10;
        let lx = px;
        if (lx - w / 2 < PADL) lx = PADL + w / 2;
        if (lx + w / 2 > W - PADR) lx = W - PADR - w / 2;
        return (
          <g key={'cp' + month}>
            <title>{`${monthLabel(month)} · ${cp.gradeName} · total ${amt}`}</title>
            <line x1={px} y1={PADT} x2={px} y2={H - PADB} stroke="#0D9488" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
            <circle cx={px} cy={py} r="6" fill="white" stroke="#0D9488" strokeWidth="2.5" />
            <rect x={lx - w / 2} y={topY} width={w} height={28} rx={4} fill="#0F766E" />
            <text x={lx} y={topY + 11} textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffffff">{cp.gradeName}</text>
            <text x={lx} y={topY + 23} textAnchor="middle" fontSize="10" fontWeight="600" fill="#d1fae5">{amt}</text>
          </g>
        );
      })}
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
  const [gradeNames, setGradeNames] = useState<Record<string, string>>({});
  const [gradeTotals, setGradeTotals] = useState<Record<string, number>>({}); // grade id -> monthly total package
  const [currentTotal, setCurrentTotal] = useState<number | null>(null);       // effective total (override-aware)

  // Management actions (mirrors the list-page operations)
  const [grades, setGrades] = useState<{ id: string; name: string; level: number; salary?: number; currency?: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 'edit' | 'grade' | 'manager' | 'password' | 'delete'

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', position: '', department: '', employment_type: '', status: '', date_of_joining: '' });
  const [showGrade, setShowGrade] = useState(false);
  const [gradeChoice, setGradeChoice] = useState('');
  const [showManager, setShowManager] = useState(false);
  const [managerChoice, setManagerChoice] = useState('');
  const [showPromotion, setShowPromotion] = useState(false);
  const [tempPw, setTempPw] = useState<{ name: string; email: string; password: string; emailSent: boolean } | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

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

      const today = new Date().toISOString().split('T')[0];

      // Wave 1 — everything that only needs the employee row, in parallel:
      // currency, effective salary (override-aware), merged benefits, change
      // history, the company's grade list and the company employee list.
      const [currencyRes, effSalary, mergedBenefits, historyRes, gradesRes, empsRes] = await Promise.all([
        e?.grade_id
          ? supabase.from('grade_salary_config').select('currency')
              .eq('grade_id', e.grade_id).lte('effective_from', today)
              .order('effective_from', { ascending: false }).limit(1)
          : Promise.resolve({ data: null } as any),
        getEffectiveSalary(supabase, {
          salaryOverride: (e as any)?.salary_override ?? null,
          gradeId: e?.grade_id ?? null,
        }),
        e?.grade_id ? getMergedBenefits(supabase, id, e.grade_id) : Promise.resolve([]),
        supabase.from('employee_change_history')
          .select('id, change_type, old_grade_id, new_grade_id, old_salary, new_salary, currency, effective_month, note, changed_at')
          .eq('employee_id', id)
          .order('changed_at', { ascending: true }),
        e?.company_id
          ? supabase.from('employee_grades').select('id, name, level')
              .eq('company_id', e.company_id).eq('active', true).order('level')
          : Promise.resolve({ data: [] } as any),
        e?.company_id
          ? supabase.from('employees').select('id, user_id, first_name, last_name').eq('company_id', e.company_id)
          : Promise.resolve({ data: [] } as any),
      ]);

      setCurrency(currencyRes.data?.[0]?.currency ?? 'AED');
      setCurrentSalary(effSalary || null);

      // Effective total package = basic + merged monthly (non-annual) benefits.
      const monthlyBenefits = mergedBenefits
        .filter(b => !/annual/i.test(b.benefit_type))
        .reduce((sum, b) => sum + (b.value_type === 'percentage'
          ? (Number(b.benefit_value) / 100) * (effSalary || 0)
          : Number(b.benefit_value || 0)), 0);
      setCurrentTotal((effSalary || 0) + monthlyBenefits);

      const rows = (historyRes.data as ChangeRow[]) || [];
      setHistory(rows);

      const gradesData = gradesRes.data || [];
      const gIds = gradesData.map((g: any) => g.id);
      const emps = empsRes.data || [];
      const userIds = emps.map((x: any) => x.user_id).filter(Boolean);

      // Grade ids referenced by the history (for the From/To grade names).
      const histGradeIds = Array.from(new Set(
        rows.flatMap(r => [r.old_grade_id, r.new_grade_id]).filter(Boolean) as string[]
      ));
      if (e?.grade_id) histGradeIds.push(e.grade_id);

      // Wave 2 — lookups that depend on wave-1 ids, in parallel.
      const [gnRes, salCfgRes, gradeBenRes, roleRes] = await Promise.all([
        histGradeIds.length
          ? supabase.from('employee_grades').select('id, name').in('id', Array.from(new Set(histGradeIds)))
          : Promise.resolve({ data: [] } as any),
        gIds.length
          ? supabase.from('grade_salary_config')
              .select('grade_id, salary, currency, effective_from')
              .in('grade_id', gIds).lte('effective_from', today)
              .order('effective_from', { ascending: false })
          : Promise.resolve({ data: [] } as any),
        gIds.length
          ? supabase.from('grade_benefits')
              .select('grade_id, benefit_type, benefit_value, value_type, active')
              .in('grade_id', gIds).eq('active', true)
          : Promise.resolve({ data: [] } as any),
        userIds.length
          ? supabase.from('user_roles').select('user_id, roles(name)').in('user_id', userIds)
          : Promise.resolve({ data: [] } as any),
      ]);

      const map: Record<string, string> = {};
      (gnRes.data || []).forEach((g: any) => { map[g.id] = g.name; });
      setGradeNames(map);

      const salMap: Record<string, { salary: number; currency: string }> = {};
      (salCfgRes.data || []).forEach((s: any) => { if (!salMap[s.grade_id]) salMap[s.grade_id] = { salary: s.salary, currency: s.currency }; });
      setGrades(gradesData.map((g: any) => ({ ...g, salary: salMap[g.id]?.salary, currency: salMap[g.id]?.currency })));

      // Per-grade total package (basic + monthly benefits) for the journey chart.
      const benByGrade: Record<string, number> = {};
      (gradeBenRes.data || []).forEach((b: any) => {
        if (/annual/i.test(b.benefit_type)) return;
        const basic = salMap[b.grade_id]?.salary ?? 0;
        benByGrade[b.grade_id] = (benByGrade[b.grade_id] || 0) +
          (b.value_type === 'percentage' ? (Number(b.benefit_value) / 100) * basic : Number(b.benefit_value || 0));
      });
      const totals: Record<string, number> = {};
      gIds.forEach((gid: string) => { totals[gid] = (salMap[gid]?.salary ?? 0) + (benByGrade[gid] || 0); });
      setGradeTotals(totals);

      // Managers = company employees holding the Manager role.
      const mgrUserIds = new Set((roleRes.data || []).filter((r: any) => r.roles?.name === 'Manager').map((r: any) => r.user_id));
      setManagers(emps.filter((x: any) => mgrUserIds.has(x.user_id)).map((x: any) => ({ id: x.id, name: `${x.first_name} ${x.last_name}` })));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number | null) => (n == null ? '—' : `${currency} ${n.toLocaleString()}`);
  const { series, points: journeyPoints } = buildPackageJourney(
    emp?.date_of_joining ?? null, history, gradeTotals, gradeNames, emp?.grade_id ?? null, currentTotal,
  );

  // What the From / To columns show, per change type.
  const money = (n: number | null, ccy: string) => (n == null ? null : `${ccy || currency} ${n.toLocaleString()}`);
  const fromTo = (h: ChangeRow): { from: string; to: string } => {
    if (h.change_type === 'grade') {
      const g = (gid: string | null, sal: number | null) => {
        const name = gid ? (gradeNames[gid] || 'Grade') : '—';
        const m = money(sal, h.currency);
        return m ? `${name} (${m})` : name;
      };
      return { from: g(h.old_grade_id, h.old_salary), to: g(h.new_grade_id, h.new_salary) };
    }
    if (h.change_type === 'salary') {
      return { from: money(h.old_salary, h.currency) || '—', to: money(h.new_salary, h.currency) || '—' };
    }
    return { from: '—', to: h.note || 'Benefits updated' };
  };

  const flash = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };
  const authToken = async () => (await supabase.auth.getSession()).data.session?.access_token;

  // ── Edit ──
  const openEdit = () => {
    setEditForm({
      first_name: emp.first_name ?? '', last_name: emp.last_name ?? '',
      position: emp.position ?? '', department: emp.department ?? '',
      employment_type: emp.employment_type ?? '', status: emp.status ?? '',
      date_of_joining: emp.date_of_joining ?? '',
    });
    setShowEdit(true);
  };
  const saveEdit = async () => {
    setBusy('edit');
    try {
      const { error } = await supabase.from('employees').update({
        first_name: editForm.first_name, last_name: editForm.last_name,
        position: editForm.position || null, department: editForm.department || null,
        employment_type: editForm.employment_type || null, status: editForm.status || null,
        date_of_joining: editForm.date_of_joining || null,
      }).eq('id', emp.id);
      if (error) throw error;
      setShowEdit(false);
      flash('success', 'Employee updated');
      await load();
    } catch (err) { flash('error', (err as any)?.message || 'Failed to update'); }
    finally { setBusy(null); }
  };

  // ── Assign grade (direct) ──
  const saveGrade = async () => {
    setBusy('grade');
    try {
      const res = await fetch(apiUrl(`/api/employees/${emp.id}/change-grade`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authToken()}` },
        body: JSON.stringify({ grade_id: gradeChoice || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to assign grade');
      setShowGrade(false);
      flash('success', 'Grade updated');
      await load();
    } catch (err) { flash('error', (err as any)?.message || 'Failed to assign grade'); }
    finally { setBusy(null); }
  };

  // ── Assign manager ──
  const saveManager = async () => {
    setBusy('manager');
    try {
      const res = await fetch(apiUrl('/api/employees/assign-manager'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authToken()}` },
        body: JSON.stringify({ employee_id: emp.id, manager_id: managerChoice || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to assign manager');
      setShowManager(false);
      flash('success', 'Manager updated');
      await load();
    } catch (err) { flash('error', (err as any)?.message || 'Failed to assign manager'); }
    finally { setBusy(null); }
  };

  // ── Generate temporary password ──
  const genPassword = async () => {
    setBusy('password');
    try {
      const res = await fetch(apiUrl('/api/admin/generate-temp-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authToken()}` },
        body: JSON.stringify({ employee_id: emp.id, company_id: emp.company_id, send_email: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to generate password');
      setTempPw({
        name: json.data.employee_name, email: json.data.employee_email,
        password: json.data.temporaryPassword, emailSent: json.data.emailSent,
      });
    } catch (err) { flash('error', (err as any)?.message || 'Failed to generate password'); }
    finally { setBusy(null); }
  };

  // ── Archive (soft delete: keep the record, set status Inactive) ──
  const doArchive = async () => {
    if (!confirm(`Archive ${emp.first_name} ${emp.last_name}? They will be set to Inactive but kept for history.`)) return;
    setBusy('archive');
    try {
      const { error } = await supabase.from('employees')
        .update({ status: 'Inactive', archived_at: new Date().toISOString(), archived_by: user?.id ?? null })
        .eq('id', emp.id);
      if (error) throw error;
      flash('success', 'Employee archived');
      await load();
    } catch (err) { flash('error', (err as any)?.message || 'Failed to archive'); }
    finally { setBusy(null); }
  };
  const doReactivate = async () => {
    setBusy('archive');
    try {
      const { error } = await supabase.from('employees')
        .update({ status: 'Active', archived_at: null, archived_by: null })
        .eq('id', emp.id);
      if (error) throw error;
      flash('success', 'Employee reactivated');
      await load();
    } catch (err) { flash('error', (err as any)?.message || 'Failed to reactivate'); }
    finally { setBusy(null); }
  };

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
        {/* Header + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => router.push('/employees')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft size={18} /> Back to Employees
          </button>
          {isAdminOrHR && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" onClick={openEdit}>
                <Edit2 size={15} className="mr-1.5" /> Edit
              </Button>
              <Button variant="secondary" onClick={() => { setGradeChoice(emp.grade_id ?? ''); setShowGrade(true); }}>
                <Award size={15} className="mr-1.5" /> Grade
              </Button>
              <Button variant="secondary" onClick={() => { setManagerChoice(emp.manager_id ?? ''); setShowManager(true); }}>
                <UserCheck size={15} className="mr-1.5" /> Manager
              </Button>
              <Button variant="secondary" onClick={() => setShowPromotion(true)}>
                <TrendingUp size={15} className="mr-1.5" /> Promotion
              </Button>
              <Button variant="secondary" onClick={genPassword} disabled={busy === 'password'}>
                <Key size={15} className="mr-1.5" /> {busy === 'password' ? 'Working…' : 'Password'}
              </Button>
              {emp.archived_at ? (
                <Button variant="secondary" onClick={doReactivate} disabled={busy === 'archive'}>
                  <RotateCcw size={15} className="mr-1.5" /> {busy === 'archive' ? 'Working…' : 'Reactivate'}
                </Button>
              ) : (
                <Button variant="danger" onClick={doArchive} disabled={busy === 'archive'}>
                  <Archive size={15} className="mr-1.5" /> {busy === 'archive' ? 'Working…' : 'Archive'}
                </Button>
              )}
            </div>
          )}
        </div>

        {msg && (
          <div className={`p-3 rounded-lg border text-sm flex justify-between items-start ${
            msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <span className="font-medium">{msg.text}</span>
            <button onClick={() => setMsg(null)} className="text-lg leading-none opacity-70 hover:opacity-100">×</button>
          </div>
        )}

        {/* Profile card */}
        <Card className="p-6">
          {emp.archived_at && (
            <div className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <Archive size={15} /> Archived on {new Date(emp.archived_at).toLocaleDateString()} — status set to Inactive. Use “Reactivate” to restore.
            </div>
          )}
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
            <Info icon={<TrendingUp size={15} />} label="Total Package" value={fmt(currentTotal)} />
            {emp.archived_at && <Info icon={<Archive size={15} />} label="Archived" value={new Date(emp.archived_at).toLocaleDateString()} />}
          </div>
        </Card>

        {/* Journey widget */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Employee Journey</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Total monthly package (basic + benefits) from joining date — each marker shows the grade and total at that promotion.</p>
          <JourneyChart series={series} changePoints={journeyPoints} currency={currency} />
        </Card>

        {/* Change history table */}
        <Card header={<h2 className="text-lg font-semibold">Change History</h2>} noPadding>
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No recorded changes yet. Grade and salary changes will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[36rem]">
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
                  {[...history].reverse().map(h => {
                    const ft = fromTo(h);
                    return (
                    <tr key={h.id}>
                      <td className="px-6 py-2 text-gray-700">{new Date(h.changed_at).toLocaleDateString()}</td>
                      <td className="px-6 py-2"><span className="capitalize">{h.change_type}</span></td>
                      {h.change_type === 'benefits' ? (
                        <td className="px-6 py-2 text-gray-700" colSpan={2}>{h.note || 'Benefits updated'}</td>
                      ) : (
                        <>
                          <td className="px-6 py-2 text-right text-gray-600">{ft.from}</td>
                          <td className="px-6 py-2 text-right font-medium text-gray-900">{ft.to}</td>
                        </>
                      )}
                      <td className="px-6 py-2 text-gray-600">{h.effective_month ? monthLabel(h.effective_month) : '—'}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>

      {/* ── Edit modal ── */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit — ${emp.first_name} ${emp.last_name}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input className={inputCls} value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} /></Field>
            <Field label="Last name"><input className={inputCls} value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Position"><input className={inputCls} value={editForm.position} onChange={e => setEditForm({ ...editForm, position: e.target.value })} /></Field>
            <Field label="Department"><input className={inputCls} value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employment type">
              <select className={inputCls} value={editForm.employment_type} onChange={e => setEditForm({ ...editForm, employment_type: e.target.value })}>
                <option value="">—</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="">—</option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <Field label="Date of joining">
            <DatePicker value={editForm.date_of_joining} onChange={(d) => setEditForm({ ...editForm, date_of_joining: d })} placeholder="Select joining date" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowEdit(false)} disabled={busy === 'edit'}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy === 'edit'}>{busy === 'edit' ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Assign grade (direct) ── */}
      <Modal isOpen={showGrade} onClose={() => setShowGrade(false)} title={`Assign Grade — ${emp.first_name} ${emp.last_name}`}>
        <div className="space-y-4">
          {grades.length === 0 ? (
            <p className="text-sm text-gray-500">No grades configured. <Link href="/admin/grades" target="_blank" className="text-blue-600 underline">Create grades</Link> first.</p>
          ) : (
            <select className={inputCls} value={gradeChoice} onChange={e => setGradeChoice(e.target.value)}>
              <option value="">No grade</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name} (L{g.level}){g.salary != null ? ` — AED ${g.salary.toLocaleString()}` : ''}</option>)}
            </select>
          )}
          <p className="text-xs text-gray-400">Direct assignment is recorded in the change history. For a salary/benefit change, use “Promotion”.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowGrade(false)} disabled={busy === 'grade'}>Cancel</Button>
            <Button onClick={saveGrade} disabled={busy === 'grade'}>{busy === 'grade' ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Assign manager ── */}
      <Modal isOpen={showManager} onClose={() => setShowManager(false)} title={`Assign Manager — ${emp.first_name} ${emp.last_name}`}>
        <div className="space-y-4">
          {managers.length === 0 ? (
            <p className="text-sm text-gray-500">No employees hold the Manager role in this company yet.</p>
          ) : (
            <select className={inputCls} value={managerChoice} onChange={e => setManagerChoice(e.target.value)}>
              <option value="">No manager</option>
              {managers.filter(m => m.id !== emp.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowManager(false)} disabled={busy === 'manager'}>Cancel</Button>
            <Button onClick={saveManager} disabled={busy === 'manager'}>{busy === 'manager' ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Promotion / Demotion request ── */}
      <PromotionRequestModal
        isOpen={showPromotion}
        onClose={() => setShowPromotion(false)}
        employee={{ id: emp.id, name: `${emp.first_name} ${emp.last_name}` }}
        currentGradeId={emp.grade_id ?? null}
        currentSalary={currentSalary}
        grades={grades}
        onSubmitted={(m) => flash('success', m)}
      />

      {/* ── Temporary password result ── */}
      <Modal isOpen={!!tempPw} onClose={() => { setTempPw(null); setCopiedPw(false); }} title="Temporary Password">
        {tempPw && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">New temporary password for <span className="font-medium text-gray-900">{tempPw.name}</span> ({tempPw.email}).</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg font-mono text-gray-900">{tempPw.password}</code>
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(tempPw.password); setCopiedPw(true); setTimeout(() => setCopiedPw(false), 2000); }}>
                {copiedPw ? <Check size={15} /> : <Copy size={15} />}
              </Button>
            </div>
            <p className={tempPw.emailSent ? 'text-green-700' : 'text-amber-700'}>
              {tempPw.emailSent ? '✓ Emailed to the employee.' : '⚠ Email not sent — share this password securely.'}
            </p>
            <div className="flex justify-end"><Button onClick={() => { setTempPw(null); setCopiedPw(false); }}>Done</Button></div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
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
