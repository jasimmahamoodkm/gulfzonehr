'use client';

import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { Plus, CheckCircle, Clock, XCircle } from 'lucide-react';

const LeaveManagementPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const leaveRequests = [
    {
      id: '1',
      employee_name: 'Ahmed Hassan',
      leave_type: 'Vacation',
      start_date: '2026-05-20',
      end_date: '2026-05-25',
      days: 5,
      status: 'Approved',
      reason: 'Summer vacation',
      approver: 'Fatima Al-Zahra',
    },
    {
      id: '2',
      employee_name: 'Leila Ibrahim',
      leave_type: 'Sick Leave',
      start_date: '2026-05-10',
      end_date: '2026-05-12',
      days: 2,
      status: 'Pending',
      reason: 'Medical appointment',
      approver: '-',
    },
    {
      id: '3',
      employee_name: 'Mohammed Ali',
      leave_type: 'Personal',
      start_date: '2026-05-18',
      end_date: '2026-05-18',
      days: 1,
      status: 'Pending',
      reason: 'Personal matter',
      approver: '-',
    },
    {
      id: '4',
      employee_name: 'Sara Khan',
      leave_type: 'Maternity Leave',
      start_date: '2026-06-01',
      end_date: '2026-08-31',
      days: 91,
      status: 'Approved',
      reason: 'Maternity leave',
      approver: 'Fatima Al-Zahra',
    },
    {
      id: '5',
      employee_name: 'Ali Rahman',
      leave_type: 'Vacation',
      start_date: '2026-05-05',
      end_date: '2026-05-08',
      days: 3,
      status: 'Rejected',
      reason: 'Family trip',
      approver: 'Fatima Al-Zahra',
    },
  ];

  const leaveBalance = [
    { type: 'Vacation', allocated: 20, used: 8, remaining: 12 },
    { type: 'Sick Leave', allocated: 10, used: 2, remaining: 8 },
    { type: 'Personal', allocated: 5, used: 2, remaining: 3 },
    { type: 'Maternity', allocated: 120, used: 0, remaining: 120 },
  ];

  const columns = [
    {
      key: 'employee_name',
      label: 'Employee',
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
      key: 'approver',
      label: 'Approver',
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
            <p className="text-gray-600 mt-1">Manage employee leave requests and balances</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)} className="gap-2">
            <Plus size={20} />
            New Leave Request
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Pending Requests</p>
                <p className="text-3xl font-bold text-gray-900">7</p>
              </div>
              <Clock size={32} className="text-orange-200" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Approved This Month</p>
                <p className="text-3xl font-bold text-gray-900">12</p>
              </div>
              <CheckCircle size={32} className="text-green-200" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total On Leave</p>
                <p className="text-3xl font-bold text-gray-900">23</p>
              </div>
              <Users size={32} className="text-blue-200" />
            </div>
          </Card>
        </div>

        {/* Leave Balance */}
        <Card header={<h2 className="text-lg font-semibold">Company-wide Leave Balance</h2>}>
          <div className="space-y-4">
            {leaveBalance.map((balance) => (
              <div key={balance.type}>
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-gray-900">{balance.type}</span>
                  <span className="text-sm text-gray-600">
                    {balance.remaining} / {balance.allocated} days
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${((balance.allocated - balance.remaining) / balance.allocated) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

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
          <Table columns={columns} data={filteredLeaves} />
        </Card>
      </div>

      {/* New Leave Request Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="New Leave Request"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary">
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Employee" placeholder="Select employee" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Vacation</option>
              <option>Sick Leave</option>
              <option>Personal</option>
              <option>Maternity Leave</option>
              <option>Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="From Date" type="date" />
            <Input label="To Date" type="date" />
          </div>
          <Input label="Reason" as="textarea" placeholder="Enter reason for leave" />
        </div>
      </Modal>
    </Layout>
  );
};

// Import Users icon
import { Users } from 'lucide-react';

export default LeaveManagementPage;
