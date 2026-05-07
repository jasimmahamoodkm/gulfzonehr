'use client';

import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { Search, Plus, Edit, Trash2, Eye } from 'lucide-react';

const EmployeesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Mock data
  const employees = [
    {
      id: '1',
      first_name: 'Ahmed',
      last_name: 'Hassan',
      email: 'ahmed.hassan@gulfzone.com',
      position: 'Senior Developer',
      department: 'Engineering',
      company: 'GulfZone Tech',
      status: 'Active',
      date_of_joining: '2021-01-15',
      salary: 8500,
    },
    {
      id: '2',
      first_name: 'Fatima',
      last_name: 'Al-Zahra',
      email: 'fatima.zahra@gulfzone.com',
      position: 'HR Manager',
      department: 'HR & Admin',
      company: 'GulfZone Group',
      status: 'Active',
      date_of_joining: '2020-06-01',
      salary: 6500,
    },
    {
      id: '3',
      first_name: 'Mohammed',
      last_name: 'Ali',
      email: 'mohammed.ali@gulfzone.com',
      position: 'Sales Executive',
      department: 'Sales',
      company: 'GulfZone Trading',
      status: 'Active',
      date_of_joining: '2022-03-10',
      salary: 5000,
    },
    {
      id: '4',
      first_name: 'Leila',
      last_name: 'Ibrahim',
      email: 'leila.ibrahim@gulfzone.com',
      position: 'Marketing Specialist',
      department: 'Marketing',
      company: 'GulfZone Group',
      status: 'On Leave',
      date_of_joining: '2021-09-20',
      salary: 4500,
    },
  ];

  const columns = [
    {
      key: 'first_name',
      label: 'Name',
      render: (value: string, row: any) => `${value} ${row.last_name}`,
    },
    {
      key: 'email',
      label: 'Email',
    },
    {
      key: 'position',
      label: 'Position',
    },
    {
      key: 'department',
      label: 'Department',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'Active'
              ? 'bg-green-100 text-green-800'
              : value === 'On Leave'
              ? 'bg-orange-100 text-orange-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'salary',
      label: 'Salary',
      render: (value: number) => `$${value.toLocaleString()}`,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, __: any) => (
        <div className="flex gap-2">
          <button className="p-1 hover:bg-gray-200 rounded transition">
            <Eye size={18} className="text-blue-600" />
          </button>
          <button className="p-1 hover:bg-gray-200 rounded transition">
            <Edit size={18} className="text-gray-600" />
          </button>
          <button className="p-1 hover:bg-gray-200 rounded transition">
            <Trash2 size={18} className="text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = !filterDept || emp.department === filterDept;
    const matchesStatus = !filterStatus || emp.status === filterStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
            <p className="text-gray-600 mt-1">Manage your workforce across all companies</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            className="gap-2"
          >
            <Plus size={20} />
            Add Employee
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="HR & Admin">HR & Admin</option>
              <option value="Marketing">Marketing</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>

            <Button
              variant="secondary"
              onClick={() => {
                setSearchTerm('');
                setFilterDept('');
                setFilterStatus('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </Card>

        {/* Results Summary */}
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredEmployees.length}</span> of{' '}
          <span className="font-semibold">{employees.length}</span> employees
        </div>

        {/* Table */}
        <Card noPadding>
          <Table columns={columns} data={filteredEmployees} />
        </Card>
      </div>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Employee"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary">
              Add Employee
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" placeholder="Enter first name" />
            <Input label="Last Name" placeholder="Enter last name" />
          </div>
          <Input label="Email" type="email" placeholder="Enter email address" />
          <Input label="Phone" placeholder="Enter phone number" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Position" placeholder="Enter position" />
            <Input label="Department" placeholder="Select department" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Company" placeholder="Select company" />
            <Input label="Salary" type="number" placeholder="Enter salary" />
          </div>
          <Input label="Date of Joining" type="date" />
        </div>
      </Modal>
    </Layout>
  );
};

export default EmployeesPage;
