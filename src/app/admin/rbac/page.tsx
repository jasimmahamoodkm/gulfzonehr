'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/api';
import { Role } from '@/types/rbac';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useTimeouts } from '@/hooks/useTimeouts';

export default function RBACManagementPage() {
  const { user } = useAuth();
  const schedule = useTimeouts();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [roleModules, setRoleModules] = useState<Map<string, string[]>>(new Map());
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'create-user'>('roles');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);

  // New user form state
  const [_showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    company_id: '',
    role_ids: [] as string[],
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMessage, setCreateUserMessage] = useState('');

  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Show notification and auto-hide after 3 seconds
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    schedule(() => setNotification(null), 3000);
  };

  // Check if selected user is SuperAdmin
  const selectedUserData = users.find(u => u.id === selectedUser);
  const isSelectedUserSuperAdmin = selectedUserData?.user_roles?.some(
    (ur: any) => roles.find(r => r.id === ur.role_id)?.name === 'Super Admin'
  );

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {

      // Load ALL roles (for create user form we need all roles)
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (rolesError) {
        console.error('Error loading roles:', rolesError);
        throw rolesError;
      }
      setRoles(rolesData || []);

      // Load users separately

      // For super admins, load all users; for others, filter by company
      let usersQuery = supabase
        .from('users')
        .select('id, email, first_name, last_name, company_id')
        .order('first_name');

      // Scope users to the admin's company (Super Admins without a company see all)
      if (user?.company_id) {
        usersQuery = usersQuery.eq('company_id', user.company_id);
      }

      const { data: usersData, error: usersError } = await usersQuery;

      if (usersError) {
        console.error('Error loading users:', usersError);
        console.error('Error details:', usersError.message);
        // Don't throw - continue even if there's an RLS error
      }

      // Load all user_roles relationships
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, role_id, id');

      if (userRolesError) {
        console.error('Error loading user_roles:', userRolesError);
        // Don't throw, continue without user_roles data
      }

      // Merge user_roles into users
      const usersWithRoles = (usersData || []).map(u => ({
        ...u,
        user_roles: (userRolesData || []).filter(ur => ur.user_id === u.id),
      }));

      setUsers(usersWithRoles);

      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (companiesError) {
        console.error('Error loading companies:', companiesError);
      } else {
        setCompanies(companiesData || []);
      }

      // Load modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('order_index');

      if (modulesError) {
        console.error('Error loading modules:', modulesError);
      } else {
        setModules(modulesData || []);
      }

      // Load role_modules mappings
      const { data: roleModulesData, error: roleModulesError } = await supabase
        .from('role_modules')
        .select('role_id, module_id');

      if (roleModulesError) {
        console.error('Error loading role_modules:', roleModulesError);
      } else {
        // Create a map of role_id -> [module_ids]
        const roleModulesMap = new Map<string, string[]>();
        (roleModulesData || []).forEach(rm => {
          if (!roleModulesMap.has(rm.role_id)) {
            roleModulesMap.set(rm.role_id, []);
          }
          roleModulesMap.get(rm.role_id)!.push(rm.module_id);
        });
        setRoleModules(roleModulesMap);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  // handleCreateRole: reserved for future role creation form

  const handleToggleModuleForRole = async (roleId: string, moduleId: string) => {
    try {
      const currentModules = roleModules.get(roleId) || [];
      const isAssigned = currentModules.includes(moduleId);
      const moduleName = modules.find(m => m.id === moduleId)?.name || 'Unknown Module';

      if (isAssigned) {
        // Remove module from role
        const { error } = await supabase
          .from('role_modules')
          .delete()
          .eq('role_id', roleId)
          .eq('module_id', moduleId);

        if (error) {
          console.error('Error removing module:', error);
          throw error;
        }
        const updatedModules = currentModules.filter(m => m !== moduleId);
        setRoleModules(new Map(roleModules).set(roleId, updatedModules));
        showNotification(`Removed ${moduleName} from role`, 'success');
        const roleNameRm = roles.find(r => r.id === roleId)?.name || roleId;
        await logActivity(supabase, {
          company_id: user?.company_id ?? null,
          action: 'remove_role_module',
          resource_type: 'role_modules',
          resource_id: roleId,
          resource_name: `Module "${moduleName}" removed from role "${roleNameRm}"`,
        });
      } else {
        // Add module to role
        const { error } = await supabase
          .from('role_modules')
          .insert({
            role_id: roleId,
            module_id: moduleId,
          });

        if (error) {
          console.error('Error adding module:', error);
          throw error;
        }
        const updatedModules = [...currentModules, moduleId];
        setRoleModules(new Map(roleModules).set(roleId, updatedModules));
        showNotification(`Added ${moduleName} to role`, 'success');
        const roleNameAdd = roles.find(r => r.id === roleId)?.name || roleId;
        await logActivity(supabase, {
          company_id: user?.company_id ?? null,
          action: 'add_role_module',
          resource_type: 'role_modules',
          resource_id: roleId,
          resource_name: `Module "${moduleName}" added to role "${roleNameAdd}"`,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error updating module:', err);
      showNotification(`Failed to update module: ${errorMsg}`, 'error');
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      // Check if role is already assigned
      const isAssigned = selectedUserRoles.includes(roleId);
      const roleName = roles.find(r => r.id === roleId)?.name || 'Unknown Role';

      if (isAssigned) {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', roleId);

        if (error) {
          console.error('Error removing role:', error);
          throw error;
        }
        setSelectedUserRoles(selectedUserRoles.filter(r => r !== roleId));
        showNotification(`Removed ${roleName} from user`, 'success');
        await logActivity(supabase, {
          company_id: user?.company_id ?? null,
          action: 'remove_role',
          resource_type: 'user_roles',
          resource_id: userId,
          resource_name: `Role "${roleName}" removed from user`,
        });
      } else {
        // Assign role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: roleId,
            company_id: user?.company_id,
          });

        if (error) {
          console.error('Error assigning role:', error);
          throw error;
        }
        setSelectedUserRoles([...selectedUserRoles, roleId]);
        showNotification(`Assigned ${roleName} to user`, 'success');
        await logActivity(supabase, {
          company_id: user?.company_id ?? null,
          action: 'assign_role',
          resource_type: 'user_roles',
          resource_id: userId,
          resource_name: `Role "${roleName}" assigned to user`,
        });
      }

      loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error updating role:', err);
      showNotification(`Failed to update role: ${errorMsg}`, 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Prevent SuperAdmin deletion
    if (isSelectedUserSuperAdmin) {
      showNotification('Cannot delete SuperAdmin users. Please reassign all roles first.', 'error');
      return;
    }

    const selectedUserData = users.find(u => u.id === userId);
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedUserData?.first_name} ${selectedUserData?.last_name}? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {

      // Delete user roles first (due to foreign key constraint)
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error deleting user roles:', rolesError);
        throw rolesError;
      }

      // Delete user profile
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        throw profileError;
      }

      // Note: Cannot delete from auth.users via client SDK for security reasons
      alert('User deleted from the system. Note: Auth account must be deleted by administrators via Supabase dashboard.');

      setSelectedUser(null);
      setSelectedUserRoles([]);
      loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete user';
      console.error('Error deleting user:', errorMsg);
      alert(`Failed to delete user: ${errorMsg}`);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId);
    const userRoles = users.find(u => u.id === userId)?.user_roles || [];
    setSelectedUserRoles(userRoles.map((r: any) => r.role_id));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setCreateUserMessage('');

    try {
      // Validate inputs
      if (!newUser.first_name || !newUser.last_name || !newUser.email || !newUser.password) {
        throw new Error('All fields are required');
      }

      if (!newUser.company_id) {
        throw new Error('Please select a company');
      }

      if (newUser.role_ids.length === 0) {
        throw new Error('Please select at least one role');
      }


      // Create user in Supabase Auth
      // Note: This requires signups to be enabled OR use admin API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (authError) {
        // If signups are disabled, provide helpful message
        if (authError.message.includes('not allowed')) {
          throw new Error('Signups are disabled. Please enable them in Supabase Authentication → Providers → Email settings, or contact your administrator.');
        }
        throw authError;
      }
      if (!authData.user) throw new Error('Failed to create auth user');


      // Create user profile in database
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          company_id: newUser.company_id,
          role: 'Employee',
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      // Assign roles
      for (const roleId of newUser.role_ids) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role_id: roleId,
            company_id: newUser.company_id,
            assigned_by: user?.id,
          });

        if (roleError) {
          console.error('Error assigning role:', roleId, roleError);
          throw new Error(`Failed to assign role: ${roleError.message}`);
        }
      }

      setCreateUserMessage('✅ User created successfully!');
      setNewUser({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        company_id: '',
        role_ids: [],
      });
      setShowCreateUserForm(false);

      // Reload data
      schedule(() => {
        loadData();
      }, 1000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create user';
      console.error('Error creating user:', errorMsg);
      setCreateUserMessage(`❌ Error: ${errorMsg}`);
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">RBAC Management</h1>
          <p className="text-muted-foreground mt-2">Manage roles and permissions</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-border">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            User Assignments
          </button>
          <button
            onClick={() => setActiveTab('create-user')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'create-user'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            + Create User
          </button>
        </div>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Roles List */}
              <div className="lg:col-span-1">
                <Card className="p-4">
                  <h3 className="font-semibold text-foreground mb-4">Roles</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                          selectedRole === role.id
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="font-medium text-sm">{role.name}</div>
                        {role.is_system && (
                          <div className="text-xs text-muted-foreground mt-1">System Role</div>
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Modules Selection */}
              <div className="lg:col-span-2">
                {selectedRole ? (
                  <>
                    {(() => {
                      const role = roles.find(r => r.id === selectedRole);
                      return (
                        <Card className="p-6">
                          <h3 className="font-semibold text-foreground mb-4">
                            {role?.name} - Module Access
                          </h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Select the modules this role can access:
                          </p>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {modules.map((module) => {
                              const selectedModules = roleModules.get(selectedRole) || [];
                              const isSelected = selectedModules.includes(module.id);

                              return (
                                <label
                                  key={module.id}
                                  className="flex items-center p-4 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      handleToggleModuleForRole(selectedRole, module.id)
                                    }
                                    className="w-4 h-4 text-primary rounded"
                                  />
                                  <div className="ml-3 flex-1">
                                    <div className="font-medium text-foreground">
                                      {module.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {module.description}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground ml-2">
                                    {module.path}
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          {/* Role Details Card */}
                          <Card className="p-4 bg-muted mt-6">
                            <h4 className="font-semibold text-foreground mb-2">Role Details</h4>
                            <p className="text-sm text-foreground">
                              <span className="font-medium">Description:</span> {role?.description || 'N/A'}
                            </p>
                            <p className="text-sm text-foreground mt-2">
                              <span className="font-medium">Modules Assigned:</span> {(roleModules.get(selectedRole) || []).length} / {modules.length}
                            </p>
                          </Card>
                        </Card>
                      );
                    })()}
                  </>
                ) : (
                  <Card className="p-6 text-center">
                    <p className="text-muted-foreground">
                      Select a role to manage its module access
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User Assignments Tab */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Users List */}
            <div className="lg:col-span-1">
              <Card className="p-4">
                <h3 className="font-semibold text-foreground mb-4">Users</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedUser === u.id
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {u.first_name} {u.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {/* Role Assignments and Actions */}
            <div className="lg:col-span-2">
              {selectedUser ? (
                <>
                  {/* SuperAdmin Protection Warning */}
                  {isSelectedUserSuperAdmin && (
                    <Card className="p-4 mb-4 bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">⚠️</div>
                        <div>
                          <h4 className="font-semibold text-amber-900">SuperAdmin User</h4>
                          <p className="text-sm text-amber-800 mt-1">
                            SuperAdmin users cannot be deleted or have their roles modified through the UI.
                            If needed, please contact system administrator.
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}

                  <Card className="p-6 mb-4">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-semibold text-foreground">
                        Assign Roles
                      </h3>
                      <button
                        onClick={() => handleDeleteUser(selectedUser)}
                        disabled={isSelectedUserSuperAdmin}
                        className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                          isSelectedUserSuperAdmin
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-destructive/15 text-destructive hover:bg-red-200'
                        }`}
                      >
                        🗑️ Delete User
                      </button>
                    </div>
                    <div className="space-y-3">
                      {roles.map((role) => (
                        <label
                          key={role.id}
                          className={`flex items-center p-3 border border-border rounded-lg transition-colors ${
                            isSelectedUserSuperAdmin
                              ? 'bg-muted cursor-not-allowed'
                              : 'hover:bg-muted cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserRoles.includes(role.id)}
                            onChange={() =>
                              handleAssignRole(selectedUser, role.id)
                            }
                            disabled={isSelectedUserSuperAdmin}
                            className={`w-4 h-4 rounded ${
                              isSelectedUserSuperAdmin
                                ? 'cursor-not-allowed opacity-50'
                                : 'text-primary cursor-pointer'
                            }`}
                          />
                          <div className="ml-3">
                            <div className="font-medium text-foreground">
                              {role.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {role.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </Card>

                  {/* User Info Card */}
                  <Card className="p-4 bg-accent">
                    <h4 className="font-semibold text-foreground mb-2">User Details</h4>
                    {users
                      .filter(u => u.id === selectedUser)
                      .map(u => (
                        <div key={u.id} className="space-y-1 text-sm">
                          <p><span className="font-medium">Name:</span> {u.first_name} {u.last_name}</p>
                          <p><span className="font-medium">Email:</span> {u.email}</p>
                          <p><span className="font-medium">Company:</span> {companies.find(c => c.id === u.company_id)?.name || 'N/A'}</p>
                          <p><span className="font-medium">Roles:</span> {selectedUserRoles.length > 0 ? roles.filter(r => selectedUserRoles.includes(r.id)).map(r => r.name).join(', ') : 'No roles assigned'}</p>
                        </div>
                      ))}
                  </Card>
                </>
              ) : (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Select a user to assign roles or delete
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Create User Tab */}
        {activeTab === 'create-user' && (
          <div>
            <Card className="p-6 max-w-2xl">
              <h2 className="text-xl font-bold text-foreground mb-6">Create New User</h2>

              {createUserMessage && (
                <div
                  className={`mb-4 p-4 rounded-lg ${
                    createUserMessage.startsWith('✅')
                      ? 'bg-green-50 text-green-800'
                      : 'bg-destructive/10 text-red-800'
                  }`}
                >
                  {createUserMessage}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    First Name *
                  </label>
                  <Input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, first_name: e.target.value })
                    }
                    placeholder="e.g., John"
                    required
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Last Name *
                  </label>
                  <Input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, last_name: e.target.value })
                    }
                    placeholder="e.g., Doe"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="e.g., john.doe@example.com"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password *
                  </label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Company *
                  </label>
                  <select
                    value={newUser.company_id}
                    onChange={(e) =>
                      setNewUser({ ...newUser, company_id: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Roles */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Assign Roles * (Select at least one)
                  </label>
                  <div className="space-y-2 border border-border rounded-lg p-4">
                    {roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newUser.role_ids.includes(role.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUser({
                                ...newUser,
                                role_ids: [...newUser.role_ids, role.id],
                              });
                            } else {
                              setNewUser({
                                ...newUser,
                                role_ids: newUser.role_ids.filter(
                                  (r) => r !== role.id
                                ),
                              });
                            }
                          }}
                          className="w-4 h-4 text-primary rounded"
                        />
                        <div className="ml-3">
                          <div className="font-medium text-foreground text-sm">
                            {role.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {role.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={creatingUser}
                  >
                    {creatingUser ? 'Creating...' : 'Create User'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateUserForm(false);
                      setNewUser({
                        first_name: '',
                        last_name: '',
                        email: '',
                        password: '',
                        company_id: '',
                        role_ids: [],
                      });
                      setCreateUserMessage('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Notification Snackbar */}
        {notification && (
          <div
            className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium animate-in fade-in slide-in-from-bottom-4 ${
              notification.type === 'success'
                ? 'bg-green-600'
                : notification.type === 'error'
                ? 'bg-destructive'
                : 'bg-primary'
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>
    </Layout>
  );
}
