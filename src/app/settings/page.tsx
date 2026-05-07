'use client';

import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Save, Lock, Bell, Shield } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile Settings', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

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
                  <Input label="First Name" defaultValue="Jasim" />
                  <Input label="Last Name" defaultValue="Mahmood" />
                </div>
                <Input label="Email Address" type="email" defaultValue="jasim@gulfzone.com" />
                <Input label="Phone Number" defaultValue="+971-50-123-4567" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                    <option>Administrator</option>
                    <option disabled>Manager</option>
                    <option disabled>Employee</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="primary" className="gap-2">
                    <Save size={20} />
                    Save Changes
                  </Button>
                  <Button variant="secondary">Cancel</Button>
                </div>
              </div>
            </Card>

            <Card header={<h2 className="text-lg font-semibold">Organization Settings</h2>}>
              <div className="space-y-4">
                <Input label="Organization Name" defaultValue="GulfZone Group" />
                <Input label="Default Currency" defaultValue="AED (UAE Dirham)" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Timezone</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Asia/Dubai (GST)</option>
                    <option>Asia/Riyadh (AST)</option>
                    <option>UTC</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="primary" className="gap-2">
                    <Save size={20} />
                    Save Changes
                  </Button>
                  <Button variant="secondary">Cancel</Button>
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
                <Input label="Current Password" type="password" />
                <Input label="New Password" type="password" />
                <Input label="Confirm Password" type="password" />
                <div className="flex gap-3 pt-4">
                  <Button variant="primary">Update Password</Button>
                  <Button variant="secondary">Cancel</Button>
                </div>
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
                <Button variant="primary">Enable 2FA</Button>
              </div>
            </Card>

            <Card header={<h2 className="text-lg font-semibold">Active Sessions</h2>}>
              <div className="space-y-3">
                {[
                  { device: 'MacBook Pro', location: 'Dubai, UAE', lastActive: '2 minutes ago' },
                  { device: 'iPhone 13', location: 'Dubai, UAE', lastActive: '1 hour ago' },
                ].map((session, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{session.device}</p>
                      <p className="text-sm text-gray-600">{session.location} • {session.lastActive}</p>
                    </div>
                    <Button variant="outline" size="sm">Sign Out</Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Notifications Settings */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
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
                  <Button variant="primary">Save Preferences</Button>
                  <Button variant="secondary">Reset to Default</Button>
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
                  <Button variant="primary">Update Settings</Button>
                  <Button variant="secondary">Cancel</Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SettingsPage;
