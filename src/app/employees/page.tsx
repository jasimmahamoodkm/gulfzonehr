'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Search, Plus, Trash2, Copy, Check, Upload, Key } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

// Schema for Add Employee (auto-creation API)
const createEmployeeSchema = z.object({
  email: z.string().email('Invalid email'),
  first_name: z.string().min(2, 'First name required'),
  last_name: z.string().min(2, 'Last name required'),
  phone: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  date_of_joining: z.string().optional(),
});

type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

const ITEMS_PER_PAGE = 20;

const EmployeesPage: React.FC = () => {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [newEmployeeData, setNewEmployeeData] = useState<{ email: string; temporaryPassword: string; first_name: string; last_name: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPasswordData, setTempPasswordData] = useState<{
    employee_name: string;
    employee_email: string;
    temporaryPassword: string;
    emailSent: boolean;
  } | null>(null);
  const [copiedTempPassword, setCopiedTempPassword] = useState(false);
  const [generatingPassword, setGeneratingPassword] = useState<string | null>(null);

  // Form for Add Employee (auto-creation)
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    watch: watchCreate,
    setValue: setValueCreate,
    formState: { errors: errorsCreate },
  } = useForm<CreateEmployeeFormData>({
    resolver: zodResolver(createEmployeeSchema),
  });

  const joiningDateCreate = watchCreate('date_of_joining');

  // Copy password to clipboard
  const copyPasswordToClipboard = () => {
    if (newEmployeeData?.temporaryPassword) {
      navigator.clipboard.writeText(newEmployeeData.temporaryPassword).then(() => {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      });
    }
  };

  // Handle auto-creation form submission
  const onSubmitCreate = async (data: CreateEmployeeFormData) => {
    try {
      setCreateLoading(true);
      setCreateMessage(null);

      if (!selectedCompany) {
        setCreateMessage({ type: 'error', text: 'Please select a company' });
        return;
      }

      // Get current auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch('/api/admin/create-employee', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          company_id: selectedCompany.id,
          phone: data.phone || '',
          position: data.position || '',
          department: data.department || '',
          date_of_joining: data.date_of_joining || new Date().toISOString().split('T')[0],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create employee');
      }

      if (result.success && result.data) {
        setNewEmployeeData({
          email: result.data.email,
          temporaryPassword: result.data.temporaryPassword,
          first_name: result.data.first_name,
          last_name: result.data.last_name,
        });
        setCreateMessage({
          type: 'success',
          text: 'Employee created successfully! Share the temporary password with the employee.',
        });
        resetCreate();
        fetchEmployees(currentPage);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      const errMsg = (err as any)?.message || (err as any)?.error?.message || 'Failed to create employee';
      setCreateMessage({ type: 'error', text: errMsg });
      console.error('Error creating employee:', err);
    } finally {
      setCreateLoading(false);
    }
  };

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
      const errorMsg = (err as any)?.message || (err as any)?.error?.message || 'Failed to load employees';
      console.error('Error fetching employees:', err, errorMsg);
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees when company changes
  React.useEffect(() => {
    setCurrentPage(1);
    fetchEmployees(1);
  }, [selectedCompany]);

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    resetCreate();
    setMessage(null);
    setNewEmployeeData(null);
    setCopiedPassword(false);
  };

  const generateTemporaryPassword = async (employeeId: string, employeeName: string) => {
    try {
      setGeneratingPassword(employeeId);

      if (!selectedCompany) {
        setMessage({ type: 'error', text: 'Please select a company first' });
        setGeneratingPassword(null);
        return;
      }

      // Get current auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setMessage({ type: 'error', text: 'Authentication required. Please log in again.' });
        setGeneratingPassword(null);
        return;
      }

      const response = await fetch('/api/admin/generate-temp-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          company_id: selectedCompany?.id,
          send_email: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate temporary password');
      }

      if (result.success && result.data) {
        setTempPasswordData({
          employee_name: result.data.employee_name,
          employee_email: result.data.employee_email,
          temporaryPassword: result.data.temporaryPassword,
          emailSent: result.data.emailSent,
        });
        setShowTempPasswordModal(true);
        setMessage({
          type: 'success',
          text: `New temporary password generated for ${employeeName}`,
        });
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      const errorMsg = (err as any)?.message || (err as any)?.error?.message || 'Failed to generate temporary password';
      setMessage({ type: 'error', text: errorMsg });
      console.error('Error generating temporary password:', err);
    } finally {
      setGeneratingPassword(null);
    }
  };

  const copyTempPasswordToClipboard = () => {
    if (tempPasswordData?.temporaryPassword) {
      navigator.clipboard.writeText(tempPasswordData.temporaryPassword).then(() => {
        setCopiedTempPassword(true);
        setTimeout(() => setCopiedTempPassword(false), 2000);
      });
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      setDeleteLoading(id);
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) {
        // Extract error message from Supabase error object
        let errorMsg = 'Failed to delete employee';
        if (typeof error === 'object' && error !== null) {
          if ('message' in error && error.message) {
            errorMsg = String(error.message);
          } else if ('details' in error && error.details) {
            errorMsg = String(error.details);
          } else if ('hint' in error && error.hint) {
            errorMsg = String(error.hint);
          }
        }
        throw new Error(errorMsg);
      }

      setMessage({ type: 'success', text: 'Employee deleted successfully' });
      fetchEmployees(currentPage);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      let displayError = 'Failed to delete employee';
      if (err instanceof Error) {
        displayError = err.message;
      } else if (typeof err === 'string') {
        displayError = err;
      } else if (typeof err === 'object' && err !== null) {
        const errObj = err as any;
        displayError = errObj.message || errObj.details || errObj.error?.message || JSON.stringify(err);
      }
      setMessage({ type: 'error', text: displayError });
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
      render: (value: number | null) => value ? `$${value.toLocaleString()}` : '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => generateTemporaryPassword(row.id, `${row.first_name} ${row.last_name}`)}
            disabled={generatingPassword === row.id}
            className="p-1 hover:bg-gray-200 rounded transition disabled:opacity-50"
            title="Generate New Password"
          >
            <Key size={18} className="text-orange-600" />
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
        {/* Message Banner */}
        {message && (
          <div className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex justify-between items-start">
              <p className="font-medium">{message.text}</p>
              <button onClick={() => setMessage(null)} className="text-xl leading-none opacity-70 hover:opacity-100">
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
            <p className="text-gray-600 mt-1">
              {selectedCompany ? `Manage employees at ${selectedCompany.name}` : 'Select a company to view employees'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push('/employees/import')}
              disabled={!selectedCompany}
              className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={20} />
              Import CSV
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedCompany}
              className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={20} />
              Add Employee
            </Button>
          </div>
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

      {/* Add Employee Modal (Auto-creation with Auth) */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="Create Employee"
        size="lg"
        footer={
          newEmployeeData ? (
            <Button variant="primary" onClick={handleCloseCreateModal}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCloseCreateModal}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmitCreate(onSubmitCreate)} disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create Employee'}
              </Button>
            </>
          )
        }
      >
        <form className="space-y-4">
          {createMessage && (
            <div className={`p-3 rounded-lg ${
              createMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {createMessage.text}
            </div>
          )}

          {!newEmployeeData ? (
            <>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-medium text-blue-600 uppercase">Company</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{selectedCompany?.name}</p>
                <p className="text-xs text-gray-600 mt-1">Employee will be created with automatic account provisioning</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    {...registerCreate('first_name')}
                    type="text"
                    placeholder="Enter first name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errorsCreate.first_name && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.first_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    {...registerCreate('last_name')}
                    type="text"
                    placeholder="Enter last name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errorsCreate.last_name && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.last_name.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  {...registerCreate('email')}
                  type="email"
                  placeholder="Enter email address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errorsCreate.email && (
                  <p className="mt-1 text-sm text-red-600">{errorsCreate.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  {...registerCreate('phone')}
                  type="tel"
                  placeholder="Enter phone number (optional)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errorsCreate.phone && (
                  <p className="mt-1 text-sm text-red-600">{errorsCreate.phone.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                  <input
                    {...registerCreate('position')}
                    type="text"
                    placeholder="Enter position (optional)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errorsCreate.position && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.position.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    {...registerCreate('department')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department (optional)</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Sales">Sales</option>
                    <option value="HR & Admin">HR & Admin</option>
                    <option value="Operations">Operations</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                  {errorsCreate.department && (
                    <p className="mt-1 text-sm text-red-600">{errorsCreate.department.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
                <DatePicker
                  value={joiningDateCreate ?? ''}
                  onChange={(date) => setValueCreate('date_of_joining', date)}
                  placeholder="Select joining date (optional)"
                />
                {errorsCreate.date_of_joining && (
                  <p className="mt-1 text-sm text-red-600">{errorsCreate.date_of_joining.message}</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-sm font-semibold text-green-900 mb-3">Employee Created Successfully!</h3>

                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-medium">Employee Name</p>
                    <p className="text-lg font-semibold text-gray-900">{newEmployeeData.first_name} {newEmployeeData.last_name}</p>
                  </div>

                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-medium">Email Address</p>
                    <p className="text-sm font-semibold text-gray-900 break-all">{newEmployeeData.email}</p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border-2 border-yellow-200">
                    <p className="text-xs text-gray-600 uppercase font-medium mb-2">Temporary Password</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm font-bold text-gray-900 break-all">
                        {newEmployeeData.temporaryPassword}
                      </code>
                      <button
                        type="button"
                        onClick={copyPasswordToClipboard}
                        className="flex-shrink-0 p-2 hover:bg-gray-100 rounded transition"
                        title="Copy password"
                      >
                        {copiedPassword ? (
                          <Check size={20} className="text-green-600" />
                        ) : (
                          <Copy size={20} className="text-gray-600" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-yellow-700 mt-2">⚠️ Share this password securely with the employee. They must change it on first login.</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700">
                    ✓ Auth account created<br/>
                    ✓ Employee record created<br/>
                    ✓ Employee role assigned<br/>
                    ✓ Company access configured
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Generate Temporary Password Modal */}
      <Modal
        isOpen={showTempPasswordModal}
        onClose={() => {
          setShowTempPasswordModal(false);
          setTempPasswordData(null);
          setCopiedTempPassword(false);
        }}
        title="Temporary Password Generated"
        size="lg"
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setShowTempPasswordModal(false);
              setTempPasswordData(null);
              setCopiedTempPassword(false);
            }}
          >
            Close
          </Button>
        }
      >
        {tempPasswordData && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">New Temporary Password Created</h3>

              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase font-medium">Employee Name</p>
                  <p className="text-lg font-semibold text-gray-900">{tempPasswordData.employee_name}</p>
                </div>

                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase font-medium">Email Address</p>
                  <p className="text-sm font-semibold text-gray-900 break-all">{tempPasswordData.employee_email}</p>
                </div>

                <div className="bg-white p-3 rounded-lg border-2 border-orange-200">
                  <p className="text-xs text-gray-600 uppercase font-medium mb-2">Temporary Password</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm font-bold text-gray-900 break-all">
                      {tempPasswordData.temporaryPassword}
                    </code>
                    <button
                      type="button"
                      onClick={copyTempPasswordToClipboard}
                      className="flex-shrink-0 p-2 hover:bg-gray-100 rounded transition"
                      title="Copy password"
                    >
                      {copiedTempPassword ? (
                        <Check size={20} className="text-green-600" />
                      ) : (
                        <Copy size={20} className="text-gray-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-orange-700 mt-2">⚠️ Share this password securely with the employee. They must change it on first login.</p>
                </div>

                {tempPasswordData.emailSent && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Welcome email with new password has been sent to {tempPasswordData.employee_email}
                    </p>
                  </div>
                )}

                {!tempPasswordData.emailSent && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Email could not be sent. Please share the password manually with the employee.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default EmployeesPage;
