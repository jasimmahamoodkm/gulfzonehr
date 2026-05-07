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
import { Plus, AlertCircle, Clock, CheckCircle, Eye, Trash2 } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';

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
);

type DocumentFormData = z.infer<typeof documentSchema>;

const DocumentsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [showModal, setShowModal] = useState(false);
  const [documentFilter, setDocumentFilter] = useState<'all' | 'expiring' | 'expired'>('all');
  const [documents, setDocuments] = useState<any[]>([]);
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
  } = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
  });

  const issueDate = watch('issue_date');
  const expiryDate = watch('expiry_date');

  // Fetch documents and employees
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      if (!selectedCompany) {
        setDocuments([]);
        return;
      }

      // Get employees
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
    } catch (err) {
      console.error('Error fetching documents:', err);
      setMessage({ type: 'error', text: 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCompany]);

  const onSubmit = async (data: DocumentFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      let fileUrl: string | null = null;

      // Handle file upload if provided
      if (data.file && data.file.length > 0) {
        const file = data.file[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedCompany?.id}/${data.employee_id || 'company'}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('documents').insert({
        company_id: selectedCompany?.id,
        employee_id: data.employee_id || null,
        document_type: data.document_type,
        document_number: data.document_number,
        issue_date: data.issue_date,
        expiry_date: data.expiry_date,
        issuing_authority: data.issuing_authority,
        file_url: fileUrl,
      });

      if (error) throw error;

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

  const handleViewDocument = (fileUrl: string) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleDeleteDocument = async (documentId: string, documentType: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${documentType}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Document deleted successfully' });
      fetchDocuments();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setMessage({ type: 'error', text: 'Failed to delete document' });
    }
  };

  const columns = [
    {
      key: 'employee_name',
      label: 'Name/Company',
    },
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
          <button
            onClick={() => handleDeleteDocument(value, row.document_type)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete document"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
            <p className="text-gray-600 mt-1">
              {selectedCompany ? `Track documents for ${selectedCompany.name}` : 'Select a company to manage documents'}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            disabled={!selectedCompany}
            className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Add Document
          </Button>
        </div>

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to manage documents</p>
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
            <select
              {...register('employee_id')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
            <select
              {...register('document_type')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Type --</option>
              <option>Driving License</option>
              <option>Passport</option>
              <option>Emirates ID</option>
              <option>Company License</option>
              <option>Other</option>
            </select>
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
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Supported formats: PDF, DOC, DOCX, JPG, PNG, TXT (Max 10MB)</p>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default DocumentsPage;
