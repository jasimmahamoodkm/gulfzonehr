'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface GradeRef { name: string; level: number }
interface ChangeRequest {
  id: string;
  employee_id: string;
  request_type: 'promotion' | 'demotion' | 'lateral';
  change_grade: boolean;
  change_salary: boolean;
  change_benefits: boolean;
  current_salary: number | null;
  requested_salary: number | null;
  benefit_changes: { benefit_type: string; benefit_value?: number; value_type?: string; action: string }[] | null;
  currency: string | null;
  reason: string | null;
  status: string;
  requested_at: string;
  requested_by: string | null;
  employees: { first_name: string; last_name: string; email: string } | null;
  curr: GradeRef | null;
  req: GradeRef | null;
}

export default function GradeApprovalsPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setPageError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const q = `status=pending${selectedCompany?.id ? `&company_id=${selectedCompany.id}` : ''}`;
      const res = await fetch(apiUrl(`/api/grade-changes?${q}`), {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load requests');
      setRequests(json.data || []);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !notes[id]?.trim()) {
      setPageError('Please add a note explaining the rejection.');
      return;
    }
    try {
      setProcessing(id);
      setPageError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/grade-changes/${id}/decision`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ decision, note: notes[id] || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Decision failed');
      setNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setProcessing(null);
    }
  };

  const fmt = (n: number | null | undefined, ccy = 'AED') =>
    n == null ? '—' : `${ccy} ${Number(n).toLocaleString()}`;

  const typeBadge = (t: ChangeRequest['request_type']) => {
    if (t === 'promotion') return <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs font-medium"><TrendingUp size={12} /> Promotion</span>;
    if (t === 'demotion') return <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs font-medium"><TrendingDown size={12} /> Demotion</span>;
    return <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs font-medium"><ArrowRight size={12} /> Lateral</span>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promotion / Demotion Approvals</h1>
          <p className="text-gray-600 mt-2">
            Review pending grade, salary, and benefit change requests {requests.length > 0 && `(${requests.length} pending)`}
          </p>
        </div>

        {pageError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Error:</strong> {pageError}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <Card className="p-8 text-center text-gray-500">Loading pending requests…</Card>
          ) : requests.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">No pending requests</Card>
          ) : (
            requests.map((r) => {
              const isOwn = !!user && r.requested_by === user.id;
              const empName = r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : 'Employee';
              return (
                <Card key={r.id} className="p-6 border-l-4 border-l-blue-500">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{empName}</h3>
                        {typeBadge(r.request_type)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Requested {new Date(r.requested_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* What changes */}
                  <div className="mt-4 space-y-2 text-sm">
                    {r.change_grade && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700 w-24">Grade</span>
                        <span className="text-gray-600">{r.curr?.name || '—'}</span>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="text-gray-900 font-medium">{r.req?.name || '—'}</span>
                      </div>
                    )}
                    {r.change_salary && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700 w-24">Salary</span>
                        <span className="text-gray-600">{fmt(r.current_salary, r.currency || 'AED')}</span>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="text-gray-900 font-medium">{fmt(r.requested_salary, r.currency || 'AED')}</span>
                      </div>
                    )}
                    {r.change_benefits && r.benefit_changes && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-gray-700 w-24">Benefits</span>
                        <div className="flex-1 space-y-0.5">
                          {r.benefit_changes.map((b, i) => (
                            <div key={i} className="text-gray-700">
                              <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${b.action === 'remove' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {b.action === 'remove' ? 'Remove' : 'Add/Update'}
                              </span>
                              {b.benefit_type}
                              {b.action !== 'remove' && b.benefit_value != null && (
                                <span className="text-gray-500"> — {b.value_type === 'percentage' ? `${b.benefit_value}% of basic` : fmt(b.benefit_value, r.currency || 'AED')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.reason && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-gray-700 w-24">Reason</span>
                        <span className="text-gray-600 italic">{r.reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Decision */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    {isOwn ? (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        You raised this request, so it must be approved by another HR Manager or above.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Note (required to reject)</label>
                          <textarea
                            value={notes[r.id] || ''}
                            onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                            rows={2}
                            placeholder="Add a review note…"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button onClick={() => decide(r.id, 'approve')} disabled={processing === r.id} variant="primary" className="w-full">
                            {processing === r.id ? 'Processing…' : 'Approve'}
                          </Button>
                          <Button onClick={() => decide(r.id, 'reject')} disabled={processing === r.id} variant="danger" className="w-full">
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
