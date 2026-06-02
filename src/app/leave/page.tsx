'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Plus, CheckCircle, Clock, XCircle, Users } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

const leaveSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
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

const LeaveManagementPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
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

  // Fetch leaves from database
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      if (!selectedCompany) {
        setLeaveRequests([]);
        return;
      }

      // Get employees
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', selectedCompany.id);

      setEmployees(empData || []);

      // Get leaves
      const { data: leaveData, error } = await supabase
        .from('leaves')
        .select('*')
        .in('employee_id', empData?.map((e) => e.id) || [])
        .order('start_date', { ascending: false });

      if (error) throw error;
      setLeaveRequests(leaveData || []);
    } catch (err) {
      console.error('Error fetching leaves:', err);
      setMessage({ type: 'error', text: 'Failed to load leave requests' });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLeaves();
  }, [selectedCompany]);

  const onSubmit = async (data: LeaveFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase.from('leaves').insert({
        employee_id: data.employee_id,
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
        days,
        reason: data.reason,
        status: 'Pending',
        approval_status: 'pending',
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Leave request submitted successfully' });
      reset();
      setShowModal(false);
      fetchLeaves();
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

  const columns = [
    {
      key: 'employee_id',
      label: 'Employee',
      render: (value: string) => {
        const emp = employees.find((e) => e.id === value);
        return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
      },
    },
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

  const filteredLeaves = leaveRequests.filter((leave) => {
    if (!filterStatus) return true;
    return leave.status === filterStatus;
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
            <p className="text-gray-600 mt-1">
              {selectedCompany ? `Manage leave requests at ${selectedCompany.name}` : 'Select a company to manage leave'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            disabled={!selectedCompany}
            className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            New Leave Request
          </Button>
        </div>

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to manage leave requests</p>
          </Card>
        )}

        {selectedCompany && (
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
                <p className="text-gray-600 text-sm mb-1">Approved</p>
                <p className="text-3xl font-bold text-gray-900">{approvedCount}</p>
              </div>
              <CheckCircle size={32} className="text-green-200" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900">{leaveRequests.length}</p>
              </div>
              <Users size={32} className="text-blue-200" />
            </div>
          </Card>
        </div>

        {/* Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
          <div className="flex gap-2">
            {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status || (status === 'All' && !filterStatus) ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilterStatus(status === 'All' ? '' : status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {/* Leave Requests Table */}
        <Card header={<h2 className="text-lg font-semibold">Leave Requests</h2>} noPadding>
          {filteredLeaves.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No leave requests found
            </div>
          ) : (
            <Table columns={columns} data={filteredLeaves} />
          )}
        </Card>
          </>
        )}
          </>
        )}
      </div>

      {/* New Leave Request Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
          setMessage(null);
        }}
        title="New Leave Request"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              {...register('employee_id')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
            {errors.employee_id && (
              <p className="mt-1 text-sm text-red-600">{errors.employee_id.message}</p>
            )}
          </div>

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

export default LeaveManagementPage;
