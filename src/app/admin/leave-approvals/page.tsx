'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { logAuditEvent } from '@/lib/audit';

interface PendingLeave {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  created_at: string;
  company_id: string;
}

export default function LeaveApprovalsPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [leaves, setLeaves] = useState<PendingLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  // Use selectedCompany first, fall back to user.company_id
  const companyId = selectedCompany?.id || user?.company_id || '';

  useEffect(() => {
    if (!companyId) return;
    loadPendingLeaves();
  }, [companyId]);

  const loadPendingLeaves = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setPageError(null);

      // Step 1: Get all employee IDs for this company
      const { data: companyEmps, error: empFetchError } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', companyId);

      if (empFetchError) {
        throw new Error(empFetchError.message || JSON.stringify(empFetchError));
      }

      if (!companyEmps || companyEmps.length === 0) {
        setLeaves([]);
        return;
      }

      const empIds = companyEmps.map(e => e.id);

      // Step 2: Fetch pending leaves filtered by employee IDs (avoids leaves.company_id)
      const { data: leavesData, error: leavesError } = await supabase
        .from('leaves')
        .select('id, employee_id, leave_type, start_date, end_date, days, reason, created_at')
        .in('employee_id', empIds)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true });

      if (leavesError) {
        throw new Error(leavesError.message || JSON.stringify(leavesError));
      }

      if (!leavesData || leavesData.length === 0) {
        setLeaves([]);
        return;
      }

      // Step 3: Build employee name map from already-fetched company employees
      const empData = companyEmps;

      const empMap: Record<string, string> = {};
      (empData || []).forEach((e: any) => {
        empMap[e.id] = `${e.first_name} ${e.last_name}`;
      });

      const transformedLeaves: PendingLeave[] = leavesData.map(leave => ({
        id: leave.id,
        employee_id: leave.employee_id,
        employee_name: empMap[leave.employee_id] || 'Unknown Employee',
        leave_type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        days: leave.days,
        reason: leave.reason,
        created_at: leave.created_at,
        company_id: companyId,
      }));

      setLeaves(transformedLeaves);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Error loading pending leaves:', msg);
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Increment used_days in employee_leave_balance when a leave is approved
  const updateLeaveBalance = async (employeeId: string, leaveTypeName: string, days: number, leaveCompanyId: string) => {
    try {
      const year = new Date().getFullYear();

      // Find the leave_type_id by matching name within the company
      const { data: ltData } = await supabase
        .from('leave_types')
        .select('id')
        .eq('company_id', leaveCompanyId)
        .ilike('name', leaveTypeName)
        .maybeSingle();

      if (!ltData?.id) return; // leave type not found in new system — skip

      // Read current balance
      const { data: balance } = await supabase
        .from('employee_leave_balance')
        .select('id, used_days')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', ltData.id)
        .eq('year', year)
        .maybeSingle();

      if (balance?.id) {
        // Update existing record
        await supabase
          .from('employee_leave_balance')
          .update({ used_days: (balance.used_days || 0) + days })
          .eq('id', balance.id);
      } else {
        // Insert if record doesn't exist yet
        await supabase.from('employee_leave_balance').insert({
          employee_id: employeeId,
          leave_type_id: ltData.id,
          year,
          total_days: 0,
          used_days: days,
          pending_days: 0,
        });
      }
    } catch { /* non-critical — don't block approval */ }
  };

  const handleApproveLeave = async (leaveId: string) => {
    if (!user) return;

    try {
      setProcessingLeaveId(leaveId);

      // Update leave status
      const { error: updateError } = await supabase
        .from('leaves')
        .update({
          approval_status: 'approved',
          status: 'Approved',
          approved_by: user.id,
          approval_date: new Date().toISOString(),
          manager_comments: approvalComments[leaveId] || null,
        })
        .eq('id', leaveId);

      if (updateError) throw updateError;

      // Update employee_leave_balance.used_days for this leave type + year
      const leave = leaves.find(l => l.id === leaveId);
      if (leave) {
        await updateLeaveBalance(leave.employee_id, leave.leave_type, leave.days, leave.company_id);
      }

      // Log audit event
      await logAuditEvent({
        user_id: user.id,
        company_id: user.company_id || '',
        action: 'approve_leave',
        resource_type: 'leaves',
        resource_id: leaveId,
        status: 'success',
      });

      // Clear form and reload
      setApprovalComments(prev => {
        const newComments = { ...prev };
        delete newComments[leaveId];
        return newComments;
      });

      loadPendingLeaves();
    } catch (err) {
      console.error('Error approving leave:', err);
      // Log failure
      await logAuditEvent({
        user_id: user.id,
        company_id: user.company_id || '',
        action: 'approve_leave',
        resource_type: 'leaves',
        resource_id: leaveId,
        status: 'failure',
        error_message: (err as Error).message,
      });
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    if (!user || !rejectionReasons[leaveId]) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setProcessingLeaveId(leaveId);

      // Update leave status
      const { error: updateError } = await supabase
        .from('leaves')
        .update({
          approval_status: 'rejected',
          status: 'Rejected',
          approved_by: user.id,
          approval_date: new Date().toISOString(),
          rejection_reason: rejectionReasons[leaveId],
        })
        .eq('id', leaveId);

      if (updateError) throw updateError;

      // Log audit event
      await logAuditEvent({
        user_id: user.id,
        company_id: user.company_id || '',
        action: 'reject_leave',
        resource_type: 'leaves',
        resource_id: leaveId,
        status: 'success',
      });

      // Clear form and reload
      setRejectionReasons(prev => {
        const newReasons = { ...prev };
        delete newReasons[leaveId];
        return newReasons;
      });

      loadPendingLeaves();
    } catch (err) {
      console.error('Error rejecting leave:', err);
      // Log failure
      await logAuditEvent({
        user_id: user.id,
        company_id: user.company_id || '',
        action: 'reject_leave',
        resource_type: 'leaves',
        resource_id: leaveId,
        status: 'failure',
        error_message: (err as Error).message,
      });
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const daysUntilLeave = (startDate: string) => {
    const today = new Date();
    const leaveDate = new Date(startDate);
    const daysRemaining = Math.floor(
      (leaveDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysRemaining;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Approvals</h1>
          <p className="text-gray-600 mt-2">
            Manage pending leave requests {leaves.length > 0 && `(${leaves.length} pending)`}
          </p>
        </div>

        {pageError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Error:</strong> {pageError}
          </div>
        )}

        {!companyId && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            Please select a company to view pending leave requests.
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{leaves.length}</div>
              <div className="text-gray-600 text-sm mt-1">Pending Approvals</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {leaves.filter(l => daysUntilLeave(l.start_date) <= 7).length}
              </div>
              <div className="text-gray-600 text-sm mt-1">Urgent (Within 7 days)</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">
                {leaves.reduce((sum, l) => sum + l.days, 0)}
              </div>
              <div className="text-gray-600 text-sm mt-1">Total Days Requested</div>
            </div>
          </Card>
        </div>

        {/* Leave Requests */}
        <div className="space-y-4">
          {loading ? (
            <Card className="p-8 text-center text-gray-500">
              Loading pending leaves...
            </Card>
          ) : leaves.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              No pending leave requests
            </Card>
          ) : (
            leaves.map((leave) => {
              const daysRemaining = daysUntilLeave(leave.start_date);
              const isUrgent = daysRemaining <= 7 && daysRemaining >= 0;

              return (
                <Card
                  key={leave.id}
                  className={`p-6 border-l-4 ${
                    isUrgent ? 'border-l-orange-500 bg-orange-50' : 'border-l-blue-500'
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Employee & Leave Info */}
                    <div className="lg:col-span-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {leave.employee_name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {leave.leave_type} Leave
                          </p>
                          <div className="mt-3 space-y-1">
                            <p className="text-sm">
                              <span className="font-medium text-gray-700">Dates:</span>{' '}
                              {formatDate(leave.start_date)} -{' '}
                              {formatDate(leave.end_date)}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium text-gray-700">Days:</span>{' '}
                              {leave.days} days
                            </p>
                            {isUrgent && (
                              <p className="text-sm text-orange-600 font-medium">
                                ⚠️ {daysRemaining > 0 ? `${daysRemaining} days until leave` : 'Starts today'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="lg:col-span-2">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Reason:
                      </p>
                      <p className="text-sm text-gray-600 italic">
                        {leave.reason}
                      </p>
                    </div>
                  </div>

                  {/* Approval Form */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Approval Comments */}
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Comments (Optional)
                        </label>
                        <textarea
                          value={approvalComments[leave.id] || ''}
                          onChange={(e) =>
                            setApprovalComments({
                              ...approvalComments,
                              [leave.id]: e.target.value,
                            })
                          }
                          placeholder="Add comments for approval..."
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => handleApproveLeave(leave.id)}
                          disabled={processingLeaveId === leave.id}
                          variant="primary"
                          className="w-full"
                        >
                          {processingLeaveId === leave.id ? 'Processing...' : 'Approve'}
                        </Button>
                        <Button
                          onClick={() => {
                            if (!rejectionReasons[leave.id]) {
                              setRejectionReasons({
                                ...rejectionReasons,
                                [leave.id]: '',
                              });
                            }
                          }}
                          variant="secondary"
                          className="w-full"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>

                    {/* Rejection Reason Field */}
                    {rejectionReasons[leave.id] !== undefined && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Rejection Reason *
                        </label>
                        <textarea
                          value={rejectionReasons[leave.id] || ''}
                          onChange={(e) =>
                            setRejectionReasons({
                              ...rejectionReasons,
                              [leave.id]: e.target.value,
                            })
                          }
                          placeholder="Please provide a reason for rejection..."
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="mt-3 flex gap-2">
                          <Button
                            onClick={() => handleRejectLeave(leave.id)}
                            disabled={processingLeaveId === leave.id}
                            variant="danger"
                          >
                            {processingLeaveId === leave.id ? 'Processing...' : 'Confirm Rejection'}
                          </Button>
                          <Button
                            onClick={() => {
                              const newReasons = { ...rejectionReasons };
                              delete newReasons[leave.id];
                              setRejectionReasons(newReasons);
                            }}
                            variant="secondary"
                          >
                            Cancel
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
