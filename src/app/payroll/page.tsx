'use client';

import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { Plus, Download } from 'lucide-react';

const PayrollPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  const payrollData = [
    {
      id: '1',
      employee_name: 'Ahmed Hassan',
      position: 'Senior Developer',
      basic_salary: 8500,
      allowances: 1500,
      deductions: 850,
      net_pay: 9150,
      status: 'Paid',
    },
    {
      id: '2',
      employee_name: 'Fatima Al-Zahra',
      position: 'HR Manager',
      basic_salary: 6500,
      allowances: 1000,
      deductions: 650,
      net_pay: 6850,
      status: 'Paid',
    },
    {
      id: '3',
      employee_name: 'Mohammed Ali',
      position: 'Sales Executive',
      basic_salary: 5000,
      allowances: 1200,
      deductions: 520,
      net_pay: 5680,
      status: 'Processed',
    },
    {
      id: '4',
      employee_name: 'Leila Ibrahim',
      position: 'Marketing Specialist',
      basic_salary: 4500,
      allowances: 800,
      deductions: 430,
      net_pay: 4870,
      status: 'Pending',
    },
  ];

  const payrollSummary = {
    total_salary: 24500,
    total_allowances: 4500,
    total_deductions: 2450,
    total_net_pay: 26550,
    paid: 2,
    processed: 1,
    pending: 1,
  };

  const columns = [
    {
      key: 'employee_name',
      label: 'Employee',
    },
    {
      key: 'basic_salary',
      label: 'Basic Salary',
      render: (value: number) => `$${value.toLocaleString()}`,
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (value: number) => `$${value.toLocaleString()}`,
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (value: number) => `$${value.toLocaleString()}`,
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
            <p className="text-gray-600 mt-1">Manage salaries, allowances, and deductions</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)} className="gap-2">
            <Plus size={20} />
            Process Payroll
          </Button>
        </div>

        {/* Month Selector */}
        <Card>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Select Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <Table columns={columns} data={payrollData} />
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
      </div>

      {/* Process Payroll Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Process Payroll"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary">
              Process Payroll
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Companies</label>
            <div className="space-y-2">
              {['GulfZone Tech', 'GulfZone Trading', 'GulfZone Logistics', 'GulfZone Consulting'].map((company) => (
                <label key={company} className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm text-gray-700">{company}</span>
                </label>
              ))}
            </div>
          </div>
          <Input label="Payment Date" type="date" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Bank Transfer</option>
              <option>Cheque</option>
              <option>Cash</option>
            </select>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default PayrollPage;
