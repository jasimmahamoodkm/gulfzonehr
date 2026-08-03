'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import DatePicker from '@/components/ui/DatePicker';
import SelectMenu from '@/components/ui/SelectMenu';
import Link from 'next/link';
import { Plus, AlertCircle, Clock, CheckCircle, Eye, Trash2, Lock, FileText, CreditCard } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiUrl, logActivity } from '@/lib/api';
import { processFileForUpload, isCompressibleImage, formatFileSize } from '@/lib/imageCompression';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB in bytes

const documentSchema = z.object({
  employee_id: z.string().optional(),
  document_type: z.string().min(1, 'Document type is required'),
  document_number: z.string().min(1, 'Document number is required'),
  issue_date: z.string().min(1, 'Issue date is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  issuing_authority: z.string().min(1, 'Issuing authority is required'),
  file: z.any().optional(),
}).refine(
  (data) => new Date(data.expiry_date) > new Date(data.issue_date),
  {
    message: 'Expiry date must be after issue date',
    path: ['expiry_date'],
  }
).refine(
  (data) => {
    if (!data.file || data.file.length === 0) return true; // File is optional
    const file = data.file[0];
    return file.size <= MAX_FILE_SIZE;
  },
  {
    message: 'File size must be less than 2 MB',
    path: ['file'],
  }
);

type DocumentFormData = z.infer<typeof documentSchema>;

const DocumentsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  // Determine user role
  const isDeptManager = user?.roles?.some(r => r.role_name === 'Manager') ?? false;
  const isAdminOrHR = user?.roles?.some(r =>
    r.role_name === 'Super Admin' ||
    r.role_name === 'Company Admin' ||
    r.role_name === 'HR Manager'
  ) || false;
  const isAdmin = isAdminOrHR || isDeptManager;
  const isEmployee = !isAdmin;

  // Manager role: can VIEW documents but NOT upload/delete
  const canUploadDocuments = isAdminOrHR;
  const canDeleteDocuments = isAdminOrHR;

  const [showModal, setShowModal] = useState(false);
  const [documentFilter, setDocumentFilter] = useState<'all' | 'expiring' | 'expired'>('all');

  // Allow deep-linking a filter (e.g. dashboard tiles link to /documents?filter=expired)
  React.useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('filter');
    if (f === 'expiring' || f === 'expired') setDocumentFilter(f);
  }, []);
  const [documents, setDocuments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);

  // Get current employee ID if user is an employee
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
  } = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
  });

  const issueDate = watch('issue_date');
  const expiryDate = watch('expiry_date');
  const fileWatch = watch('file');

  // Handle file change to show file info
  useEffect(() => {
    if (fileWatch && fileWatch.length > 0) {
      const file = fileWatch[0];
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  }, [fileWatch]);

  // Fetch documents and employees
  const fetchDocuments = async () => {
    try {
      setLoading(true);

      // For employees: show only their own documents
      // For dept managers: show own + their assigned employees' documents
      if (isDeptManager && currentEmployeeId) {
        const { data: managedEmps } = await supabase
          .from('employees')
          .select('*')
          .or(`id.eq.${currentEmployeeId},manager_id.eq.${currentEmployeeId}`)
          .eq('company_id', selectedCompany?.id || '');
        setEmployees(managedEmps || []);

        const managedIds = (managedEmps || []).map((e: any) => e.id);
        const { data: docData, error } = await supabase
          .from('documents')
          .select('*, employees(first_name, last_name)')
          .in('employee_id', managedIds.length > 0 ? managedIds : ['00000000-0000-0000-0000-000000000000'])
          .order('expiry_date', { ascending: true });
        if (error) throw error;

        const enrichedDocs = (docData || []).map((doc: any) => {
          const expiry = new Date(doc.expiry_date);
          const today = new Date();
          const diffMs = expiry.getTime() - today.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          const status = diffDays < 0 ? 'Expired' : diffDays <= 30 ? 'Expiring Soon' : 'Active';
          const employee = doc.employees;
          return {
            ...doc,
            days_until_expiry: diffDays,
            status,
            employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'N/A',
          };
        });
        setDocuments(enrichedDocs);
        return;
      }

      if (isEmployee && currentEmployeeId) {
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('id', currentEmployeeId)
          .single();

        setEmployees(empData ? [empData] : []);

        // Get documents for this employee
        const { data: docData, error } = await supabase
          .from('documents')
          .select('*')
          .eq('employee_id', currentEmployeeId)
          .order('expiry_date', { ascending: true });

        if (error) throw error;

        // Enrich documents with employee names and calculate status
        const enrichedDocs = (docData || []).map((doc: any) => {
          const expiry = new Date(doc.expiry_date);
          const today = new Date();
          const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          let status = 'Active';
          if (daysUntilExpiry < 0) status = 'Expired';
          else if (daysUntilExpiry <= 30) status = 'Expiring Soon';

          const employeeName = empData ? `${empData.first_name} ${empData.last_name}` : 'Unknown';

          return {
            ...doc,
            employee_name: employeeName,
            status,
            days_until_expiry: daysUntilExpiry,
          };
        });

        setDocuments(enrichedDocs);
      } else if (selectedCompany) {
        // For admin/manager: show all employees' documents
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('company_id', selectedCompany.id);

        setEmployees(empData || []);

        // Get documents
        const { data: docData, error } = await supabase
          .from('documents')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('expiry_date', { ascending: true });

        if (error) throw error;

        // Enrich documents with employee names and calculate status
        const enrichedDocs = (docData || []).map((doc: any) => {
          const expiry = new Date(doc.expiry_date);
          const today = new Date();
          const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          let status = 'Active';
          if (daysUntilExpiry < 0) status = 'Expired';
          else if (daysUntilExpiry <= 30) status = 'Expiring Soon';

          const emp = empData?.find((e: any) => e.id === doc.employee_id);
          const employeeName = emp ? `${emp.first_name} ${emp.last_name}` : (doc.employee_name || selectedCompany.name);

          return {
            ...doc,
            employee_name: employeeName,
            status,
            days_until_expiry: daysUntilExpiry,
          };
        });

        setDocuments(enrichedDocs);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setMessage({ type: 'error', text: 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCompany, currentEmployeeId, isEmployee]);

  const onSubmit = async (data: DocumentFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      let fileUrl: string | null = null;

      // Handle file upload if provided
      if (data.file && data.file.length > 0) {
        let file = data.file[0];

        // Process file (compress images to WebP if needed)

        if (isCompressibleImage(file)) {
          try {
            file = await processFileForUpload(file);
          } catch (compressionError) {
            console.warn('File compression failed, uploading original:', compressionError);
            // Continue with original file if compression fails
          }
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedCompany?.id}/${data.employee_id || 'company'}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file, { upsert: false });

        if (uploadError) throw uploadError;

        // Store the file path (not a public URL) so we can generate
        // signed URLs on demand. The bucket is private for security.
        fileUrl = fileName;
      }

      const { data: inserted, error } = await supabase.from('documents').insert({
        company_id: selectedCompany?.id,
        employee_id: data.employee_id || null,
        document_type: data.document_type,
        document_number: data.document_number,
        issue_date: data.issue_date,
        expiry_date: data.expiry_date,
        issuing_authority: data.issuing_authority,
        file_url: fileUrl,
      }).select('id').single();

      if (error) throw error;

      // Audit log
      await logActivity(supabase, {
        company_id: selectedCompany?.id ?? null,
        action: 'create_document',
        resource_type: 'documents',
        resource_id: inserted?.id ?? null,
        resource_name: `${data.document_type} — ${data.document_number}`,
      });

      setMessage({ type: 'success', text: 'Document added successfully' });
      reset();
      setShowModal(false);
      fetchDocuments();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const errMsg = (err as any)?.message || 'Failed to add document';
      setMessage({ type: 'error', text: errMsg });
      console.error('Error adding document:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  const filteredDocuments = documents.filter((doc) => {
    if (documentFilter === 'expiring') return doc.status === 'Expiring Soon';
    if (documentFilter === 'expired') return doc.status === 'Expired';
    return true;
  });

  const getStatusIcon = (status: string) => {
    if (status === 'Active') return <CheckCircle size={16} className="text-green-600" />;
    if (status === 'Expiring Soon') return <Clock size={16} className="text-yellow-600" />;
    return <AlertCircle size={16} className="text-red-600" />;
  };

  const handleViewDocument = async (filePath: string) => {
    if (!filePath) return;

    try {
      let storagePath = filePath;

      // Extract the storage path from legacy full URLs
      // e.g. https://.../storage/v1/object/public/documents/company/emp/file.webp
      //   → company/emp/file.webp
      if (filePath.startsWith('http')) {
        const marker = '/object/public/documents/';
        const markerAlt = '/object/sign/documents/';
        const idx = filePath.indexOf(marker) !== -1
          ? filePath.indexOf(marker) + marker.length
          : filePath.indexOf(markerAlt) !== -1
            ? filePath.indexOf(markerAlt) + markerAlt.length
            : -1;

        if (idx === -1) {
          // Unknown URL format — open directly as fallback
          window.open(filePath, '_blank');
          return;
        }
        // Strip any query string (e.g. signed URL tokens)
        storagePath = filePath.substring(idx).split('?')[0];
      }

      // Generate a 1-hour signed URL for the private bucket
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to generate document URL:', err);
      alert('Could not open document. Please try again.');
    }
  };

  const handleDeleteDocument = async (documentId: string, documentType: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${documentType}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Use API route with service role key — bypasses RLS for all roles including HR Manager
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(apiUrl(`/api/documents/${documentId}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete document');

      setMessage({ type: 'success', text: 'Document deleted successfully' });
      fetchDocuments();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete document' });
    }
  };

  const columns = [
    ...(isAdmin ? [{
      key: 'employee_name',
      label: 'Name/Company',
    }] : []),
    {
      key: 'document_type',
      label: 'Document Type',
    },
    {
      key: 'document_number',
      label: 'Document Number',
    },
    {
      key: 'expiry_date',
      label: 'Expiry Date',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(value)}
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              value === 'Active'
                ? 'bg-green-100 text-green-800'
                : value === 'Expiring Soon'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {value}
          </span>
        </div>
      ),
    },
    {
      key: 'days_until_expiry',
      label: 'Days Until Expiry',
      render: (value: number) => {
        if (value < 0) return <span className="text-red-600 font-semibold">Expired {Math.abs(value)} days ago</span>;
        return <span className="font-semibold">{value} days</span>;
      },
    },
    {
      key: 'id',
      label: 'Actions',
      render: (value: string, row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDocument(row.file_url)}
            disabled={!row.file_url}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed transition"
            title="View document"
          >
            <Eye size={18} />
          </button>
          {canDeleteDocuments && (
            <button
              onClick={() => handleDeleteDocument(value, row.document_type)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete document"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Tab bar — Documents / PDC Cheques */}
        {!isEmployee && (
          <div className="flex gap-2 border-b border-gray-200">
            <span className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px">
              <FileText size={16} /> Documents
            </span>
            <Link href="/documents/pdc" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">
              <CreditCard size={16} /> PDC Cheques
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEmployee ? 'My Documents' : 'Document Management'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEmployee
                ? 'View your documents'
                : selectedCompany ? `Track documents for ${selectedCompany.name}` : 'Select a company to manage documents'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            disabled={!selectedCompany || !canUploadDocuments}
            title={!canUploadDocuments ? 'Only Admins and Managers can upload documents' : ''}
            className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!canUploadDocuments ? (
              <>
                <Lock size={20} />
                Upload Restricted
              </>
            ) : (
              <>
                <Plus size={20} />
                Add Document
              </>
            )}
          </Button>
        </div>

        {!selectedCompany && !isEmployee && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to manage documents</p>
          </Card>
        )}

        {selectedCompany && !canUploadDocuments && !isEmployee && (
          <Card className="bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <Lock size={18} />
              <p>You have view-only access. Only Admins and Managers can upload documents.</p>
            </div>
          </Card>
        )}

        {(selectedCompany || isEmployee) && (
          <>
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && (
          <>
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active Documents</p>
                <p className="text-2xl font-bold text-gray-900">{documents.filter(d => d.status === 'Active').length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock size={24} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Expiring Soon</p>
                <p className="text-2xl font-bold text-gray-900">{documents.filter(d => d.status === 'Expiring Soon').length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Expired</p>
                <p className="text-2xl font-bold text-gray-900">{documents.filter(d => d.status === 'Expired').length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Card>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'expiring', 'expired'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDocumentFilter(filter)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  documentFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' && 'All Documents'}
                {filter === 'expiring' && 'Expiring Soon'}
                {filter === 'expired' && 'Expired'}
              </button>
            ))}
          </div>
        </Card>

        {/* Documents Table */}
        <Card
          header={<h2 className="text-lg font-semibold">Documents</h2>}
          noPadding
        >
          {filteredDocuments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No documents found
            </div>
          ) : (
            <Table columns={columns} data={filteredDocuments} />
          )}
        </Card>
          </>
        )}
          </>
        )}
      </div>

      {/* Add Document Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
          setMessage(null);
        }}
        title="Add Document"
        size="lg"
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
              {isSubmitting ? 'Adding...' : 'Add Document'}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Owner</label>
            <SelectMenu
              value={watch('employee_id') || ''}
              onChange={(v) => setValue('employee_id', v, { shouldValidate: true })}
              placeholder="-- Select Employee --"
              options={employees.map((emp) => ({ value: emp.id, label: `${emp.first_name} ${emp.last_name}` }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
            <SelectMenu
              value={watch('document_type') || ''}
              onChange={(v) => setValue('document_type', v, { shouldValidate: true })}
              placeholder="-- Select Type --"
              options={['Driving License', 'Passport', 'Emirates ID', 'Company License', 'Other']
                .map(t => ({ value: t, label: t }))}
            />
            {errors.document_type && (
              <p className="mt-1 text-sm text-red-600">{errors.document_type.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issue Date</label>
              <DatePicker
                value={issueDate}
                onChange={(date) => setValue('issue_date', date)}
                placeholder="Select issue date"
              />
              {errors.issue_date && (
                <p className="mt-1 text-sm text-red-600">{errors.issue_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
              <DatePicker
                value={expiryDate}
                onChange={(date) => setValue('expiry_date', date)}
                placeholder="Select expiry date"
              />
              {errors.expiry_date && (
                <p className="mt-1 text-sm text-red-600">{errors.expiry_date.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Number</label>
            <input
              {...register('document_number')}
              type="text"
              placeholder="Enter document number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.document_number && (
              <p className="mt-1 text-sm text-red-600">{errors.document_number.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Issuing Authority</label>
            <input
              {...register('issuing_authority')}
              type="text"
              placeholder="e.g., UAE RTA, GDRFA, Immigration"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.issuing_authority && (
              <p className="mt-1 text-sm text-red-600">{errors.issuing_authority.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attach File (Optional)</label>
            <input
              {...register('file')}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Supported formats: PDF, DOC, DOCX, JPG, PNG, WebP, TXT (Max 2 MB)
            </p>
            <p className="mt-1 text-xs text-blue-600">
              💡 Images are automatically compressed to WebP format for optimal storage
            </p>
            {selectedFile && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-medium text-blue-900">📁 Selected File:</p>
                <p className="text-xs text-blue-700 mt-1">{selectedFile.name}</p>
                <p className="text-xs text-blue-700">Size: {formatFileSize(selectedFile.size)}</p>
                {isCompressibleImage(selectedFile) && (
                  <p className="text-xs text-blue-700 mt-1">✅ Will be compressed to WebP</p>
                )}
              </div>
            )}
            {errors.file && errors.file.message && (
              <p className="mt-1 text-sm text-red-600">{String(errors.file.message)}</p>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default DocumentsPage;
