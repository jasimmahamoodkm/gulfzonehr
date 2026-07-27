'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import SelectMenu from '@/components/ui/SelectMenu';
import { FileText, CreditCard, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

type ChequeType = 'payable' | 'receivable';
type ChequeStatus = 'pending' | 'cleared' | 'bounced' | 'cancelled';

interface Pdc {
  id: string;
  company_id: string;
  cheque_type: ChequeType;
  cheque_number: string;
  bank_name: string | null;
  amount: number;
  currency: string;
  cheque_date: string;
  party_name: string | null;
  reference: string | null;
  status: ChequeStatus;
  notes: string | null;
}

const STATUSES: ChequeStatus[] = ['pending', 'cleared', 'bounced', 'cancelled'];
const statusBadge: Record<ChequeStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  cleared: 'bg-green-100 text-green-700',
  bounced: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const todayStr = () => new Date().toISOString().split('T')[0];

const emptyForm = {
  id: '' as string,
  cheque_type: 'payable' as ChequeType,
  cheque_number: '',
  bank_name: '',
  amount: '',
  currency: 'AED',
  cheque_date: '',
  party_name: '',
  reference: '',
  status: 'pending' as ChequeStatus,
  notes: '',
};

export default function PdcPage() {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const canManage = user?.roles?.some(r =>
    ['Super Admin', 'Company Admin', 'HR Manager'].includes(r.role_name || '')) ?? false;

  const [cheques, setCheques] = useState<Pdc[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | ChequeType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ChequeStatus>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const companyId = selectedCompany?.id || '';
  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const load = useCallback(async () => {
    if (!companyId) { setCheques([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdc_cheques').select('*')
        .eq('company_id', companyId)
        .order('cheque_date', { ascending: true });
      if (error) throw error;
      setCheques((data as Pdc[]) || []);
    } catch (err) {
      flash('error', (err as any)?.message || 'Failed to load cheques');
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = (type: ChequeType) => { setForm({ ...emptyForm, cheque_type: type }); setShowModal(true); };
  const openEdit = (c: Pdc) => {
    setForm({
      id: c.id, cheque_type: c.cheque_type, cheque_number: c.cheque_number,
      bank_name: c.bank_name || '', amount: String(c.amount), currency: c.currency || 'AED',
      cheque_date: c.cheque_date, party_name: c.party_name || '', reference: c.reference || '',
      status: c.status, notes: c.notes || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.cheque_number.trim()) { flash('error', 'Cheque number is required'); return; }
    if (!form.cheque_date) { flash('error', 'Cheque (due) date is required'); return; }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        cheque_type: form.cheque_type,
        cheque_number: form.cheque_number.trim(),
        bank_name: form.bank_name.trim() || null,
        amount: Number(form.amount) || 0,
        currency: form.currency || 'AED',
        cheque_date: form.cheque_date,
        party_name: form.party_name.trim() || null,
        reference: form.reference.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from('pdc_cheques').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id);
        if (error) throw error;
        flash('success', 'Cheque updated');
      } else {
        const { error } = await supabase.from('pdc_cheques').insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
        flash('success', 'Cheque added');
      }
      setShowModal(false);
      load();
    } catch (err) { flash('error', (err as any)?.message || 'Failed to save cheque'); }
    finally { setSaving(false); }
  };

  const setStatus = async (c: Pdc, status: ChequeStatus) => {
    try {
      const { error } = await supabase.from('pdc_cheques').update({ status, updated_at: new Date().toISOString() }).eq('id', c.id);
      if (error) throw error;
      setCheques(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
    } catch (err) { flash('error', (err as any)?.message || 'Failed to update status'); }
  };

  const remove = async (c: Pdc) => {
    if (!confirm(`Delete cheque ${c.cheque_number}?`)) return;
    try {
      const { error } = await supabase.from('pdc_cheques').delete().eq('id', c.id);
      if (error) throw error;
      flash('success', 'Cheque deleted');
      load();
    } catch (err) { flash('error', (err as any)?.message || 'Failed to delete'); }
  };

  const filtered = cheques.filter(c =>
    (typeFilter === 'all' || c.cheque_type === typeFilter) &&
    (statusFilter === 'all' || c.status === statusFilter));

  const fmt = (n: number, ccy = 'AED') => `${ccy} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const sumBy = (type: ChequeType) => cheques.filter(c => c.cheque_type === type && c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0);
  const overdueCount = cheques.filter(c => c.status === 'pending' && c.cheque_date < todayStr()).length;
  const isOverdue = (c: Pdc) => c.status === 'pending' && c.cheque_date < todayStr();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Tab bar (under Documents) */}
        <div className="flex gap-2 border-b border-gray-200">
          <Link href="/documents" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">
            <FileText size={16} /> Documents
          </Link>
          <span className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px">
            <CreditCard size={16} /> PDC Cheques
          </span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PDC Cheque Tracking</h1>
            <p className="text-gray-500 text-sm">
              {selectedCompany ? `Post-dated cheques for ${selectedCompany.name}` : 'Select a company to manage cheques'}
            </p>
          </div>
          {canManage && selectedCompany && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => openAdd('receivable')}><Plus size={15} className="mr-1.5" /> Receivable</Button>
              <Button onClick={() => openAdd('payable')}><Plus size={15} className="mr-1.5" /> Payable</Button>
            </div>
          )}
        </div>

        {msg && (
          <div className={`p-3 rounded-lg border text-sm ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>{msg.text}</div>
        )}

        {!selectedCompany ? (
          <Card className="p-8 text-center text-gray-500">Select a company to view PDC cheques.</Card>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5">
                <p className="text-sm text-gray-500">Payable (pending)</p>
                <p className="text-2xl font-bold text-red-600">{fmt(sumBy('payable'))}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-gray-500">Receivable (pending)</p>
                <p className="text-2xl font-bold text-green-600">{fmt(sumBy('receivable'))}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-gray-500">Overdue (pending, past due)</p>
                <p className="text-2xl font-bold text-amber-600 flex items-center gap-2">{overdueCount > 0 && <AlertTriangle size={20} />}{overdueCount}</p>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <select className={`${inputCls} w-auto`} value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
                <option value="all">All types</option>
                <option value="payable">Payable</option>
                <option value="receivable">Receivable</option>
              </select>
              <select className={`${inputCls} w-auto`} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                <option value="all">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
              <span className="text-sm text-gray-500">{filtered.length} cheque(s)</span>
            </div>

            {/* Table */}
            <Card noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Cheque #</th>
                      <th className="text-left px-4 py-2 font-medium">Party</th>
                      <th className="text-left px-4 py-2 font-medium">Bank</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                      <th className="text-left px-4 py-2 font-medium">Due date</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      {canManage && <th className="px-4 py-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No cheques.</td></tr>
                    ) : filtered.map(c => (
                      <tr key={c.id} className={isOverdue(c) ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${c.cheque_type === 'payable' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {c.cheque_type === 'payable' ? 'Payable' : 'Receivable'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-900 font-medium">{c.cheque_number}</td>
                        <td className="px-4 py-2 text-gray-700">{c.party_name || '—'}</td>
                        <td className="px-4 py-2 text-gray-700">{c.bank_name || '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{fmt(c.amount, c.currency)}</td>
                        <td className={`px-4 py-2 ${isOverdue(c) ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                          {new Date(c.cheque_date).toLocaleDateString()}{isOverdue(c) && ' ⚠'}
                        </td>
                        <td className="px-4 py-2">
                          {canManage ? (
                            <select value={c.status} onChange={e => setStatus(c, e.target.value as ChequeStatus)}
                              className={`text-xs rounded px-2 py-1 border-0 ${statusBadge[c.status]}`}>
                              {STATUSES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded ${statusBadge[c.status]}`}>{c.status}</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-2">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => openEdit(c)} className="p-1 hover:bg-gray-200 rounded" title="Edit"><Edit2 size={16} className="text-blue-600" /></button>
                              <button onClick={() => remove(c)} className="p-1 hover:bg-gray-200 rounded" title="Delete"><Trash2 size={16} className="text-red-600" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`${form.id ? 'Edit' : 'New'} ${form.cheque_type === 'payable' ? 'Payable' : 'Receivable'} Cheque`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <SelectMenu
                value={form.cheque_type}
                onChange={v => setForm({ ...form, cheque_type: v as ChequeType })}
                options={[
                  { value: 'payable', label: 'Payable (we issue)' },
                  { value: 'receivable', label: 'Receivable (we receive)' },
                ]}
              />
            </Field>
            <Field label="Cheque number *"><input className={inputCls} value={form.cheque_number} onChange={e => setForm({ ...form, cheque_number: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={form.cheque_type === 'payable' ? 'Payee' : 'Drawer / Payer'}><input className={inputCls} value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} /></Field>
            <Field label="Bank"><input className={inputCls} value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Amount"><input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Currency"><input className={inputCls} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Status">
              <SelectMenu
                value={form.status}
                onChange={v => setForm({ ...form, status: v as ChequeStatus })}
                options={STATUSES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date *"><DatePicker value={form.cheque_date} onChange={d => setForm({ ...form, cheque_date: d })} placeholder="Select due date" /></Field>
            <Field label="Reference"><input className={inputCls} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Invoice / PO / contract" /></Field>
          </div>
          <Field label="Notes"><textarea rows={2} className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save' : 'Add cheque'}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
