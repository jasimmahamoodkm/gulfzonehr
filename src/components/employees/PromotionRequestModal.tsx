'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Plus, X, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/lib/api';
import { getMergedBenefits } from '@/lib/compensation';

interface GradeOption { id: string; name: string; level: number; salary?: number; currency?: string }

type BenefitAction = 'none' | 'update' | 'remove';
interface BenefitEdit {
  benefit_type: string;
  current_value: number | null;          // null for a benefit not currently held
  current_value_type: 'fixed' | 'percentage';
  new_value: number;
  value_type: 'fixed' | 'percentage';
  action: BenefitAction;
  isCustom: boolean;                      // a benefit the grade doesn't provide
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: { id: string; name: string } | null;
  currentGradeId: string | null;
  currentSalary: number | null;
  grades: GradeOption[];
  onSubmitted: (message: string) => void;
}

const fmtBenefit = (val: number | null, vtype: string) =>
  val == null ? '—' : vtype === 'percentage' ? `${val}% of basic` : `AED ${val.toLocaleString()}`;

export default function PromotionRequestModal({
  isOpen, onClose, employee, currentGradeId, currentSalary, grades, onSubmitted,
}: Props) {
  const [changeGrade, setChangeGrade] = useState(false);
  const [requestedGradeId, setRequestedGradeId] = useState('');
  const [changeSalary, setChangeSalary] = useState(false);
  const [requestedSalary, setRequestedSalary] = useState<string>('');
  const [changeBenefits, setChangeBenefits] = useState(false);
  const [benefitEdits, setBenefitEdits] = useState<BenefitEdit[]>([]);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeId = employee?.id;

  const loadBenefits = useCallback(async () => {
    if (!employeeId) return;
    setBenefitsLoading(true);
    try {
      const rows = await getMergedBenefits(supabase, employeeId, currentGradeId);
      setBenefitEdits(rows.map(r => ({
        benefit_type: r.benefit_type,
        current_value: r.benefit_value,
        current_value_type: (r.value_type as 'fixed' | 'percentage') || 'fixed',
        new_value: r.benefit_value,
        value_type: (r.value_type as 'fixed' | 'percentage') || 'fixed',
        action: 'none',
        isCustom: false,
      })));
    } catch {
      setBenefitEdits([]);
    } finally {
      setBenefitsLoading(false);
    }
  }, [employeeId, currentGradeId]);

  // Reset whenever a new employee is targeted, and preload their benefits.
  useEffect(() => {
    if (isOpen) {
      setChangeGrade(false); setRequestedGradeId('');
      setChangeSalary(false); setRequestedSalary(currentSalary != null ? String(currentSalary) : '');
      setChangeBenefits(false);
      setReason(''); setError(null);
      loadBenefits();
    }
  }, [isOpen, currentSalary, loadBenefits]);

  if (!employee) return null;

  const currentGradeName = grades.find(g => g.id === currentGradeId)?.name || '—';
  const newGradeSalary = grades.find(g => g.id === requestedGradeId)?.salary;

  const patchBenefit = (i: number, patch: Partial<BenefitEdit>) =>
    setBenefitEdits(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addCustomBenefit = () =>
    setBenefitEdits(prev => [...prev, {
      benefit_type: '', current_value: null, current_value_type: 'fixed',
      new_value: 0, value_type: 'fixed', action: 'update', isCustom: true,
    }]);
  const removeCustomBenefit = (i: number) =>
    setBenefitEdits(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(null);
    if (!changeGrade && !changeSalary && !changeBenefits) {
      setError('Select at least one change: grade, salary, or benefits.');
      return;
    }
    if (changeGrade && !requestedGradeId) { setError('Choose the new grade.'); return; }
    if (changeSalary && (requestedSalary === '' || isNaN(Number(requestedSalary)))) {
      setError('Enter a valid new salary.'); return;
    }
    const benefitChanges = benefitEdits
      .filter(b => b.action !== 'none' && b.benefit_type.trim())
      .map(b => ({
        benefit_type: b.benefit_type.trim(),
        benefit_value: b.action === 'remove' ? undefined : Number(b.new_value) || 0,
        value_type: b.value_type,
        action: b.action === 'remove' ? 'remove' : 'update',
      }));
    if (changeBenefits && benefitChanges.length === 0) {
      setError('Mark at least one benefit to update or remove, or untick "Change benefits".'); return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/grade-changes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          employee_id: employee.id,
          change_grade: changeGrade,
          requested_grade_id: changeGrade ? requestedGradeId : null,
          change_salary: changeSalary,
          requested_salary: changeSalary ? Number(requestedSalary) : null,
          change_benefits: changeBenefits,
          benefit_changes: changeBenefits ? benefitChanges : null,
          reason: reason.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to submit request'); return; }
      onSubmitted(`Promotion / demotion request submitted for ${employee.name} — pending approval.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Promotion / Demotion — ${employee.name}`}>
      <div className="space-y-5">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
          <div className="flex items-center gap-2 text-gray-800 font-medium mb-1">
            <TrendingUp size={16} className="text-blue-600" /> Current
          </div>
          Grade: <span className="font-medium text-gray-900">{currentGradeName}</span>
          {currentSalary != null && <> · Salary: <span className="font-medium text-gray-900">AED {currentSalary.toLocaleString()}</span></>}
        </div>

        {/* Grade change */}
        <div className="border border-gray-200 rounded-lg p-3">
          <label className="flex items-center gap-2 font-medium text-gray-800">
            <input type="checkbox" checked={changeGrade} onChange={e => setChangeGrade(e.target.checked)} />
            Change grade
          </label>
          {changeGrade && (
            <div className="mt-3">
              <select
                value={requestedGradeId}
                onChange={e => setRequestedGradeId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select new grade…</option>
                {grades.filter(g => g.id !== currentGradeId).map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} (L{g.level}){g.salary != null ? ` — AED ${g.salary.toLocaleString()}` : ''}
                  </option>
                ))}
              </select>
              {newGradeSalary != null && (
                <p className="text-xs text-gray-500 mt-1">New grade salary: AED {newGradeSalary.toLocaleString()}</p>
              )}
            </div>
          )}
        </div>

        {/* Salary change */}
        <div className="border border-gray-200 rounded-lg p-3">
          <label className="flex items-center gap-2 font-medium text-gray-800">
            <input type="checkbox" checked={changeSalary} onChange={e => setChangeSalary(e.target.checked)} />
            Change salary (keep grade)
          </label>
          {changeSalary && (
            <div className="mt-3">
              <input
                type="number" min="0" step="0.01" value={requestedSalary}
                onChange={e => setRequestedSalary(e.target.value)}
                placeholder="New basic salary (AED)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Applied as a per-employee override on approval.</p>
            </div>
          )}
        </div>

        {/* Benefits change */}
        <div className="border border-gray-200 rounded-lg p-3">
          <label className="flex items-center gap-2 font-medium text-gray-800">
            <input type="checkbox" checked={changeBenefits} onChange={e => setChangeBenefits(e.target.checked)} />
            Change benefits (keep grade)
          </label>
          {changeBenefits && (
            <div className="mt-3">
              {benefitsLoading ? (
                <p className="text-sm text-gray-500">Loading benefits…</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                          <th className="py-1.5 pr-2 font-medium">Benefit</th>
                          <th className="py-1.5 px-2 font-medium">Current</th>
                          <th className="py-1.5 px-2 font-medium">Action</th>
                          <th className="py-1.5 pl-2 font-medium">New value</th>
                          <th className="w-6" />
                        </tr>
                      </thead>
                      <tbody>
                        {benefitEdits.length === 0 && (
                          <tr><td colSpan={5} className="py-3 text-gray-500 italic">
                            This grade has no benefits configured. Add one below.
                          </td></tr>
                        )}
                        {benefitEdits.map((b, i) => (
                          <tr key={i} className="border-b border-gray-100 align-middle">
                            <td className="py-2 pr-2">
                              {b.isCustom ? (
                                <input
                                  type="text" value={b.benefit_type}
                                  onChange={e => patchBenefit(i, { benefit_type: e.target.value })}
                                  placeholder="Benefit name"
                                  className="w-full min-w-[120px] border border-gray-300 rounded px-2 py-1 text-sm"
                                />
                              ) : (
                                <span className="text-gray-900">{b.benefit_type}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                              {fmtBenefit(b.current_value, b.current_value_type)}
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={b.action}
                                onChange={e => patchBenefit(i, { action: e.target.value as BenefitAction })}
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                {!b.isCustom && <option value="none">Keep</option>}
                                <option value="update">Update</option>
                                <option value="remove">Remove</option>
                              </select>
                            </td>
                            <td className="py-2 pl-2">
                              {b.action === 'update' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number" min="0" step="0.01" value={b.new_value}
                                    onChange={e => patchBenefit(i, { new_value: Number(e.target.value) })}
                                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                                  />
                                  <select
                                    value={b.value_type}
                                    onChange={e => patchBenefit(i, { value_type: e.target.value as 'fixed' | 'percentage' })}
                                    className="border border-gray-300 rounded px-1 py-1 text-sm"
                                  >
                                    <option value="fixed">AED</option>
                                    <option value="percentage">%</option>
                                  </select>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2">
                              {b.isCustom && (
                                <button type="button" onClick={() => removeCustomBenefit(i)} className="p-1 text-gray-400 hover:text-red-600" title="Remove line">
                                  <X size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={addCustomBenefit} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                    <Plus size={14} /> Add another benefit
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason / justification</label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="Why is this change requested?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
        <p className="text-xs text-gray-400">Requires approval by an HR Manager or above (other than yourself).</p>
      </div>
    </Modal>
  );
}
