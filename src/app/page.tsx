'use client';

import React from 'react';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Users, Building2, Calendar, TrendingUp } from 'lucide-react';

const Home: React.FC = () => {
  const stats = [
    { label: 'Total Employees', value: 1250, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Companies', value: 8, icon: Building2, color: 'bg-green-100 text-green-600' },
    { label: 'On Leave Today', value: 45, icon: Calendar, color: 'bg-orange-100 text-orange-600' },
    { label: 'Revenue (This Month)', value: '$125K', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
  ];

  const recentActivities = [
    { id: 1, type: 'employee_added', description: 'New employee John Doe added', time: '2 hours ago' },
    { id: 2, type: 'leave_approved', description: 'Leave request approved for Jane Smith', time: '4 hours ago' },
    { id: 3, type: 'payroll_processed', description: 'Monthly payroll processed for Company A', time: '1 day ago' },
    { id: 4, type: 'employee_joined', description: 'Employee Sarah Johnson completed onboarding', time: '2 days ago' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's your HR overview.</p>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon size={24} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card
            header={<h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>}
            className="lg:col-span-1"
          >
            <div className="space-y-3">
              <Link href="/employees/new">
                <Button variant="primary" className="w-full">
                  + Add New Employee
                </Button>
              </Link>
              <Link href="/companies/new">
                <Button variant="secondary" className="w-full">
                  + Add New Company
                </Button>
              </Link>
              <Link href="/leave">
                <Button variant="outline" className="w-full">
                  Manage Leave Requests
                </Button>
              </Link>
              <Link href="/payroll">
                <Button variant="outline" className="w-full">
                  Process Payroll
                </Button>
              </Link>
            </div>
          </Card>

          {/* Recent Activities */}
          <Card
            header={<h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>}
            className="lg:col-span-2"
          >
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-gray-200 last:border-b-0">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm font-medium">{activity.description}</p>
                    <p className="text-gray-500 text-xs mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Secondary Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Leaves */}
          <Card
            header={<h2 className="text-lg font-semibold text-gray-900">Upcoming Leaves</h2>}
          >
            <div className="space-y-3">
              {[
                { name: 'Ahmed Hassan', from: 'May 10', to: 'May 15', days: 5 },
                { name: 'Fatima Al-Zahra', from: 'May 20', to: 'May 25', days: 5 },
                { name: 'Mohammed Ali', from: 'May 28', to: 'June 2', days: 5 },
              ].map((leave, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{leave.name}</p>
                    <p className="text-sm text-gray-600">{leave.from} - {leave.to}</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{leave.days}d</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Department Distribution */}
          <Card
            header={<h2 className="text-lg font-semibold text-gray-900">Department Distribution</h2>}
          >
            <div className="space-y-3">
              {[
                { name: 'Sales', count: 320, percentage: 25 },
                { name: 'Engineering', count: 280, percentage: 22 },
                { name: 'HR & Admin', count: 150, percentage: 12 },
                { name: 'Operations', count: 200, percentage: 16 },
                { name: 'Others', count: 300, percentage: 25 },
              ].map((dept, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900">{dept.name}</span>
                    <span className="text-gray-600">{dept.count} employees</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${dept.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
