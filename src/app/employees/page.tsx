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
import { Search, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

const employeeSchema = z.object({
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone number must be at least 7 characters'),
  position: z.string().min(2, 'Position is required'),
  department: z.string().min(2, 'Department is required'),
  salary: z.number().min(0, 'Salary must be positive'),
  employment_type: z.string().min(2, 'Employment type is required'),
  date_of_joining: z.string().min(1, 'Date of joining is required'),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

const ITEMS_PER_PAGE = 20;

const EmployeesPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  const joiningDate = watch('date_of_joining');

  // Fetch employees from database with pagination
  const fetchEmployees = async (page: number = 1) => {
    try {
      setLoading(true);
      if (!selectedCompany) {
        setEmployees([]);
        return;
      }

      const offset = (page - 1) * ITEMS_PER_PAGE;

      // Fetch total count
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      setTotalCount(count || 0);

      // Fetch paginated data
      const { data, error } = await supabase
        .from('employees')
        .select('id,first_name,last_name,email,phone,position,department,salary,employment_type,date_of_joining,status,created_at')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setEmployees(data || []);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setMessage({ type: 'error', text: 'Failed to load employees' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees when company changes
  React.useEffect(() => {
    setCurrentPage(1);
    fetchEmployees(1);
  }, [selectedCompany]);

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      if (!selectedCompany) {
        setMessage({ type: 'error', text: 'Please select a company' });
        return;
      }

      if (editingId) {
        // Update existing employee
        const { error } = await supabase
          .from('employees')
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone,
            position: data.position,
            department: data.department,
            salary: data.salary,
            employment_type: data.employment_type,
            date_of_joining: data.date_of_joining,
          })
          .eq('id', editingId);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Employee updated successfully' });
      } else {
        // Create new employee
        const { error } = await supabase.from('employees').insert({
          company_id: selectedCompany.id,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          position: data.position,
          department: data.department,
          salary: data.salary,
          employment_type: data.employment_type,
          date_of_joining: data.date_of_joining,
          status: 'Active',
        });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Employee added successfully' });
      }

      reset();
      setEditingId(null);
      setShowModal(false);
      fetchEmployees(currentPage);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const errMsg = (err as any)?.message || 'Failed to save employee';
      setMessage({ type: 'error', text: errMsg });
      console.error('Error saving employee:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (employee: any) => {
    reset({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      salary: employee.salary,
      employment_type: employee.employment_type,
      date_of_joining: employee.date_of_joining,
    });
    setEditingId(employee.id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    reset();
    setMessage(null);
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      setDeleteLoading(id);
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;

      setMessage({ type: 'success', text: 'Employee deleted successfully' });
      fetchEmployees(currentPage);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete employee' });
      console.error('Error deleting employee:', err);
    } finally {
      setDeleteLoading(null);
    }
  };

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
      render: (_: any, row: any) => (
        <div className="flex gap-2">
          <button className="p-1 hover:bg-gray-200 rounded transition" title="View">
            <Eye size={18} className="text-blue-600" />
          </button>
          <button onClick={() => handleEdit(row)} className="p-1 hover:bg-gray-200 rounded transition" title="Edit">
            <Edit size={18} className="text-gray-600" />
          </button>
          <button
            onClick={() => deleteEmployee(row.id)}
            disabled={deleteLoading === row.id}
            className="p-1 hover:bg-gray-200 rounded transition disabled:opacity-50"
            title="Delete"
          >
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
            <p className="text-gray-600 mt-1">
              {selectedCompany ? `Manage employees at ${selectedCompany.name}` : 'Select a company to view employees'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            disabled={!selectedCompany}
            className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Add Employee
          </Button>
        </div>

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to view and manage employees</p>
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
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>
            Showing <span className="font-semibold">{filteredEmployees.length}</span> of{' '}
            <span className="font-semibold">{totalCount}</span> employees (Page {currentPage} of {Math.ceil(totalCount / ITEMS_PER_PAGE)})
          </span>
        </div>

        {/* Table */}
        <Card noPadding>
          {filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No employees found
            </div>
          ) : (
            <Table columns={columns} data={filteredEmployees} />
          )}
        </Card>

        {/* Pagination */}
        {totalCount > ITEMS_PER_PAGE && (
          <div className="flex justify-center items-center gap-2">
            <Button
              variant="outline"
              onClick={() => fetchEmployees(currentPage - 1)}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </Button>
            {Array.from({ length: Math.ceil(totalCount / ITEMS_PER_PAGE) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => fetchEmployees(page)}
                className={`px-3 py-1 rounded-lg transition ${
                  page === currentPage
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={loading}
              >
                {page}
              </button>
            ))}
            <Button
              variant="outline"
              onClick={() => fetchEmployees(currentPage + 1)}
              disabled={currentPage === Math.ceil(totalCount / ITEMS_PER_PAGE) || loading}
            >
              Next
            </Button>
          </div>
        )}
          </>
        )}
          </>
        )}
      </div>

      {/* Add/Edit Employee Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingId ? 'Edit Employee' : 'Add New Employee'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Employee' : 'Add Employee')}
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

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-600 uppercase">Company</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{selectedCompany?.name}</p>
            <p className="text-xs text-gray-600 mt-1">This employee will be added to this company</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                {...register('first_name')}
                type="text"
                placeholder="Enter first name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                {...register('last_name')}
                type="text"
                placeholder="Enter last name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="Enter email address"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="Enter phone number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <input
                {...register('position')}
                type="text"
                placeholder="Enter position"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.position && (
                <p className="mt-1 text-sm text-red-600">{errors.position.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                {...register('department')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Department</option>
                <option value="Engineering">Engineering</option>
                <option value="Sales">Sales</option>
                <option value="HR & Admin">HR & Admin</option>
                <option value="Operations">Operations</option>
                <option value="Marketing">Marketing</option>
              </select>
              {errors.department && (
                <p className="mt-1 text-sm text-red-600">{errors.department.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Salary</label>
              <input
                {...register('salary', { valueAsNumber: true })}
                type="number"
                placeholder="Enter salary"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.salary && (
                <p className="mt-1 text-sm text-red-600">{errors.salary.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
              <select
                {...register('employment_type')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type</option>
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
              {errors.employment_type && (
                <p className="mt-1 text-sm text-red-600">{errors.employment_type.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
            <DatePicker
              value={joiningDate}
              onChange={(date) => setValue('date_of_joining', date)}
              placeholder="Select joining date"
            />
            {errors.date_of_joining && (
              <p className="mt-1 text-sm text-red-600">{errors.date_of_joining.message}</p>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default EmployeesPage;
