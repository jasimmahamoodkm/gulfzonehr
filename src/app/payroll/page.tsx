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
import MonthPicker from '@/components/ui/MonthPicker';
import { Plus, Download, Calendar } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

const payrollSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  month: z.string().min(1, 'Month is required'),
  salary: z.number().min(0, 'Salary must be positive'),
  bonus: z.number().min(0, 'Bonus must be positive').optional(),
  deductions: z.number().min(0, 'Deductions must be positive').optional(),
});

type PayrollFormData = z.infer<typeof payrollSchema>;

const PayrollPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [payrollData, setPayrollData] = useState<any[]>([]);
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
  } = useForm<PayrollFormData>({
    resolver: zodResolver(payrollSchema),
  });

  const payrollMonth = watch('month');

  // Fetch payroll data
  const fetchPayroll = async () => {
    try {
      setLoading(true);
      if (!selectedCompany) {
        setPayrollData([]);
        return;
      }

      // Get employees
      const { data: empData } = await supabase
        .from('employees')
        .select('id,first_name,last_name,position')
        .eq('company_id', selectedCompany.id);

      setEmployees(empData || []);

      // Get payroll
      const { data: payData, error } = await supabase
        .from('payroll')
        .select('id,employee_id,month,salary,bonus,deductions,net_pay,status,created_at')
        .in('employee_id', empData?.map((e) => e.id) || [])
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayrollData(payData || []);
    } catch (err) {
      console.error('Error fetching payroll:', err);
      setMessage({ type: 'error', text: 'Failed to load payroll records' });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPayroll();
  }, [selectedCompany, selectedMonth]);

  const onSubmit = async (data: PayrollFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      const bonus = data.bonus || 0;
      const deductions = data.deductions || 0;
      const net_pay = data.salary + bonus - deductions;

      const { error } = await supabase.from('payroll').insert({
        employee_id: data.employee_id,
        month: data.month,
        salary: data.salary,
        bonus: bonus,
        deductions: deductions,
        net_pay,
        status: 'Processed',
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Payroll processed successfully' });
      reset();
      setShowModal(false);
      fetchPayroll();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const errMsg = (err as any)?.message || 'Failed to process payroll';
      setMessage({ type: 'error', text: errMsg });
      console.error('Error processing payroll:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate summary
  const payrollSummary = {
    total_salary: payrollData.reduce((sum, p) => sum + (p.salary || 0), 0),
    total_allowances: payrollData.reduce((sum, p) => sum + (p.bonus || 0), 0),
    total_deductions: payrollData.reduce((sum, p) => sum + (p.deductions || 0), 0),
    total_net_pay: payrollData.reduce((sum, p) => sum + (p.net_pay || 0), 0),
    paid: payrollData.filter((p) => p.status === 'Paid').length,
    processed: payrollData.filter((p) => p.status === 'Processed').length,
    pending: payrollData.filter((p) => p.status === 'Pending').length,
  };

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
      key: 'salary',
      label: 'Basic Salary',
      render: (value: number) => `$${value.toLocaleString()}`,
    },
    {
      key: 'bonus',
      label: 'Allowances',
      render: (value: number) => `$${(value || 0).toLocaleString()}`,
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (value: number) => `$${(value || 0).toLocaleString()}`,
    },
    {
      key: 'net_pay',
      label: 'Net Pay',
      render: (value: number) => (
        <span className="font-bold text-green-600">$${value.toLocaleString()}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'Paid'
              ? 'bg-green-100 text-green-800'
              : value === 'Processed'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-yellow-100 text-yellow-800'
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
            <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
            <p className="text-gray-600 mt-1">
              {selectedCompany ? `Manage payroll for ${selectedCompany.name}` : 'Select a company to manage payroll'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            disabled={!selectedCompany}
            className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Process Payroll
          </Button>
        </div>

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to manage payroll</p>
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
        {/* Month Selector */}
        <Card>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar size={16} />
              Select Month:
            </label>
            <MonthPicker
              value={selectedMonth}
              onChange={(month) => setSelectedMonth(month)}
              placeholder="Select month"
            />
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-2">Total Salary</p>
              <p className="text-2xl font-bold text-gray-900">${payrollSummary.total_salary.toLocaleString()}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-2">Allowances</p>
              <p className="text-2xl font-bold text-blue-600">${payrollSummary.total_allowances.toLocaleString()}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-2">Deductions</p>
              <p className="text-2xl font-bold text-red-600">${payrollSummary.total_deductions.toLocaleString()}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-2">Net Payroll</p>
              <p className="text-2xl font-bold text-green-600">${payrollSummary.total_net_pay.toLocaleString()}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-2">Status Overview</p>
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-semibold text-green-600">{payrollSummary.paid}</span> Paid,
                <span className="font-semibold text-blue-600 ml-1">{payrollSummary.processed}</span> Processed
              </p>
            </div>
          </Card>
        </div>

        {/* Payroll Table */}
        <Card
          header={<h2 className="text-lg font-semibold">Payroll Details</h2>}
          noPadding
        >
          {payrollData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No payroll records for this month
            </div>
          ) : (
            <Table columns={columns} data={payrollData} />
          )}
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="outline" className="gap-2">
            <Download size={20} />
            Export Payroll Report
          </Button>
          <Button variant="secondary" className="gap-2">
            Generate Pay Slips
          </Button>
        </div>
          </>
        )}
          </>
        )}
      </div>

      {/* Process Payroll Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
          setMessage(null);
        }}
        title="Process Payroll"
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
              {isSubmitting ? 'Processing...' : 'Process Payroll'}
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
              Month
            </label>
            <MonthPicker
              value={payrollMonth}
              onChange={(month) => setValue('month', month)}
              placeholder="Select month"
            />
            {errors.month && (
              <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Basic Salary</label>
              <input
                {...register('salary', { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.salary && (
                <p className="mt-1 text-sm text-red-600">{errors.salary.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bonus/Allowance</label>
              <input
                {...register('bonus', { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.bonus && (
                <p className="mt-1 text-sm text-red-600">{errors.bonus.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Deductions</label>
            <input
              {...register('deductions', { valueAsNumber: true })}
              type="number"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.deductions && (
              <p className="mt-1 text-sm text-red-600">{errors.deductions.message}</p>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default PayrollPage;
