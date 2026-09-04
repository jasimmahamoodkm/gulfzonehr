'use client';

/**
 * useLeaveApprovals Hook
 * Provides leave approval workflow functionality
 */

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { logAuditEvent } from '@/lib/audit';
import type { LeaveApprovalRequest, LeaveRejectionRequest } from '@/types/leaves';
import { apiUrl } from '@/lib/api';

export function useLeaveApprovals() {
  const context = useContext(AuthContext);
  const user = context?.user;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /**
   * Approve a leave request
   */
  const approveLeave = useCallback(
    async (request: LeaveApprovalRequest) => {
      if (!user?.id || !user?.company_id) {
        setError('User not authenticated');
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiUrl('/api/leaves/approve'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...request,
            approved_by: user.id,
            company_id: user.company_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to approve leave');
          return { success: false };
        }

        // Log audit event
        await logAuditEvent({
          user_id: user.id,
          company_id: user.company_id,
          action: 'approve_leave',
          resource_type: 'leaves',
          resource_id: request.leave_id,
          status: 'success',
          new_values: {
            approval_status: 'approved',
            manager_comments: request.comments,
          },
        });

        return { success: true, data };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);

        // Log failed audit event
        await logAuditEvent({
          user_id: user.id,
          company_id: user.company_id,
          action: 'approve_leave',
          resource_type: 'leaves',
          resource_id: request.leave_id,
          status: 'failure',
          error_message: errorMsg,
        });

        return { success: false };
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    },
    [user?.id, user?.company_id]
  );

  /**
   * Reject a leave request
   */
  const rejectLeave = useCallback(
    async (request: LeaveRejectionRequest) => {
      if (!user?.id || !user?.company_id) {
        setError('User not authenticated');
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiUrl('/api/leaves/reject'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...request,
            rejected_by: user.id,
            company_id: user.company_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to reject leave');
          return { success: false };
        }

        // Log audit event
        await logAuditEvent({
          user_id: user.id,
          company_id: user.company_id,
          action: 'reject_leave',
          resource_type: 'leaves',
          resource_id: request.leave_id,
          status: 'success',
          new_values: {
            approval_status: 'rejected',
            rejection_reason: request.reason,
          },
        });

        return { success: true, data };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);

        // Log failed audit event
        await logAuditEvent({
          user_id: user.id,
          company_id: user.company_id,
          action: 'reject_leave',
          resource_type: 'leaves',
          resource_id: request.leave_id,
          status: 'failure',
          error_message: errorMsg,
        });

        return { success: false };
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    },
    [user?.id, user?.company_id]
  );

  /**
   * Apply for a leave
   */
  const applyLeave = useCallback(
    async (leaveData: {
      leave_type: string;
      start_date: string;
      end_date: string;
      days: number;
      reason: string;
    }) => {
      if (!user?.id || !user?.company_id) {
        setError('User not authenticated');
        return { success: false };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiUrl('/api/leaves/apply'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...leaveData,
            employee_id: user.id,
            company_id: user.company_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to apply for leave');
          return { success: false };
        }

        // Log audit event
        await logAuditEvent({
          user_id: user.id,
          company_id: user.company_id,
          action: 'create_leave',
          resource_type: 'leaves',
          resource_id: data.id,
          status: 'success',
          new_values: leaveData,
        });

        return { success: true, data };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);

        // Log failed audit event
        await logAuditEvent({
          user_id: user.id,
          company_id: user.company_id,
          action: 'create_leave',
          resource_type: 'leaves',
          status: 'failure',
          error_message: errorMsg,
        });

        return { success: false };
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    },
    [user?.id, user?.company_id]
  );

  /**
   * Get leave balance for employee
   */
  const getLeaveBalance = useCallback(
    async (employeeId?: string) => {
      if (!user?.company_id) {
        return null;
      }

      try {
        const response = await fetch(apiUrl('/api/leaves/balance'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employee_id: employeeId || user.id,
            company_id: user.company_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return null;
        }

        return data;
      } catch (error) {
        console.error('Error fetching leave balance:', error);
        return null;
      }
    },
    [user?.id, user?.company_id]
  );

  return {
    approveLeave,
    rejectLeave,
    applyLeave,
    getLeaveBalance,
    loading,
    error,
  };
}
