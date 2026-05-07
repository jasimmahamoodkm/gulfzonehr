'use client';

import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { Plus, Calendar, TrendingUp } from 'lucide-react';

const AttendancePage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);

  const attendanceRecords = [
    {
      id: '1',
      employee_name: 'Ahmed Hassan',
      position: 'Senior Developer',
      check_in: '08:30 AM',
      check_out: '05:45 PM',
      status: 'Present',
      work_hours: '9h 15m',
    },
    {
      id: '2',
      employee_name: 'Fatima Al-Zahra',
      position: 'HR Manager',
      check_in: '09:00 AM',
      check_out: '06:00 PM',
      status: 'Present',
      work_hours: '9h 0m',
    },
    {
      id: '3',
      employee_name: 'Mohammed Ali',
      position: 'Sales Executive',
      check_in: '09:15 AM',
      check_out: '-',
      status: 'Late',
      work_hours: '7h 45m',
    },
    {
      id: '4',
      employee_name: 'Leila Ibrahim',
      position: 'Marketing Specialist',
      check_in: '-',
      check_out: '-',
      status: 'Absent',
      work_hours: '0h 0m',
    },
  ];

  const stats = [
    { label: 'Present Today', value: 1200, color: 'bg-green-100 text-green-600' },
    { label: 'Late', value: 45, color: 'bg-orange-100 text-orange-600' },
    { label: 'Absent', value: 12, color: 'bg-red-100 text-red-600' },
    { label: 'On Leave', value: 23, color: 'bg-blue-100 text-blue-600' },
  ];

  const columns = [
    {
      key: 'employee_name',
      label: 'Employee Name',
    },
    {
      key: 'position',
      label: 'Position',
    },
    {
      key: 'check_in',
      label: 'Check In',
    },
    {
      key: 'check_out',
      label: 'Check Out',
    },
    {
      key: 'work_hours',
      label: 'Work Hours',
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
            <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
            <p className="text-gray-600 mt-1">Track employee attendance and working hours</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)} className="gap-2">
            <Plus size={20} />
            Manual Entry
          </Button>
        </div>

        {/* Date Selector */}
        <Card>
          <div className="flex items-center gap-4">
            <Calendar size={20} className="text-gray-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <Card header={<h2 className="text-lg font-semibold">Today's Attendance</h2>} noPadding>
          <Table columns={columns} data={attendanceRecords} />
        </Card>
      </div>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Manual Attendance Entry"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary">
              Save Entry
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Employee" placeholder="Select employee" />
          <Input label="Date" type="date" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Check In" type="time" />
            <Input label="Check Out" type="time" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Present</option>
              <option>Late</option>
              <option>Absent</option>
              <option>Half-Day</option>
            </select>
          </div>
          <Input label="Notes" placeholder="Add any notes" as="textarea" />
        </div>
      </Modal>
    </Layout>
  );
};

export default AttendancePage;
