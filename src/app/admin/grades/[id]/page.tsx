'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DatePicker from '@/components/ui/DatePicker';
import { supabase } from '@/lib/supabase';
import { EmployeeGrade, GradeLeaveConfig, GradeSalaryConfig, GradeBenefit, BenefitType } from '@/types/index';
import { apiUrl } from '@/lib/api';
import { useTimeouts } from '@/hooks/useTimeouts';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Gift,
  Edit2,
  Plus,
  Trash2,
  Save,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const BENEFIT_TYPES: BenefitType[] = [
  'Health Insurance',
  'Housing Allowance',
  'Transport Allowance',
  'Education Allowance',
  'Annual Bonus',
  'Performance Bonus',
  'Meal Allowance',
  'Phone Allowance',
  'Annual Flight Ticket',
  'Gratuity',
  'Pension',
  'Other',
];

type Tab = 'leave' | 'salary' | 'benefits';

interface LeaveType {
  id: string;
  name: string;
  color?: string;
}

export default function GradeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gradeId = params.id as string;

  const [grade, setGrade] = useState<EmployeeGrade | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('leave');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const schedule = useTimeouts();

  // Leave tab state
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveConfigs, setLeaveConfigs] = useState<GradeLeaveConfig[]>([]);
  const [editingLeave, setEditingLeave] = useState<string | null>(null); // leave_type_id
  const [leaveForm, setLeaveForm] = useState({ days_per_year: '', carry_forward_days: '', carry_forward_expiry_months: '3' });
  const [savingLeave, setSavingLeave] = useState(false);

  // Salary tab state
  const [salaryConfigs, setSalaryConfigs] = useState<GradeSalaryConfig[]>([]);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    salary: '',
    salary_component: 'Basic Salary',
    currency: 'AED',
    effective_from: '',
    effective_to: '',
    notes: ''
  });
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState('');

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Benefits tab state
  const [benefits, setBenefits] = useState<GradeBenefit[]>([]);
  const [showBenefitForm, setShowBenefitForm] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<GradeBenefit | null>(null);
  const [benefitForm, setBenefitForm] = useState({
    benefit_type: 'Other' as BenefitType,
    benefit_value: '',
    value_type: 'fixed' as 'fixed' | 'percentage',
    currency: 'AED',
    description: '',
  });
  const [savingBenefit, setSavingBenefit] = useState(false);
  const [benefitError, setBenefitError] = useState('');

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    schedule(() => setNotification(null), 3500);
  };

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // --- Load grade ---
  const fetchGrade = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load grade');
      setGrade(json.data);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to load grade', 'error');
    }
  }, [gradeId]);

  // --- Load leave types (global — shared by all companies) ---
  const fetchLeaveTypes = useCallback(async () => {
    const { data } = await supabase
      .from('leave_types')
      .select('id, name, color')
      .order('name');
    setLeaveTypes(data || []);
  }, []);

  // --- Load leave configs ---
  const fetchLeaveConfigs = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}/leave-config`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setLeaveConfigs(json.data || []);
    } catch { /* silent */ }
  }, [gradeId]);

  // --- Load salary configs ---
  const fetchSalaryConfigs = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}/salary-config`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setSalaryConfigs(json.data || []);
    } catch { /* silent */ }
  }, [gradeId]);

  // --- Load benefits ---
  const fetchBenefits = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}/benefits`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setBenefits(json.data || []);
    } catch { /* silent */ }
  }, [gradeId]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchGrade(), fetchLeaveTypes(), fetchLeaveConfigs(), fetchSalaryConfigs(), fetchBenefits()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchGrade, fetchLeaveTypes, fetchLeaveConfigs, fetchSalaryConfigs, fetchBenefits]);

  // --- Leave helpers ---
  const getLeaveConfig = (leaveTypeId: string) =>
    leaveConfigs.find(c => c.leave_type_id === leaveTypeId);

  const startEditLeave = (lt: LeaveType) => {
    const existing = getLeaveConfig(lt.id);
    setLeaveForm({
      days_per_year: existing ? String(existing.days_per_year) : '',
      carry_forward_days: existing ? String(existing.carry_forward_days) : '0',
      carry_forward_expiry_months: existing ? String(existing.carry_forward_expiry_months) : '3',
    });
    setEditingLeave(lt.id);
  };

  const saveLeaveConfig = async (leaveTypeId: string) => {
    setSavingLeave(true);
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}/leave-config`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type_id: leaveTypeId,
          days_per_year: Number(leaveForm.days_per_year) || 0,
          carry_forward_days: Number(leaveForm.carry_forward_days) || 0,
          carry_forward_expiry_months: Number(leaveForm.carry_forward_expiry_months) || 3,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      showNotification('Leave configuration saved');
      setEditingLeave(null);
      fetchLeaveConfigs();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to save leave config', 'error');
    } finally {
      setSavingLeave(false);
    }
  };

  // --- Salary helpers ---
  const saveSalaryConfig = async () => {
    setSalaryError('');
    if (!salaryForm.salary || !salaryForm.effective_from) {
      setSalaryError('Salary and effective from date are required');
      return;
    }
    setSavingSalary(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }


      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}/salary-config`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salary: Number(salaryForm.salary),
          salary_component: salaryForm.salary_component || 'Basic Salary',
          currency: salaryForm.currency || 'AED',
          effective_from: salaryForm.effective_from,
          effective_to: salaryForm.effective_to || undefined,
          notes: salaryForm.notes || undefined,
        }),
      });


      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Failed to save salary config (Status: ${res.status})`);
      }

      showNotification('Salary saved successfully');
      setShowSalaryForm(false);
      setSalaryForm({
        salary: '',
        salary_component: 'Basic Salary',
        currency: 'AED',
        effective_from: getTodayDateString(),
        effective_to: '',
        notes: ''
      });
      await fetchSalaryConfigs();
      await fetchGrade();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save salary';
      console.error('Error saving salary:', errorMessage, err);
      setSalaryError(errorMessage);
    } finally {
      setSavingSalary(false);
    }
  };

  const deleteSalaryConfig = async (configId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}/salary-config?config_id=${configId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      showNotification('Salary band removed');
      fetchSalaryConfigs();
      fetchGrade();
    } catch {
      showNotification('Failed to delete salary band', 'error');
    }
  };

  // --- Benefit helpers ---
  const resetBenefitForm = () => {
    setBenefitForm({ benefit_type: 'Other', benefit_value: '', value_type: 'fixed', currency: 'AED', description: '' });
    setBenefitError('');
    setEditingBenefit(null);
  };

  const openAddBenefit = () => { resetBenefitForm(); setShowBenefitForm(true); };

  const openEditBenefit = (b: GradeBenefit) => {
    setEditingBenefit(b);
    setBenefitForm({
      benefit_type: b.benefit_type,
      benefit_value: b.benefit_value !== null && b.benefit_value !== undefined ? String(b.benefit_value) : '',
      value_type: b.value_type,
      currency: b.currency,
      description: b.description || '',
    });
    setBenefitError('');
    setShowBenefitForm(true);
  };

  const saveBenefit = async () => {
    setBenefitError('');
    if (!benefitForm.benefit_type) { setBenefitError('Benefit type is required'); return; }
    setSavingBenefit(true);
    try {
      const token = await getToken();
      const url = apiUrl(`/api/admin/grades/${gradeId}/benefits`);
      const method = editingBenefit ? 'PATCH' : 'POST';
      const body = editingBenefit
        ? {
            benefit_id: editingBenefit.id,
            ...benefitForm,
            benefit_value: benefitForm.benefit_value !== '' ? Number(benefitForm.benefit_value) : null,
          }
        : {
            ...benefitForm,
            benefit_value: benefitForm.benefit_value !== '' ? Number(benefitForm.benefit_value) : null,
          };


      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });


      const json = await res.json();

      if (!res.ok) {
        const errorMsg = json.error || `Failed to save benefit (Status: ${res.status})`;
        throw new Error(errorMsg);
      }

      showNotification(editingBenefit ? 'Benefit updated' : 'Benefit added');
      setShowBenefitForm(false);
      resetBenefitForm();
      await fetchBenefits();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save benefit';
      console.error('[saveBenefit] Error:', errorMessage, err);
      setBenefitError(errorMessage);
    } finally {
      setSavingBenefit(false);
    }
  };

  const toggleBenefitActive = async (benefit: GradeBenefit) => {
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/admin/grades/${gradeId}/benefits`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ benefit_id: benefit.id, active: !benefit.active }),
      });
      fetchBenefits();
    } catch { /* silent */ }
  };

  const deleteBenefit = async (benefitId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/admin/grades/${gradeId}/benefits?benefit_id=${benefitId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      showNotification('Benefit removed');
      fetchBenefits();
    } catch {
      showNotification('Failed to delete benefit', 'error');
    }
  };

  const formatSalary = (value: number, currency: string) =>
    `${currency} ${Number(value).toLocaleString()}`;

  const today = new Date().toISOString().split('T')[0];

  const currentSalary = salaryConfigs.find(s => {
    const from = s.effective_from <= today;
    const to = !s.effective_to || s.effective_to >= today;
    return from && to;
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/grades')}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-7 bg-secondary rounded w-48 animate-pulse" />
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{grade?.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-accent text-primary text-sm font-medium">
                  Level {grade?.level}
                </span>
                {grade && !grade.active && (
                  <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                    Inactive
                  </span>
                )}
              </div>
            )}
            {grade?.description && (
              <p className="text-muted-foreground text-sm mt-0.5">{grade.description}</p>
            )}
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div
            className={`px-4 py-3 rounded-lg text-sm font-medium ${
              notification.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-destructive/10 text-red-800 border border-destructive/20'
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="-mb-px flex gap-6">
            {([
              { key: 'leave', label: 'Leave Entitlement', icon: Calendar },
              { key: 'salary', label: 'Salary', icon: DollarSign },
              { key: 'benefits', label: 'Benefits', icon: Gift },
            ] as { key: Tab; label: string; icon: React.ElementType }[]).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-input'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ============== LEAVE TAB ============== */}
        {activeTab === 'leave' && (
          <Card>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Leave Entitlement</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Configure annual leave days per leave type for this grade</p>
              </div>
            </div>
            {leaveTypes.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                <Calendar size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No leave types configured</p>
                <p className="text-sm mt-1">Add leave types in your company settings first.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {leaveTypes.map(lt => {
                  const config = getLeaveConfig(lt.id);
                  const isEditing = editingLeave === lt.id;

                  return (
                    <div key={lt.id} className="px-6 py-4">
                      {!isEditing ? (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: lt.color || '#6B7280' }}
                            />
                            <span className="font-medium text-foreground">{lt.name}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <span>
                              <span className="font-semibold text-foreground">{config?.days_per_year ?? 0}</span>{' '}
                              days/year
                            </span>
                            <span>
                              Carry fwd:{' '}
                              <span className="font-semibold text-foreground">{config?.carry_forward_days ?? 0}</span> days
                            </span>
                            <span>
                              Expires:{' '}
                              <span className="font-semibold text-foreground">{config?.carry_forward_expiry_months ?? 3}</span> mo
                            </span>
                          </div>
                          <button
                            onClick={() => startEditLeave(lt)}
                            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary transition-colors px-2 py-1.5 rounded hover:bg-accent"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: lt.color || '#6B7280' }}
                            />
                            <span className="font-medium text-foreground">{lt.name}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Days per Year</label>
                              <input
                                type="number"
                                min={0}
                                value={leaveForm.days_per_year}
                                onChange={e => setLeaveForm(f => ({ ...f, days_per_year: e.target.value }))}
                                className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Carry Forward Days</label>
                              <input
                                type="number"
                                min={0}
                                value={leaveForm.carry_forward_days}
                                onChange={e => setLeaveForm(f => ({ ...f, carry_forward_days: e.target.value }))}
                                className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Expiry (months)</label>
                              <input
                                type="number"
                                min={0}
                                value={leaveForm.carry_forward_expiry_months}
                                onChange={e => setLeaveForm(f => ({ ...f, carry_forward_expiry_months: e.target.value }))}
                                className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="primary" onClick={() => saveLeaveConfig(lt.id)} disabled={savingLeave}>
                              <Save size={14} />
                              {savingLeave ? 'Saving...' : 'Save'}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingLeave(null)} disabled={savingLeave}>
                              <X size={14} />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* ============== SALARY TAB ============== */}
        {activeTab === 'salary' && (
          <div className="space-y-4">
            {/* Current Band */}
            {currentSalary && (
              <div className="bg-gradient-to-r from-primary to-primary/90 rounded-xl p-6 text-white">
                <p className="text-primary-foreground text-sm font-medium mb-1">Current Salary</p>
                <p className="text-3xl font-bold">
                  {formatSalary(currentSalary.salary, currentSalary.currency)}
                </p>
                <p className="text-primary-foreground text-sm mt-2">
                  Effective from {new Date(currentSalary.effective_from).toLocaleDateString()}
                  {currentSalary.effective_to && ` to ${new Date(currentSalary.effective_to).toLocaleDateString()}`}
                </p>
                {currentSalary.notes && (
                  <p className="text-primary-foreground text-sm mt-1 italic">{currentSalary.notes}</p>
                )}
              </div>
            )}

            <Card>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Salary History</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Fixed salary per grade with effective periods</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowSalaryForm(true);
                    setSalaryError('');
                    // Auto-select today's date
                    setSalaryForm(f => ({ ...f, effective_from: getTodayDateString() }));
                  }}
                >
                  <Plus size={16} />
                  Set New Band
                </Button>
              </div>

              {/* Add Salary Band Form */}
              {showSalaryForm && (
                <div className="px-6 py-4 bg-accent border-b border-primary/20 overflow-visible">
                  <h3 className="text-sm font-semibold text-foreground mb-3">New Salary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative z-0">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Salary *</label>
                      <input
                        type="number"
                        min={0}
                        value={salaryForm.salary}
                        onChange={e => setSalaryForm(f => ({ ...f, salary: e.target.value }))}
                        placeholder="8000"
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Salary Component *</label>
                      <input
                        type="text"
                        value={salaryForm.salary_component}
                        onChange={e => setSalaryForm(f => ({ ...f, salary_component: e.target.value }))}
                        placeholder="e.g., Basic Salary"
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
                      <select
                        value={salaryForm.currency}
                        onChange={e => setSalaryForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Effective From *</label>
                      <DatePicker
                        value={salaryForm.effective_from}
                        onChange={(date) => setSalaryForm(f => ({ ...f, effective_from: date }))}
                        placeholder="Select effective from date"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Effective To</label>
                      <DatePicker
                        value={salaryForm.effective_to}
                        onChange={(date) => setSalaryForm(f => ({ ...f, effective_to: date }))}
                        placeholder="Select effective to date (optional)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                      <input
                        type="text"
                        value={salaryForm.notes}
                        onChange={e => setSalaryForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional notes"
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  {salaryError && (
                    <p className="mt-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{salaryError}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="primary" onClick={saveSalaryConfig} disabled={savingSalary}>
                      <Save size={14} />
                      {savingSalary ? 'Saving...' : 'Save Salary'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setShowSalaryForm(false); setSalaryError(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {salaryConfigs.length === 0 && !showSalaryForm ? (
                <div className="px-6 py-12 text-center text-muted-foreground">
                  <DollarSign size={40} className="text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No salary bands configured</p>
                  <p className="text-sm mt-1">Set the first salary band for this grade.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {salaryConfigs.map(config => {
                    const isActive = config.effective_from <= today && (!config.effective_to || config.effective_to >= today);
                    return (
                      <div key={config.id} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground">
                              {formatSalary(config.salary, config.currency)}
                            </span>
                            {isActive && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(config.effective_from).toLocaleDateString()}
                            {config.effective_to && ` — ${new Date(config.effective_to).toLocaleDateString()}`}
                            {config.notes && ` · ${config.notes}`}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteSalaryConfig(config.id)}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ============== BENEFITS TAB ============== */}
        {activeTab === 'benefits' && (
          <Card>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Benefits Package</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Allowances and benefits for employees in this grade</p>
              </div>
              <Button variant="primary" size="sm" onClick={openAddBenefit}>
                <Plus size={16} />
                Add Benefit
              </Button>
            </div>

            {/* Add / Edit Benefit Form */}
            {showBenefitForm && (
              <div className="px-6 py-4 bg-accent border-b border-primary/20">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {editingBenefit ? 'Edit Benefit' : 'New Benefit'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Benefit Type *</label>
                    <select
                      value={benefitForm.benefit_type}
                      onChange={e => setBenefitForm(f => ({ ...f, benefit_type: e.target.value as BenefitType }))}
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {BENEFIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Value Type</label>
                    <select
                      value={benefitForm.value_type}
                      onChange={e => setBenefitForm(f => ({ ...f, value_type: e.target.value as 'fixed' | 'percentage' }))}
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage of Basic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {benefitForm.value_type === 'percentage' ? 'Percentage (%)' : 'Amount'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={benefitForm.benefit_value}
                      onChange={e => setBenefitForm(f => ({ ...f, benefit_value: e.target.value }))}
                      placeholder={benefitForm.value_type === 'percentage' ? '10' : '5000'}
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {benefitForm.value_type === 'fixed' && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
                      <select
                        value={benefitForm.currency}
                        onChange={e => setBenefitForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className={benefitForm.value_type === 'fixed' ? '' : 'md:col-span-2'}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <input
                      type="text"
                      value={benefitForm.description}
                      onChange={e => setBenefitForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Optional description"
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                {benefitError && (
                  <p className="mt-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{benefitError}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="primary" onClick={saveBenefit} disabled={savingBenefit}>
                    <Save size={14} />
                    {savingBenefit ? 'Saving...' : editingBenefit ? 'Update' : 'Add Benefit'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setShowBenefitForm(false); resetBenefitForm(); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {benefits.length === 0 && !showBenefitForm ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                <Gift size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No benefits configured</p>
                <p className="text-sm mt-1">Add allowances and benefits for this grade.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {benefits.map(b => (
                  <div key={b.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-foreground">{b.benefit_type}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                          {b.benefit_type}
                        </span>
                        {!b.active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>
                          {b.benefit_value !== null && b.benefit_value !== undefined
                            ? b.value_type === 'percentage'
                              ? `${b.benefit_value}% of basic salary`
                              : `${b.currency} ${Number(b.benefit_value).toLocaleString()}/year`
                            : 'No value set'}
                        </span>
                        {b.description && <span>· {b.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleBenefitActive(b)}
                        className={`p-1.5 rounded transition-colors ${
                          b.active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                        title={b.active ? 'Deactivate' : 'Activate'}
                      >
                        {b.active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      </button>
                      <button
                        onClick={() => openEditBenefit(b)}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => deleteBenefit(b.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}
