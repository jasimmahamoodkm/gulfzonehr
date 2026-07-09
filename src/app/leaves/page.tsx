'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Plus, CheckCircle, Clock, XCircle, History, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

const leaveSchema = z.object({
  leave_type: z.string().min(1, 'Leave type is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  {
    message: 'End date must be same as or after start date',
    path: ['end_date'],
  }
);

type LeaveFormData = z.infer<typeof leaveSchema>;

const LeavesPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const [showModal, setShowModal] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');

  // Auto-select company if employee has only one
  useEffect(() => {
    if (!selectedCompany && companies.length > 0) {
      setSelectedCompany(companies[0]);
    }
  }, [companies, selectedCompany, setSelectedCompany]);

  // Fetch employee data and leaves
  const fetchLeavesData = async () => {
    try {
      setLoading(true);
      if (!user?.email || !selectedCompany) {
        setLeaveRequests([]);
        setEmployeeData(null);
        return;
      }

      // Get employee record by email
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .eq('company_id', selectedCompany.id)
        .single();

      if (empError) {
        console.warn('Employee record not found for email:', user.email);
      }

      setEmployeeData(empData || null);

      // Get leaves for this employee
      if (empData) {
        const { data: leaveData, error } = await supabase
          .from('leaves')
          .select('*')
          .eq('employee_id', empData.id)
          .order('start_date', { ascending: false });

        if (error) throw error;
        setLeaveRequests(leaveData || []);
      } else {
        setLeaveRequests([]);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
      setMessage({ type: 'error', text: 'Failed to load leave information' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeavesData();
  }, [user, selectedCompany]);

  const onSubmit = async (data: LeaveFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      if (!employeeData) {
        setMessage({ type: 'error', text: 'Employee record not found' });
        return;
      }

      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase.from('leaves').insert({
        employee_id: employeeData.id,
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
        days,
        reason: data.reason,
        status: 'Pending',
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Leave request submitted successfully' });
      reset();
      setShowModal(false);
      fetchLeavesData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const errMsg = (err as any)?.message || 'Failed to submit leave request';
      setMessage({ type: 'error', text: errMsg });
      console.error('Error submitting leave:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate statistics
  const pendingCount = leaveRequests.filter((l) => l.status === 'Pending').length;
  const approvedCount = leaveRequests.filter((l) => l.status === 'Approved').length;
  const totalDaysUsed = leaveRequests
    .filter((l) => l.status === 'Approved')
    .reduce((sum, l) => sum + (l.days || 0), 0);

  const columns = [
    {
      key: 'leave_type',
      label: 'Leave Type',
    },
    {
      key: 'start_date',
      label: 'Duration',
      render: (value: string, row: any) => {
        const start = new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const end = new Date(row.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${start} - ${end} (${row.days}d)`;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <div className="flex items-center gap-1">
          {value === 'Approved' && <CheckCircle size={16} className="text-green-600" />}
          {value === 'Pending' && <Clock size={16} className="text-orange-600" />}
          {value === 'Rejected' && <XCircle size={16} className="text-red-600" />}
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              value === 'Approved'
                ? 'bg-green-100 text-green-800'
                : value === 'Pending'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {value}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Leaves</h1>
            <p className="text-gray-600 mt-1">
              {selectedCompany ? `Manage your leaves at ${selectedCompany.name}` : 'Select a company to view leaves'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            disabled={!selectedCompany || !employeeData}
            className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Apply for Leave
          </Button>
        </div>

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to view your leaves</p>
          </Card>
        )}

        {selectedCompany && employeeData && (
          <>
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            )}

            {!loading && (
              <>
                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Pending Requests</p>
                        <p className="text-3xl font-bold text-gray-900">{pendingCount}</p>
                      </div>
                      <Clock size={32} className="text-orange-200" />
                    </div>
                  </Card>
                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Approved Leaves</p>
                        <p className="text-3xl font-bold text-gray-900">{approvedCount}</p>
                      </div>
                      <CheckCircle size={32} className="text-green-200" />
                    </div>
                  </Card>
                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Days Used</p>
                        <p className="text-3xl font-bold text-gray-900">{totalDaysUsed}</p>
                      </div>
                      <History size={32} className="text-blue-200" />
                    </div>
                  </Card>
                </div>

                {/* Leave History */}
                <Card header={<h2 className="text-lg font-semibold flex items-center gap-2"><FileText size={20} /> Leave History</h2>} noPadding>
                  {leaveRequests.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No leave requests found. <br /> Click "Apply for Leave" to submit your first leave request.
                    </div>
                  ) : (
                    <Table columns={columns} data={leaveRequests} />
                  )}
                </Card>
              </>
            )}
          </>
        )}
      </div>

      {/* Apply for Leave Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
          setMessage(null);
        }}
        title="Apply for Leave"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setShowModal(false);
              reset();
              setMessage(null);
            }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          {message && (
            <div className={`p-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type</label>
            <select
              {...register('leave_type')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Leave Type</option>
              <option value="Vacation">Vacation</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Personal">Personal</option>
              <option value="Maternity Leave">Maternity Leave</option>
              <option value="Other">Other</option>
            </select>
            {errors.leave_type && (
              <p className="mt-1 text-sm text-red-600">{errors.leave_type.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <DatePicker
                value={startDate}
                onChange={(date) => setValue('start_date', date)}
                placeholder="Select start date"
              />
              {errors.start_date && (
                <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <DatePicker
                value={endDate}
                onChange={(date) => setValue('end_date', date)}
                placeholder="Select end date"
              />
              {errors.end_date && (
                <p className="mt-1 text-sm text-red-600">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
            <textarea
              {...register('reason')}
              placeholder="Enter reason for leave"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default LeavesPage;
