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
import TimePicker from '@/components/ui/TimePicker';
import { Plus, Calendar, TrendingUp, Clock } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const attendanceSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
});

type AttendanceFormData = z.infer<typeof attendanceSchema>;

const AttendancePage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine user role for access control
  const isAdmin = user?.roles?.some(r => ['Super Admin', 'Company Admin', 'HR Manager'].includes(r.role_name ?? '')) ?? false;
  const isManager = user?.roles?.some(r => r.role_name === 'Manager') ?? false;
  const isEmployee = !isAdmin && !isManager;
  const canEdit = isAdmin; // Manager is view-only for attendance

  // Manager's own employee ID — used to scope their view
  const [myEmployeeId, setMyEmployeeId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isManager || !user?.id) return;
    supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setMyEmployeeId(data.id); });
  }, [isManager, user?.id]);

  // Get current employee record if user is an employee
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  React.useEffect(() => {
    const getEmployeeId = async () => {
      if (isEmployee && user?.id) {
        try {
          const { data: empData } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (empData) {
            setCurrentEmployeeId(empData.id);
          }
        } catch (err) {
          console.error('Error fetching employee record:', err);
        }
      }
    };
    getEmployeeId();
  }, [isEmployee, user?.id]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema),
  });

  const attendanceDate = watch('date');
  const checkIn = watch('check_in');
  const checkOut = watch('check_out');

  // Fetch attendance records for selected date
  const fetchAttendance = async (date: string) => {
    try {
      setLoading(true);
      if (!selectedCompany && !isEmployee) {
        setAttendanceRecords([]);
        return;
      }

      // For employees: show only their own attendance
      if (isEmployee && currentEmployeeId) {
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .select('id,first_name,last_name,position')
          .eq('id', currentEmployeeId)
          .single();

        if (empError) throw empError;
        setEmployees(empData ? [empData] : []);

        // Get attendance records for this employee
        const { data: attData, error: attError } = await supabase
          .from('attendance')
          .select('id,employee_id,date,check_in,check_out,status,notes')
          .eq('employee_id', currentEmployeeId)
          .eq('date', date);

        if (attError) throw attError;
        setAttendanceRecords(attData || []);
      } else if (isManager && myEmployeeId) {
        // Manager: own record + assigned employees
        const { data: empData } = await supabase
          .from('employees')
          .select('id,first_name,last_name,position')
          .eq('company_id', selectedCompany?.id || '')
          .or(`id.eq.${myEmployeeId},manager_id.eq.${myEmployeeId}`);
        setEmployees(empData || []);
        const ids = (empData || []).map((e: any) => e.id);
        const { data: attData } = await supabase
          .from('attendance')
          .select('id,employee_id,date,check_in,check_out,status,notes')
          .in('employee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
          .eq('date', date);
        setAttendanceRecords(attData || []);
      } else if (selectedCompany) {
        // Admin/HR: all employees' attendance
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .select('id,first_name,last_name,position')
          .eq('company_id', selectedCompany.id);
        if (empError) throw empError;
        setEmployees(empData || []);
        const { data: attData, error: attError } = await supabase
          .from('attendance')
          .select('id,employee_id,date,check_in,check_out,status,notes')
          .eq('date', date);
        if (attError) throw attError;
        setAttendanceRecords(attData || []);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setMessage({ type: 'error', text: 'Failed to load attendance records' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance when date or company changes
  React.useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate, selectedCompany, currentEmployeeId, myEmployeeId]);

  const onSubmit = async (data: AttendanceFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      const { error } = await supabase.from('attendance').insert({
        employee_id: data.employee_id,
        date: data.date,
        check_in: data.check_in || null,
        check_out: data.check_out || null,
        status: data.status,
        notes: data.notes || null,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Attendance recorded successfully' });
      reset();
      setShowModal(false);
      fetchAttendance(selectedDate);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const errMsg = (err as any)?.message || 'Failed to record attendance';
      setMessage({ type: 'error', text: errMsg });
      console.error('Error recording attendance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate stats from records
  const stats = [
    {
      label: 'Present Today',
      value: attendanceRecords.filter((r) => r.status === 'Present').length,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Late',
      value: attendanceRecords.filter((r) => r.status === 'Late').length,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      label: 'Absent',
      value: attendanceRecords.filter((r) => r.status === 'Absent').length,
      color: 'bg-red-100 text-red-600',
    },
    {
      label: 'On Leave',
      value: attendanceRecords.filter((r) => r.status === 'On Leave').length,
      color: 'bg-blue-100 text-blue-600',
    },
  ];

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
      key: 'check_in',
      label: 'Check In',
      render: (value: string) => value || '-',
    },
    {
      key: 'check_out',
      label: 'Check Out',
      render: (value: string) => value || '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'Present'
              ? 'bg-green-100 text-green-800'
              : value === 'Late'
              ? 'bg-orange-100 text-orange-800'
              : value === 'Absent'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {value}
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEmployee ? 'My Attendance' : 'Attendance Management'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEmployee
                ? 'View your attendance records'
                : selectedCompany ? `Track attendance at ${selectedCompany.name}` : 'Select a company to track attendance'}
            </p>
          </div>
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => setShowModal(true)}
              disabled={!selectedCompany}
              className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={20} />
              Manual Entry
            </Button>
          )}
        </div>

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to view attendance records</p>
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
        {/* Date Selector */}
        <Card>
          <div className="flex items-center gap-4">
            <Calendar size={20} className="text-gray-600" />
            <DatePicker
              value={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              placeholder="Select attendance date"
            />
            <span className="text-gray-600 text-sm">
              Viewing records for {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <TrendingUp size={24} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Attendance Table */}
        <Card header={<h2 className="text-lg font-semibold">Attendance Records</h2>} noPadding>
          {attendanceRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No attendance records for this date
            </div>
          ) : (
            <Table columns={columns} data={attendanceRecords} />
          )}
        </Card>
          </>
        )}
          </>
        )}
      </div>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
          setMessage(null);
        }}
        title="Manual Attendance Entry"
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
              {isSubmitting ? 'Saving...' : 'Save Entry'}
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
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Date
            </label>
            <DatePicker
              value={attendanceDate}
              onChange={(date) => setValue('date', date)}
              placeholder="Select date"
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Check In
              </label>
              <TimePicker
                value={checkIn || ''}
                onChange={(time) => setValue('check_in', time)}
                placeholder="Select time"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Check Out
              </label>
              <TimePicker
                value={checkOut || ''}
                onChange={(time) => setValue('check_out', time)}
                placeholder="Select time"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              {...register('status')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Status</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="On Leave">On Leave</option>
              <option value="Half-Day">Half-Day</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              {...register('notes')}
              placeholder="Add any notes"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default AttendancePage;
