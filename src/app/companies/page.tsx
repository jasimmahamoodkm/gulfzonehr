'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import { Plus, Edit, Trash2, MapPin, Phone, Mail, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { apiUrl } from '@/lib/api';
import { companyBranding } from '@/config/branding';
import { useTimeouts } from '@/hooks/useTimeouts';

const companySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone number must be at least 7 characters'),
  industry: z.string().min(2, 'Industry is required'),
  city: z.string().min(2, 'City is required'),
  country: z.string().min(2, 'Country is required'),
  founded_year: z.number().min(1900, 'Founded year must be valid'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
});

type CompanyFormData = z.infer<typeof companySchema>;

const CompaniesPage: React.FC = () => {
  const { user } = useAuth();
  const schedule = useTimeouts();

  // Role flags
  const isSuperAdmin = user?.roles?.some(r => r.role_name === 'Super Admin') ?? false;
  const isCompanyAdmin = user?.roles?.some(r => r.role_name === 'Company Admin') ?? false;

  // Super Admin: full CRUD on all companies
  // Company Admin: view + edit their own company only (no create, no delete)
  const canCreate = isSuperAdmin;
  const canDelete = isSuperAdmin;
  const canEdit   = isSuperAdmin || isCompanyAdmin;

  const [showModal, setShowModal]     = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [message, setMessage]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null); // cache-busted path after upload
  const companiesMounted = React.useRef(true);

  React.useEffect(() => {
    companiesMounted.current = true;
    return () => { companiesMounted.current = false; };
  }, []);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
  });
  const companyName = watch('name');

  const uploadLogo = async (file: File) => {
    const name = (companyName || '').trim();
    if (!name) { setMessage({ type: 'error', text: 'Enter the company name first, then upload a logo.' }); return; }
    setLogoUploading(true);
    setMessage(null);
    try {
      const image: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/admin/company-logo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ company: name, image }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setLogoPreview(`${apiUrl(json.path)}?t=${Date.now()}`);
      setMessage({ type: 'success', text: `Logo saved (512×512, ${(json.bytes / 1024).toFixed(0)} KB) and written to the config.` });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Logo upload failed' });
    } finally {
      setLogoUploading(false);
    }
  };

  const fetchCompanies = useCallback(async () => {
    if (!user) return;

    // One query pass. Throws on a real DB error so the caller can retry —
    // this self-heals the transient auth-not-ready window (a token refresh in
    // flight) that otherwise surfaced a spurious "Failed to load companies".
    const loadOnce = async (): Promise<any[]> => {
      let list: any[] = [];
      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from('companies').select('*').order('name', { ascending: true });
        if (error) throw error;
        list = data || [];
      } else {
        const { data: ucData } = await supabase
          .from('user_companies').select('company_id')
          .eq('user_id', user.id).limit(1).maybeSingle();
        const companyId = ucData?.company_id ?? user.company_id;
        if (!companyId) return [];
        const { data, error } = await supabase
          .from('companies').select('*').eq('id', companyId).single();
        if (error) throw error;
        list = data ? [data] : [];
      }
      // The stored employee_count column drifts — compute the real count.
      const ids = list.map((c) => c.id);
      if (ids.length) {
        const { data: emps } = await supabase
          .from('employees').select('company_id').in('company_id', ids);
        const counts: Record<string, number> = {};
        (emps || []).forEach((e: { company_id: string }) => {
          counts[e.company_id] = (counts[e.company_id] || 0) + 1;
        });
        list = list.map((c) => ({ ...c, employee_count: counts[c.id] || 0 }));
      }
      return list;
    };

    setLoading(true);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const list = await loadOnce();
        if (!companiesMounted.current) return;
        setCompanies(list);
        setLoading(false);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800)); // let auth settle, retry once
        if (!companiesMounted.current) return;
      }
    }
    if (!companiesMounted.current) return;
    console.error('Error fetching companies (after retry):', lastErr);
    setMessage({ type: 'error', text: 'Failed to load companies' });
    setLoading(false);
  }, [user, isSuperAdmin]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const onSubmit = async (data: CompanyFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      if (editingId) {
        // Company Admin can only edit their own company (enforced above via canEdit)
        const { error } = await supabase.from('companies').update({
          name: data.name, email: data.email, phone: data.phone,
          industry: data.industry, city: data.city, country: data.country,
          founded_year: data.founded_year, address: data.address,
        }).eq('id', editingId);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Company updated successfully' });
      } else {
        // Only Super Admin can create
        if (!canCreate) {
          setMessage({ type: 'error', text: 'Only Super Admin can create companies' });
          return;
        }
        const { error } = await supabase.from('companies').insert({
          name: data.name, email: data.email, phone: data.phone,
          industry: data.industry, city: data.city, country: data.country,
          founded_year: data.founded_year, address: data.address,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Company added successfully' });
      }

      reset();
      setEditingId(null);
      setShowModal(false);
      fetchCompanies();
      schedule(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: (err as any)?.message || 'Failed to save company' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (company: any) => {
    if (!canEdit) return;
    reset({
      name: company.name, email: company.email, phone: company.phone,
      industry: company.industry, city: company.city, country: company.country,
      founded_year: company.founded_year, address: company.address,
    });
    setEditingId(company.id);
    setLogoPreview(companyBranding(company.name).logo);
    setShowModal(true);
  };

  const handleCloseModal = () => { setShowModal(false); setEditingId(null); reset(); setMessage(null); setLogoPreview(null); };

  const deleteCompany = async (id: string) => {
    if (!canDelete) return;
    if (!confirm('Are you sure you want to delete this company? This cannot be undone.')) return;
    try {
      setDeleteLoading(id);
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Company deleted successfully' });
      fetchCompanies();
      schedule(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete company' });
    } finally {
      setDeleteLoading(null);
    }
  };

  const columns = [
    { key: 'name', label: 'Company Name' },
    { key: 'industry', label: 'Industry' },
    { key: 'city', label: 'Location', render: (v: string, row: any) => `${v}, ${row.country}` },
    { key: 'employee_count', label: 'Employees' },
    { key: 'founded_year', label: 'Founded' },
    // Actions column — only shown if user can edit or delete
    ...(canEdit || canDelete ? [{
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => handleEdit(row)}
              className="p-1 hover:bg-muted rounded transition"
              title="Edit company"
            >
              <Edit size={18} className="text-muted-foreground" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => deleteCompany(row.id)}
              disabled={deleteLoading === row.id}
              className="p-1 hover:bg-muted rounded transition disabled:opacity-50"
              title="Delete company"
            >
              <Trash2 size={18} className="text-destructive" />
            </button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Companies</h1>
            <p className="text-muted-foreground mt-1">
              {isSuperAdmin
                ? 'Manage all companies under GulfZone Group'
                : 'View your assigned company details'}
            </p>
          </div>
          {canCreate && (
            <Button variant="primary" onClick={() => { reset(); setEditingId(null); setLogoPreview(null); setShowModal(true); }} className="gap-2">
              <Plus size={20} />
              Add Company
            </Button>
          )}
          {!canCreate && isCompanyAdmin && (
            <div className="flex items-center gap-2 text-sm text-secondary-foreground bg-secondary px-4 py-2 rounded-lg">
              <Lock size={16} />
              View &amp; edit your company only
            </div>
          )}
        </div>

        {/* Global message */}
        {message && !showModal && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
            {message.text}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* Company Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {companies.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No companies found.
                </div>
              ) : (
                companies.map(company => (
                  <Card key={company.id} className="hover:shadow-lg transition">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{company.name}</h3>
                        <p className="text-sm text-muted-foreground">{company.industry}</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-foreground">
                          <MapPin size={16} className="text-primary" />
                          <span>{company.city}, {company.country}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground">
                          <Phone size={16} className="text-primary" />
                          <span>{company.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground">
                          <Mail size={16} className="text-primary" />
                          <span className="truncate">{company.email}</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-border flex justify-between text-sm">
                        <span className="text-muted-foreground">Employees</span>
                        <span className="font-semibold text-foreground">{company.employee_count ?? '—'}</span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Table */}
            <Card header={<h2 className="text-lg font-semibold">{isSuperAdmin ? 'All Companies' : 'Company Details'}</h2>} noPadding>
              {companies.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No companies found</div>
              ) : (
                <Table columns={columns} data={companies} />
              )}
            </Card>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingId ? 'Edit Company' : 'Add New Company'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? (editingId ? 'Updating…' : 'Adding…') : (editingId ? 'Update Company' : 'Add Company')}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          {message && (
            <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
              {message.text}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Company Name</label>
            <input {...register('name')} type="text" placeholder="Enter company name" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input {...register('email')} type="email" placeholder="Enter company email" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
            <input {...register('phone')} type="tel" placeholder="Enter phone number" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Industry</label>
            <input {...register('industry')} type="text" placeholder="Enter industry" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.industry && <p className="mt-1 text-sm text-destructive">{errors.industry.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">City</label>
              <input {...register('city')} type="text" placeholder="City" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.city && <p className="mt-1 text-sm text-destructive">{errors.city.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Country</label>
              <input {...register('country')} type="text" placeholder="Country" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.country && <p className="mt-1 text-sm text-destructive">{errors.country.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Founded Year</label>
              <input {...register('founded_year', { valueAsNumber: true })} type="number" placeholder="Year" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.founded_year && <p className="mt-1 text-sm text-destructive">{errors.founded_year.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Address</label>
            <input {...register('address')} type="text" placeholder="Enter full address" className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.address && <p className="mt-1 text-sm text-destructive">{errors.address.message}</p>}
          </div>

          {/* Company logo — uploaded, compressed to 512×512 PNG, path saved to config */}
          <div className="pt-2 border-t border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              Company Logo <span className="font-normal text-muted-foreground">(auto-compressed to 512×512)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Company logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div>
                <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={logoUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }}
                  className="block text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent file:text-primary hover:file:bg-accent file:cursor-pointer disabled:opacity-50" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {logoUploading ? 'Uploading & compressing…' : 'PNG, JPG, WebP or SVG. Shown in the header, sidebar and payslips.'}
                </p>
              </div>
            </div>
          </div>

        </form>
      </Modal>
    </Layout>
  );
};

export default CompaniesPage;
