'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { Search, Plus, Archive, Copy, Check, Upload, Key, Award, Edit2, UserCheck, TrendingUp } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/lib/api';
import PromotionRequestModal from '@/components/employees/PromotionRequestModal';

// Schema for Add Employee (auto-creation API)
const createEmployeeSchema = z.object({
  email: z.string().email('Invalid email'),
  first_name: z.string().min(2, 'First name required'),
  last_name: z.string().min(2, 'Last name required'),
  phone: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  date_of_joining: z.string().optional(),
  grade_id: z.string().optional(),
});

type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

const ITEMS_PER_PAGE = 20;

const EmployeesPage: React.FC = () => {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  // Role flags
  const isDeptManager = user?.roles?.some(r => r.role_name === 'Manager') ?? false;
  const isAdminOrHR = user?.roles?.some(r =>
    ['Super Admin', 'Company Admin', 'HR Manager'].includes(r.role_name || '')
  ) ?? false;
  // Manager: view only — no create, edit, delete, grade assign, password reset, manager assign
  const canManageEmployees = isAdminOrHR;

  // Manager assignment modal state
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerTarget, setManagerTarget] = useState<{ id: string; name: string; currentManagerId: string | null } | null>(null);
  const [availableManagers, setAvailableManagers] = useState<{ id: string; name: string }[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [savingManager, setSavingManager] = useState(false);

  // Current manager's employee ID (used to scope their data view)
  const [myEmployeeId, setMyEmployeeId] = React.useState<string | null>(null);

  // Fetch manager's own employee ID on mount
  React.useEffect(() => {
    if (!isDeptManager || !user?.id) return;
    supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setMyEmployeeId(data.id); });
  }, [isDeptManager, user?.id]);
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

  // Grade assignment state
  const [grades, setGrades] = useState<{ id: string; name: string; level: number; salary?: number; currency?: string }[]>([]);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<{ id: string; name: string; currentGradeId: string | null } | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [savingGrade, setSavingGrade] = useState(false);

  // Promotion / demotion request modal
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionTarget, setPromotionTarget] = useState<{ id: string; name: string; currentGradeId: string | null; currentSalary: number | null } | null>(null);
  const openPromotionModal = (employee: any) => {
    const gradeSalary = grades.find((g) => g.id === employee.grade_id)?.salary ?? null;
    setPromotionTarget({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      currentGradeId: employee.grade_id ?? null,
      currentSalary: gradeSalary,
    });
    setShowPromotionModal(true);
  };

  // Edit Employee state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    position: '',
    department: '',
    employment_type: '',
    status: '',
    date_of_joining: '',
    grade_id: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

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


      const response = await fetch(apiUrl('/api/admin/create-employee'), {
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
          grade_id: data.grade_id || null,
        }),
      });


      const result = await response.json();


      if (!response.ok) {
        throw new Error(result.error || `Failed to create employee (Status: ${response.status})`);
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
        await fetchEmployees(currentPage);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      const errMsg = (err as any)?.message || (err as any)?.error?.message || 'Failed to create employee';
      console.error('[Create Employee] Error:', errMsg, err);
      setCreateMessage({ type: 'error', text: errMsg });
    } finally {
      setCreateLoading(false);
    }
  };

  // Fetch grades for the selected company (for grade assignment dropdown + salary display)
  const fetchGrades = async (companyId: string) => {
    try {
      const { data: gradesData, error } = await supabase
        .from('employee_grades')
        .select('id, name, level')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('level', { ascending: true });

      if (error || !gradesData) return;

      // Fetch current salary config for all grades in one query
      const gradeIds = gradesData.map((g) => g.id);
      const today = new Date().toISOString().split('T')[0];
      const { data: salaryData } = await supabase
        .from('grade_salary_config')
        .select('grade_id, salary, currency, effective_from')
        .in('grade_id', gradeIds.length > 0 ? gradeIds : ['00000000-0000-0000-0000-000000000000'])
        .lte('effective_from', today)
        .order('effective_from', { ascending: false });

      // Pick the most recent salary config per grade
      const salaryMap: Record<string, { salary: number; currency: string }> = {};
      (salaryData || []).forEach((s: any) => {
        if (!salaryMap[s.grade_id]) {
          salaryMap[s.grade_id] = { salary: s.salary, currency: s.currency };
        }
      });

      setGrades(gradesData.map((g) => ({ ...g, ...salaryMap[g.id] })));
    } catch {
      // grades are optional — silent fail
    }
  };


  // Open manager assignment modal
  const openManagerModal = async (employee: any) => {
    setManagerTarget({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      currentManagerId: employee.manager_id ?? null,
    });
    setSelectedManagerId(employee.manager_id ?? '');
    setShowManagerModal(true);

    // Load managers: employees with Manager role in this company
    if (selectedCompany) {
      const { data } = await supabase
        .from('employees')
        .select('id,first_name,last_name,user_id')
        .eq('company_id', selectedCompany.id)
        .neq('id', employee.id); // exclude self

      if (data) {
        // Filter to those who have Manager role via user_roles
        const userIds = data.map(e => e.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('user_id, roles(name)')
            .in('user_id', userIds);

          const managerUserIds = new Set(
            roleData
              ?.filter((r: any) => r.roles?.name === 'Manager')
              .map((r: any) => r.user_id) || []
          );

          const managers = data
            .filter(e => managerUserIds.has(e.user_id))
            .map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}` }));

          setAvailableManagers(managers);
        } else {
          setAvailableManagers([]);
        }
      }
    }
  };

  const saveManagerAssignment = async () => {
    if (!managerTarget) return;
    try {
      setSavingManager(true);

      // Use API route — server enforces that only Super Admin, Company Admin,
      // and HR Manager can assign managers (regardless of UI bypass attempts).
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(apiUrl('/api/employees/assign-manager'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employee_id: managerTarget.id,
          manager_id: selectedManagerId || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to assign manager');

      setShowManagerModal(false);
      setManagerTarget(null);
      fetchEmployees(currentPage);
    } catch (err) {
      alert('Failed to assign manager: ' + ((err as any)?.message || 'Unknown error'));
    } finally {
      setSavingManager(false);
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
      // For manager: wait until their employee ID is resolved.
      // If still null, show empty rather than leaking all employee data.
      if (isDeptManager && !myEmployeeId) {
        setEmployees([]);
        setTotalCount(0);
        return;
      }

      const offset = (page - 1) * ITEMS_PER_PAGE;
      const selectCols = 'id,first_name,last_name,email,phone,position,department,employment_type,date_of_joining,status,created_at,grade_id,manager_id,employee_grades(name,level)';

      if (isDeptManager && myEmployeeId) {
        // Manager sees: themselves + their directly assigned employees
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', selectedCompany.id)
          .or(`id.eq.${myEmployeeId},manager_id.eq.${myEmployeeId}`);
        setTotalCount(count || 0);

        const { data, error } = await supabase
          .from('employees')
          .select(selectCols)
          .eq('company_id', selectedCompany.id)
          .or(`id.eq.${myEmployeeId},manager_id.eq.${myEmployeeId}`)
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);
        if (error) throw error;
        setEmployees(data || []);
      } else {
        // Admin / HR Manager: all company employees
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', selectedCompany.id);
        setTotalCount(count || 0);

        const { data, error } = await supabase
          .from('employees')
          .select(selectCols)
          .eq('company_id', selectedCompany.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);
        if (error) throw error;
        setEmployees(data || []);
      }

      setCurrentPage(page);
    } catch (err) {
      const errorMsg = (err as any)?.message || 'Failed to load employees';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees when company or myEmployeeId changes
  // myEmployeeId is async — including it ensures manager's view loads after it resolves
  React.useEffect(() => {
    setCurrentPage(1);
    fetchEmployees(1);
    if (selectedCompany) fetchGrades(selectedCompany.id);
  }, [selectedCompany, myEmployeeId]);

  // Open the grade assignment modal for a specific employee
  const openGradeModal = (employee: any) => {
    setGradeTarget({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      currentGradeId: employee.grade_id ?? null,
    });
    setSelectedGradeId(employee.grade_id ?? '');
    setShowGradeModal(true);
  };

  const saveGradeAssignment = async () => {
    if (!gradeTarget) return;
    try {
      setSavingGrade(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Change the grade via the API route — it updates the grade, records the
      // change in employee_change_history, and writes the audit log server-side.
      const res = await fetch(apiUrl(`/api/employees/${gradeTarget.id}/change-grade`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ grade_id: selectedGradeId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update grade');

      // Auto-init leave balances for the newly assigned grade
      if (selectedGradeId && selectedCompany && token) {
        try {
          await fetch(apiUrl('/api/admin/employees/init-leave-balance'), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: gradeTarget.id,
              grade_id: selectedGradeId,
              company_id: selectedCompany.id,
            }),
          });
        } catch {
          // Non-blocking — don't fail the grade save if leave init fails
        }
      }

      setMessage({ type: 'success', text: `Grade updated for ${gradeTarget.name}` });
      setTimeout(() => setMessage(null), 3000);
      setShowGradeModal(false);
      setGradeTarget(null);
      fetchEmployees(currentPage);
    } catch (err) {
      const errorMsg = (err as any)?.message || 'Failed to update grade';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSavingGrade(false);
    }
  };

  // Open edit modal pre-filled with employee data
  const openEditModal = (employee: any) => {
    setEditTarget(employee);
    setEditForm({
      first_name: employee.first_name ?? '',
      last_name: employee.last_name ?? '',
      position: employee.position ?? '',
      department: employee.department ?? '',
      employment_type: employee.employment_type ?? '',
      status: employee.status ?? '',
      date_of_joining: employee.date_of_joining ?? '',
      grade_id: employee.grade_id ?? '',
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      setSavingEdit(true);
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          position: editForm.position || null,
          department: editForm.department || null,
          employment_type: editForm.employment_type || null,
          status: editForm.status || null,
          date_of_joining: editForm.date_of_joining || null,
          grade_id: editForm.grade_id || null,
        })
        .eq('id', editTarget.id);

      if (error) throw error;

      setMessage({ type: 'success', text: `Employee ${editForm.first_name} ${editForm.last_name} updated successfully` });
      setTimeout(() => setMessage(null), 3000);
      setShowEditModal(false);
      setEditTarget(null);
      fetchEmployees(currentPage);
    } catch (err) {
      const errorMsg = (err as any)?.message || 'Failed to update employee';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSavingEdit(false);
    }
  };

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

      const response = await fetch(apiUrl('/api/admin/generate-temp-password'), {
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

  // Archive (soft delete): keep the record but set status Inactive + archived_at
  // so the employee's history stays viewable.
  const archiveEmployee = async (id: string) => {
    if (!confirm('Archive this employee? They will be set to Inactive but kept for history.')) return;

    try {
      setDeleteLoading(id);
      const { error } = await supabase.from('employees')
        .update({ status: 'Inactive', archived_at: new Date().toISOString(), archived_by: user?.id ?? null })
        .eq('id', id);
      if (error) {
        let errorMsg = 'Failed to archive employee';
        if (typeof error === 'object' && error !== null) {
          if ('message' in error && error.message) errorMsg = String(error.message);
          else if ('details' in error && error.details) errorMsg = String(error.details);
          else if ('hint' in error && error.hint) errorMsg = String(error.hint);
        }
        throw new Error(errorMsg);
      }

      setMessage({ type: 'success', text: 'Employee archived' });
      fetchEmployees(currentPage);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      let displayError = 'Failed to archive employee';
      if (err instanceof Error) displayError = err.message;
      else if (typeof err === 'string') displayError = err;
      else if (typeof err === 'object' && err !== null) {
        const errObj = err as any;
        displayError = errObj.message || errObj.details || errObj.error?.message || JSON.stringify(err);
      }
      setMessage({ type: 'error', text: displayError });
      console.error('Error archiving employee:', err);
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
      key: 'grade_id',
      label: 'Grade',
      render: (_: any, row: any) => {
        const grade = row.employee_grades as { name: string; level: number } | null;
        if (grade) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              <Award size={11} />
              {grade.name}
            </span>
          );
        }
        return <span className="text-xs text-gray-400 italic">Unassigned</span>;
      },
    },
    {
      key: 'grade_salary',
      label: 'Salary',
      render: (_: any, row: any) => {
        const grade = grades.find((g) => g.id === row.grade_id);
        if (grade?.salary != null) {
          return `${grade.currency || 'AED'} ${Number(grade.salary).toLocaleString()}`;
        }
        return <span className="text-xs text-gray-400 italic">—</span>;
      },
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
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {!canManageEmployees ? (
            <span className="text-xs text-gray-400 italic">View only</span>
          ) : (
            <>
          <button
            onClick={() => openEditModal(row)}
            className="p-1 hover:bg-gray-200 rounded transition"
            title="Edit Employee"
          >
            <Edit2 size={18} className="text-blue-600" />
          </button>
          <button
            onClick={() => openGradeModal(row)}
            className="p-1 hover:bg-gray-200 rounded transition"
            title="Assign Grade"
          >
            <Award size={18} className="text-purple-600" />
          </button>
          {isAdminOrHR && (
            <button
              onClick={() => openManagerModal(row)}
              className="p-1 hover:bg-gray-200 rounded transition"
              title="Assign Manager"
            >
              <UserCheck size={18} className="text-teal-600" />
            </button>
          )}
          {isAdminOrHR && (
            <button
              onClick={() => openPromotionModal(row)}
              className="p-1 hover:bg-gray-200 rounded transition"
              title="Request Promotion / Demotion"
            >
              <TrendingUp size={18} className="text-green-600" />
            </button>
          )}
          <button
            onClick={() => generateTemporaryPassword(row.id, `${row.first_name} ${row.last_name}`)}
            disabled={generatingPassword === row.id}
            className="p-1 hover:bg-gray-200 rounded transition disabled:opacity-50"
            title="Generate New Password"
          >
            <Key size={18} className="text-orange-600" />
          </button>
          <button
            onClick={() => archiveEmployee(row.id)}
            disabled={deleteLoading === row.id}
            className="p-1 hover:bg-gray-200 rounded transition disabled:opacity-50"
            title="Archive (set Inactive, keep history)"
          >
            <Archive size={18} className="text-amber-600" />
          </button>
            </>
          )}
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
          {canManageEmployees && (
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
          )}
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
            <Table columns={columns} data={filteredEmployees} onRowClick={(row) => router.push(`/employees/${row.id}`)} />
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
        <form className="space-y-4 overflow-visible">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
                {grades.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2">
                    No grades configured.{' '}
                    <Link href="/admin/grades" target="_blank" className="text-blue-600 underline">Create grades first</Link>.
                  </p>
                ) : (
                  <select
                    {...registerCreate('grade_id')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Grade (optional)</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Level {g.level})
                        {g.salary != null ? ` — ${g.currency || 'AED'} ${Number(g.salary).toLocaleString()}` : ''}
                      </option>
                    ))}
                  </select>
                )}
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

      {/* Assign Grade Modal */}
      <Modal
        isOpen={showGradeModal}
        onClose={() => { setShowGradeModal(false); setGradeTarget(null); }}
        title="Assign Grade"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowGradeModal(false); setGradeTarget(null); }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveGradeAssignment} disabled={savingGrade}>
              {savingGrade ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        {gradeTarget && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Employee</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{gradeTarget.name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade
              </label>
              {grades.length === 0 ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  No grades configured yet.{' '}
                  <Link href="/admin/grades" className="underline font-medium">Create grades first</Link>.
                </div>
              ) : (
                <select
                  value={selectedGradeId}
                  onChange={(e) => setSelectedGradeId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">— Remove grade assignment —</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (Level {g.level})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedGradeId && (() => {
              const g = grades.find(x => x.id === selectedGradeId);
              return g ? (
                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <Award size={16} className="text-purple-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-purple-900">{g.name}</p>
                    <p className="text-xs text-purple-600">Level {g.level}</p>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditTarget(null); }}
        title="Edit Employee"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditTarget(null); }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                <input
                  type="text"
                  value={editForm.position}
                  onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="e.g. Software Engineer"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Sales">Sales</option>
                  <option value="HR & Admin">HR & Admin</option>
                  <option value="Operations">Operations</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                <select
                  value={editForm.employment_type}
                  onChange={(e) => setEditForm((f) => ({ ...f, employment_type: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employment Type</option>
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
              <DatePicker
                value={editForm.date_of_joining}
                onChange={(date) => setEditForm((f) => ({ ...f, date_of_joining: date }))}
                placeholder="Select joining date"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
              {grades.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">
                  No grades configured.{' '}
                  <Link href="/admin/grades" target="_blank" className="text-blue-600 underline">Create grades first</Link>.
                </p>
              ) : (
                <select
                  value={editForm.grade_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, grade_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No grade —</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (Level {g.level})
                      {g.salary != null ? ` — ${g.currency || 'AED'} ${Number(g.salary).toLocaleString()}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
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

      {/* Assign Manager Modal */}
      <Modal
        isOpen={showManagerModal}
        onClose={() => { setShowManagerModal(false); setManagerTarget(null); }}
        title={`Assign Manager — ${managerTarget?.name || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowManagerModal(false); setManagerTarget(null); }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveManagerAssignment} disabled={savingManager}>
              {savingManager ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a Manager to assign to this employee. The manager will be able to view this employee's data.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Manager</label>
            <select
              value={selectedManagerId}
              onChange={e => setSelectedManagerId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No Manager (unassign) —</option>
              {availableManagers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {availableManagers.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">
                No Managers found in this company. Assign the Manager role first via RBAC.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Promotion / Demotion request modal */}
      <PromotionRequestModal
        isOpen={showPromotionModal}
        onClose={() => { setShowPromotionModal(false); setPromotionTarget(null); }}
        employee={promotionTarget ? { id: promotionTarget.id, name: promotionTarget.name } : null}
        currentGradeId={promotionTarget?.currentGradeId ?? null}
        currentSalary={promotionTarget?.currentSalary ?? null}
        grades={grades}
        onSubmitted={(msg) => setMessage({ type: 'success', text: msg })}
      />
    </Layout>
  );
};

export default EmployeesPage;
