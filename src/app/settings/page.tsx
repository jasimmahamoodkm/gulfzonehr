'use client';

import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { Lock, Bell, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const tabs = [
    { id: 'profile', label: 'Profile Settings', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const { updatePassword } = useAuth();

  const onPasswordSubmit = async (data: PasswordFormData) => {
    try {
      setIsUpdatingPassword(true);
      setPasswordMessage(null);

      await updatePassword(data.currentPassword, data.newPassword);

      setPasswordMessage({
        type: 'success',
        message: 'Password updated successfully',
      });
      reset();
    } catch (error: any) {
      setPasswordMessage({
        type: 'error',
        message: error.message || 'Failed to update password. Please try again.',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Profile Settings */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <Card header={<h2 className="text-lg font-semibold">Personal Information</h2>}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="First Name" defaultValue={user?.first_name || ''} readOnly />
                  <Input label="Last Name" defaultValue={user?.last_name || ''} readOnly />
                </div>
                <Input label="Email Address" type="email" defaultValue={user?.email || ''} readOnly />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" disabled>
                    <option>{user?.role || 'User'}</option>
                  </select>
                </div>
                <p className="text-sm text-gray-600">Profile information is managed by administrators.</p>
              </div>
            </Card>

            <Card header={<h2 className="text-lg font-semibold">Organization Settings</h2>}>
              <div className="space-y-4">
                <Input label="Organization Name" defaultValue="GulfZone Group" readOnly />
                <Input label="Default Currency" defaultValue="AED (UAE Dirham)" readOnly />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Timezone</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled>
                    <option>Asia/Dubai (GST)</option>
                    <option>Asia/Riyadh (AST)</option>
                    <option>UTC</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Security Settings */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card header={<h2 className="text-lg font-semibold">Password</h2>}>
              <div className="space-y-4">
                {passwordMessage && (
                  <div className={`p-4 rounded-lg ${
                    passwordMessage.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {passwordMessage.message}
                  </div>
                )}
                <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                    <input
                      {...register('currentPassword')}
                      type="password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <input
                      {...register('newPassword')}
                      type="password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.newPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                    <input
                      {...register('confirmPassword')}
                      type="password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
                    >
                      {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => reset()}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </Card>

            <Card header={<h2 className="text-lg font-semibold">Two-Factor Authentication</h2>}>
              <div className="space-y-4">
                <p className="text-gray-600">Add an extra layer of security to your account.</p>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    Two-factor authentication is currently <span className="font-semibold">disabled</span>
                  </p>
                </div>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                  Enable 2FA
                </button>
              </div>
            </Card>

            <Card header={<h2 className="text-lg font-semibold">Active Sessions</h2>}>
              <div className="space-y-3">
                {[
                  { device: 'Current Session', location: 'Dubai, UAE', lastActive: 'now' },
                ].map((session, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{session.device}</p>
                      <p className="text-sm text-gray-600">{session.location} • {session.lastActive}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Notifications Settings */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {/* Check if user is Employee */}
            {user?.roles?.some(role => role.role_name === 'Employee') ? (
              <>
                <Card header={<h2 className="text-lg font-semibold">Email Notifications</h2>}>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 mb-4">You can receive notifications for the following alerts:</p>
                    {[
                      { name: 'Employee Alerts', description: 'New employee additions and changes' },
                      { name: 'Attendance Alerts', description: 'Late arrivals and absences' },
                    ].map((notif) => (
                      <label key={notif.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                        <input type="checkbox" className="mt-1 rounded" defaultChecked={false} />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{notif.name}</p>
                          <p className="text-sm text-gray-600 mt-0.5">{notif.description}</p>
                        </div>
                      </label>
                    ))}
                    <div className="flex gap-3 pt-4">
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                        Save Preferences
                      </button>
                      <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition">
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </Card>

                <Card header={<h2 className="text-lg font-semibold">SMS Notifications</h2>}>
                  <div className="space-y-4">
                    <p className="text-gray-600">Receive SMS alerts for critical notifications.</p>
                    <Input label="Mobile Number" placeholder="Enter your mobile number" />
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" defaultChecked={false} />
                      <span className="text-sm text-gray-700">Enable SMS notifications</span>
                    </label>
                    <div className="flex gap-3 pt-4">
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                        Update Settings
                      </button>
                      <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card header={<h2 className="text-lg font-semibold">Email Notifications</h2>}>
                  <div className="space-y-4">
                    {[
                      { name: 'Leave Requests', description: 'Get notified when leave requests are submitted' },
                      { name: 'Payroll Updates', description: 'Notifications about payroll processing and payments' },
                      { name: 'Employee Alerts', description: 'New employee additions and changes' },
                      { name: 'Attendance Alerts', description: 'Late arrivals and absences' },
                      { name: 'System Updates', description: 'Important system maintenance and updates' },
                    ].map((notif) => (
                      <label key={notif.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                        <input type="checkbox" className="mt-1 rounded" defaultChecked />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{notif.name}</p>
                          <p className="text-sm text-gray-600 mt-0.5">{notif.description}</p>
                        </div>
                      </label>
                    ))}
                    <div className="flex gap-3 pt-4">
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                        Save Preferences
                      </button>
                      <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition">
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </Card>

                <Card header={<h2 className="text-lg font-semibold">SMS Notifications</h2>}>
                  <div className="space-y-4">
                    <p className="text-gray-600">Receive SMS alerts for critical notifications.</p>
                    <Input label="Mobile Number" defaultValue="+971-50-123-4567" />
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm text-gray-700">Enable SMS notifications</span>
                    </label>
                    <div className="flex gap-3 pt-4">
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
                        Update Settings
                      </button>
                      <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SettingsPage;
