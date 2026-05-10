'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Role } from '@/types/rbac';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function RBACManagementPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Load roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .eq('company_id', user?.company_id || '')
        .order('name');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Load users with their roles
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          user_roles(id, role_id, roles(name))
        `)
        .eq('company_id', user?.company_id || '')
        .order('first_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('roles')
        .insert({
          name: newRole.name,
          description: newRole.description,
          company_id: user?.company_id,
          is_system: false,
        });

      if (error) throw error;

      setNewRole({ name: '', description: '' });
      setShowRoleForm(false);
      loadData();
    } catch (err) {
      console.error('Error creating role:', err);
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      // Check if role is already assigned
      const isAssigned = selectedUserRoles.includes(roleId);

      if (isAssigned) {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', roleId);

        if (error) throw error;
        setSelectedUserRoles(selectedUserRoles.filter(r => r !== roleId));
      } else {
        // Assign role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: roleId,
            company_id: user?.company_id,
          });

        if (error) throw error;
        setSelectedUserRoles([...selectedUserRoles, roleId]);
      }

      loadData();
    } catch (err) {
      console.error('Error assigning role:', err);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId);
    const userRoles = users.find(u => u.id === userId)?.user_roles || [];
    setSelectedUserRoles(userRoles.map((r: any) => r.role_id));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">RBAC Management</h1>
          <p className="text-gray-600 mt-2">Manage roles and permissions</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            User Assignments
          </button>
        </div>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <Button
              onClick={() => setShowRoleForm(!showRoleForm)}
              variant="primary"
            >
              {showRoleForm ? 'Cancel' : '+ Create Role'}
            </Button>

            {showRoleForm && (
              <Card className="p-6">
                <form onSubmit={handleCreateRole} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role Name *
                    </label>
                    <Input
                      type="text"
                      value={newRole.name}
                      onChange={(e) =>
                        setNewRole({ ...newRole, name: e.target.value })
                      }
                      placeholder="e.g., Financial Controller"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newRole.description}
                      onChange={(e) =>
                        setNewRole({ ...newRole, description: e.target.value })
                      }
                      placeholder="Role description"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button type="submit" variant="primary">
                      Create Role
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowRoleForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            <div className="grid gap-4">
              {roles.map((role) => (
                <Card key={role.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{role.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {role.description}
                      </p>
                      {role.is_system && (
                        <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          System Role
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* User Assignments Tab */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Users List */}
            <div className="lg:col-span-1">
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Users</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedUser === u.id
                          ? 'bg-blue-100 text-blue-900'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {u.first_name} {u.last_name}
                      </div>
                      <div className="text-xs text-gray-600">{u.email}</div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {/* Role Assignments */}
            <div className="lg:col-span-2">
              {selectedUser ? (
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Assign Roles
                  </h3>
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserRoles.includes(role.id)}
                          onChange={() =>
                            handleAssignRole(selectedUser, role.id)
                          }
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">
                            {role.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {role.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 text-center">
                  <p className="text-gray-500">
                    Select a user to assign roles
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
