'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { EmployeeGrade } from '@/types/index';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Users,
  ChevronRight,
  Award,
  TrendingUp,
} from 'lucide-react';

interface GradeFormData {
  name: string;
  level: string;
  description: string;
}

const EMPTY_FORM: GradeFormData = { name: '', level: '', description: '' };

export default function GradesPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState<EmployeeGrade | null>(null);
  const [formData, setFormData] = useState<GradeFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EmployeeGrade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/admin/grades', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch grades');
      setGrades(json.data || []);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to load grades', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchGrades();
  }, [user, fetchGrades]);

  const openAddModal = () => {
    setEditingGrade(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (grade: EmployeeGrade) => {
    setEditingGrade(grade);
    setFormData({
      name: grade.name,
      level: String(grade.level),
      description: grade.description || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingGrade(null);
    setFormData(EMPTY_FORM);
    setFormError('');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { setFormError('Grade name is required'); return; }
    if (!formData.level || isNaN(Number(formData.level))) { setFormError('Level must be a valid number'); return; }

    setSaving(true);
    setFormError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const url = editingGrade ? `/api/admin/grades/${editingGrade.id}` : '/api/admin/grades';
      const method = editingGrade ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          level: Number(formData.level),
          description: formData.description.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save grade');

      showNotification(editingGrade ? 'Grade updated successfully' : 'Grade created successfully');
      closeModal();
      fetchGrades();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/grades/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete grade');

      showNotification('Grade deleted successfully');
      setDeleteConfirm(null);
      fetchGrades();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to delete grade', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <GraduationCap className="text-blue-600" size={28} />
              Grade Configuration
            </h1>
            <p className="text-gray-500 mt-1">Manage employee grades, salary bands, leave entitlements and benefits</p>
          </div>
          <Button onClick={openAddModal} variant="primary">
            <Plus size={18} />
            Add Grade
          </Button>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`px-4 py-3 rounded-lg text-sm font-medium ${
              notification.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Award className="text-blue-600" size={22} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Grades</p>
                <p className="text-2xl font-bold text-gray-900">{grades.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <Users className="text-green-600" size={22} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Active Grades</p>
                <p className="text-2xl font-bold text-gray-900">{grades.filter(g => g.active).length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <TrendingUp className="text-purple-600" size={22} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Employees Graded</p>
                <p className="text-2xl font-bold text-gray-900">
                  {grades.reduce((sum, g) => sum + (g.employee_count ?? 0), 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Grades Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-4/5 mb-6" />
                <div className="flex gap-2">
                  <div className="h-8 bg-gray-200 rounded w-20" />
                  <div className="h-8 bg-gray-200 rounded w-24" />
                  <div className="h-8 bg-gray-200 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : grades.length === 0 ? (
          <Card>
            <div className="text-center py-16">
              <GraduationCap size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No grades configured yet</h3>
              <p className="text-gray-500 mb-6">Create your first employee grade to get started.</p>
              <Button onClick={openAddModal} variant="primary">
                <Plus size={18} />
                Add First Grade
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grades.map(grade => (
              <div
                key={grade.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col gap-4"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{grade.name}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex-shrink-0">
                        Level {grade.level}
                      </span>
                      {!grade.active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 flex-shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    {grade.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{grade.description}</p>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500 mb-0.5">Employees</p>
                    <p className="text-base font-semibold text-gray-800 flex items-center gap-1">
                      <Users size={14} className="text-gray-400" />
                      {grade.employee_count ?? 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500 mb-0.5">Salary</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {grade.salary ? (
                        <span>{grade.currency || 'AED'} {Number(grade.salary).toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400 font-normal">Not set</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(grade)}
                    className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors px-2 py-1.5 rounded hover:bg-blue-50"
                  >
                    <Edit2 size={15} />
                    Edit
                  </button>
                  <Link
                    href={`/admin/grades/${grade.id}`}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors px-2 py-1.5 rounded hover:bg-blue-50"
                  >
                    <GraduationCap size={15} />
                    Configure
                    <ChevronRight size={14} />
                  </Link>
                  <button
                    onClick={() => setDeleteConfirm(grade)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded hover:bg-red-50 ml-auto"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Grade Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingGrade ? 'Edit Grade' : 'Add New Grade'}
              </h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Grade A, Senior Manager"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Level <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.level}
                  onChange={e => setFormData(f => ({ ...f, level: e.target.value }))}
                  placeholder="e.g. 1 (lowest) to 10 (highest)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Lower number = junior, higher = senior</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description of this grade level"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingGrade ? 'Update Grade' : 'Create Grade'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-full bg-red-100">
                  <Trash2 size={20} className="text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Delete Grade</h2>
              </div>
              <p className="text-gray-600 text-sm">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-800">{deleteConfirm.name}</span>?
                This will also remove all associated leave configs, salary bands, and benefits.
              </p>
              {(deleteConfirm.employee_count ?? 0) > 0 && (
                <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Warning: {deleteConfirm.employee_count} employee(s) are assigned to this grade. Their grade assignment will be cleared.
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Grade'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
