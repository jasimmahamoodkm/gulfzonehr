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
    setTimeout(() => setNotification(null), 3000);
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
      console.log('📊 Loading RBAC data');
      console.log('👤 Current user:', user?.id);
      console.log('🏢 User company_id:', user?.company_id);
      console.log('👑 User roles:', user?.roles?.map(r => r.role_name));

      // Load ALL roles (for create user form we need all roles)
      console.log('📝 Fetching all roles...');
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (rolesError) {
        console.error('❌ Error loading roles:', rolesError);
        throw rolesError;
      }
      console.log('✅ All roles loaded:', rolesData?.length, 'roles');
      console.log('📋 Roles data:', rolesData);
      setRoles(rolesData || []);

      // Load users separately
      console.log('📝 Fetching users...');
      console.log('🔍 Current user is Super Admin?', user?.roles?.some(r => r.role_name === 'Super Admin'));

      // For super admins, load all users; for others, filter by company
      let usersQuery = supabase
        .from('users')
        .select('id, email, first_name, last_name, company_id')
        .order('first_name');

      // Only filter by company if user has a company_id (i.e., not a Super Admin or Super Admin with company)
      if (user?.company_id && user?.roles?.some(r => r.role_name !== 'Super Admin')) {
        console.log('🔒 Filtering users by company:', user.company_id);
        usersQuery = usersQuery.eq('company_id', user.company_id);
      } else if (user?.company_id) {
        console.log('🔒 Super Admin filtering by company:', user.company_id);
        usersQuery = usersQuery.eq('company_id', user.company_id);
      }

      const { data: usersData, error: usersError } = await usersQuery;

      if (usersError) {
        console.error('❌ Error loading users:', usersError);
        console.error('📋 Error details:', usersError.message);
        // Don't throw - continue even if there's an RLS error
      }
      console.log('✅ Users loaded:', usersData?.length, 'users');
      console.log('📋 Users data:', usersData);

      // Load all user_roles relationships
      console.log('📝 Fetching user_roles relationships...');
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, role_id, id');

      if (userRolesError) {
        console.error('❌ Error loading user_roles:', userRolesError);
        // Don't throw, continue without user_roles data
      } else {
        console.log('✅ User_roles loaded:', userRolesData?.length, 'assignments');
      }

      // Merge user_roles into users
      const usersWithRoles = (usersData || []).map(u => ({
        ...u,
        user_roles: (userRolesData || []).filter(ur => ur.user_id === u.id),
      }));

      console.log('📋 Users with merged roles:', usersWithRoles);
      setUsers(usersWithRoles);

      // Load companies
      console.log('📝 Fetching companies...');
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (companiesError) {
        console.error('❌ Error loading companies:', companiesError);
      } else {
        console.log('✅ Companies loaded:', companiesData?.length, 'companies');
        setCompanies(companiesData || []);
      }

      // Load modules
      console.log('📝 Fetching modules...');
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('order_index');

      if (modulesError) {
        console.error('❌ Error loading modules:', modulesError);
      } else {
        console.log('✅ Modules loaded:', modulesData?.length, 'modules');
        setModules(modulesData || []);
      }

      // Load role_modules mappings
      console.log('📝 Fetching role_modules...');
      const { data: roleModulesData, error: roleModulesError } = await supabase
        .from('role_modules')
        .select('role_id, module_id');

      if (roleModulesError) {
        console.error('❌ Error loading role_modules:', roleModulesError);
      } else {
        console.log('✅ Role_modules loaded:', roleModulesData?.length, 'mappings');
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
      console.error('❌ Error loading data:', err);
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
        console.log('🗑️ Removing module:', moduleId, 'from role:', roleId);
        const { error } = await supabase
          .from('role_modules')
          .delete()
          .eq('role_id', roleId)
          .eq('module_id', moduleId);

        if (error) {
          console.error('❌ Error removing module:', error);
          throw error;
        }
        console.log('✅ Module removed');
        const updatedModules = currentModules.filter(m => m !== moduleId);
        setRoleModules(new Map(roleModules).set(roleId, updatedModules));
        showNotification(`Removed ${moduleName} from role`, 'success');
      } else {
        // Add module to role
        console.log('➕ Adding module:', moduleId, 'to role:', roleId);
        const { error } = await supabase
          .from('role_modules')
          .insert({
            role_id: roleId,
            module_id: moduleId,
          });

        if (error) {
          console.error('❌ Error adding module:', error);
          throw error;
        }
        console.log('✅ Module added');
        const updatedModules = [...currentModules, moduleId];
        setRoleModules(new Map(roleModules).set(roleId, updatedModules));
        showNotification(`Added ${moduleName} to role`, 'success');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error updating module:', err);
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
        console.log('🗑️ Removing role:', roleId, 'from user:', userId);
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', roleId);

        if (error) {
          console.error('❌ Error removing role:', error);
          throw error;
        }
        console.log('✅ Role removed');
        setSelectedUserRoles(selectedUserRoles.filter(r => r !== roleId));
        showNotification(`Removed ${roleName} from user`, 'success');
      } else {
        // Assign role
        console.log('➕ Assigning role:', roleId, 'to user:', userId);
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: roleId,
            company_id: user?.company_id,
          });

        if (error) {
          console.error('❌ Error assigning role:', error);
          throw error;
        }
        console.log('✅ Role assigned');
        setSelectedUserRoles([...selectedUserRoles, roleId]);
        showNotification(`Assigned ${roleName} to user`, 'success');
      }

      loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error updating role:', err);
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
      console.log('🗑️ Deleting user:', userId);

      // Delete user roles first (due to foreign key constraint)
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) {
        console.error('❌ Error deleting user roles:', rolesError);
        throw rolesError;
      }
      console.log('✅ User roles deleted');

      // Delete user profile
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('❌ Error deleting user profile:', profileError);
        throw profileError;
      }
      console.log('✅ User profile deleted');

      // Note: Cannot delete from auth.users via client SDK for security reasons
      alert('User deleted from the system. Note: Auth account must be deleted by administrators via Supabase dashboard.');

      setSelectedUser(null);
      setSelectedUserRoles([]);
      loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete user';
      console.error('❌ Error deleting user:', errorMsg);
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

      console.log('👤 Creating new user:', newUser.email);

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

      console.log('✅ Auth user created:', authData.user.id);

      // Create user profile in database
      console.log('📝 Creating user profile in database...');
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          company_id: newUser.company_id,
          role: 'Employee',
        })
        .select();

      if (profileError) {
        console.error('❌ Error creating user profile:', profileError);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }
      console.log('✅ User profile created:', profileData);

      // Assign roles
      console.log('📝 Assigning roles...');
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
          console.error('❌ Error assigning role:', roleId, roleError);
          throw new Error(`Failed to assign role: ${roleError.message}`);
        }
        console.log('✅ Role assigned:', roleId);
      }
      console.log('✅ All roles assigned');

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
      setTimeout(() => {
        loadData();
      }, 1000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create user';
      console.error('❌ Error creating user:', errorMsg);
      setCreateUserMessage(`❌ Error: ${errorMsg}`);
    } finally {
      setCreatingUser(false);
    }
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
          <button
            onClick={() => setActiveTab('create-user')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'create-user'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
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
                  <h3 className="font-semibold text-gray-900 mb-4">Roles</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                          selectedRole === role.id
                            ? 'bg-blue-100 text-blue-900'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium text-sm">{role.name}</div>
                        {role.is_system && (
                          <div className="text-xs text-gray-600 mt-1">System Role</div>
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
                          <h3 className="font-semibold text-gray-900 mb-4">
                            {role?.name} - Module Access
                          </h3>
                          <p className="text-sm text-gray-600 mb-6">
                            Select the modules this role can access:
                          </p>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {modules.map((module) => {
                              const selectedModules = roleModules.get(selectedRole) || [];
                              const isSelected = selectedModules.includes(module.id);

                              return (
                                <label
                                  key={module.id}
                                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      handleToggleModuleForRole(selectedRole, module.id)
                                    }
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <div className="ml-3 flex-1">
                                    <div className="font-medium text-gray-900">
                                      {module.name}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {module.description}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500 ml-2">
                                    {module.path}
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          {/* Role Details Card */}
                          <Card className="p-4 bg-gray-50 mt-6">
                            <h4 className="font-semibold text-gray-900 mb-2">Role Details</h4>
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Description:</span> {role?.description || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-700 mt-2">
                              <span className="font-medium">Modules Assigned:</span> {(roleModules.get(selectedRole) || []).length} / {modules.length}
                            </p>
                          </Card>
                        </Card>
                      );
                    })()}
                  </>
                ) : (
                  <Card className="p-6 text-center">
                    <p className="text-gray-500">
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
                      <h3 className="font-semibold text-gray-900">
                        Assign Roles
                      </h3>
                      <button
                        onClick={() => handleDeleteUser(selectedUser)}
                        disabled={isSelectedUserSuperAdmin}
                        className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                          isSelectedUserSuperAdmin
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        🗑️ Delete User
                      </button>
                    </div>
                    <div className="space-y-3">
                      {roles.map((role) => (
                        <label
                          key={role.id}
                          className={`flex items-center p-3 border border-gray-200 rounded-lg transition-colors ${
                            isSelectedUserSuperAdmin
                              ? 'bg-gray-50 cursor-not-allowed'
                              : 'hover:bg-gray-50 cursor-pointer'
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
                                : 'text-blue-600 cursor-pointer'
                            }`}
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

                  {/* User Info Card */}
                  <Card className="p-4 bg-blue-50">
                    <h4 className="font-semibold text-gray-900 mb-2">User Details</h4>
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
                  <p className="text-gray-500">
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
              <h2 className="text-xl font-bold text-gray-900 mb-6">Create New User</h2>

              {createUserMessage && (
                <div
                  className={`mb-4 p-4 rounded-lg ${
                    createUserMessage.startsWith('✅')
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  {createUserMessage}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company *
                  </label>
                  <select
                    value={newUser.company_id}
                    onChange={(e) =>
                      setNewUser({ ...newUser, company_id: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Roles * (Select at least one)
                  </label>
                  <div className="space-y-2 border border-gray-200 rounded-lg p-4">
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
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="ml-3">
                          <div className="font-medium text-gray-900 text-sm">
                            {role.name}
                          </div>
                          <div className="text-xs text-gray-600">
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
                ? 'bg-red-600'
                : 'bg-blue-600'
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>
    </Layout>
  );
}
