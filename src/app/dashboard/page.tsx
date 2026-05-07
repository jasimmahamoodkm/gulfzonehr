'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  Users,
  Building2,
  TrendingUp,
  Calendar,
  BarChart3,
  Clock,
} from 'lucide-react';

const DashboardPage: React.FC = () => {
  const stats = [
    { label: 'Total Employees', value: 1250, change: '+5%', icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Companies', value: 8, change: '+0%', icon: Building2, color: 'bg-green-100 text-green-600' },
    { label: 'Active Projects', value: 24, change: '+3%', icon: BarChart3, color: 'bg-purple-100 text-purple-600' },
    { label: 'On Leave Today', value: 45, change: '-2%', icon: Calendar, color: 'bg-orange-100 text-orange-600' },
  ];

  const chartData = [
    { month: 'Jan', employees: 1150, applications: 45 },
    { month: 'Feb', employees: 1180, applications: 52 },
    { month: 'Mar', employees: 1200, applications: 48 },
    { month: 'Apr', employees: 1225, applications: 61 },
    { month: 'May', employees: 1250, applications: 55 },
  ];

  const recentHires = [
    { name: 'John Doe', position: 'Software Engineer', company: 'GulfZone Tech', joinDate: '2026-05-01' },
    { name: 'Sarah Johnson', position: 'Business Analyst', company: 'GulfZone Trading', joinDate: '2026-05-03' },
    { name: 'Ahmed Said', position: 'Operations Manager', company: 'GulfZone Logistics', joinDate: '2026-05-05' },
    { name: 'Mona Hassan', position: 'Content Writer', company: 'GulfZone Group', joinDate: '2026-05-06' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-8 text-white">
          <h1 className="text-4xl font-bold mb-2">Welcome back, Jasim!</h1>
          <p className="text-blue-100">Here's what's happening with your organization today.</p>
        </div>

        {/* Key Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="hover:shadow-lg transition">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`${stat.color} p-3 rounded-lg`}>
                      <Icon size={24} />
                    </div>
                    <span className="text-green-600 text-sm font-semibold">{stat.change}</span>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Hires */}
          <Card className="lg:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Hires</h2>
                <Button variant="outline" size="sm">View All</Button>
              </div>
              <div className="space-y-3">
                {recentHires.map((hire, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{hire.name}</p>
                      <p className="text-sm text-gray-600">{hire.position} • {hire.company}</p>
                    </div>
                    <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                      {new Date(hire.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <div className="space-y-6">
              <div>
                <p className="text-gray-600 text-sm mb-2">Hiring This Month</p>
                <p className="text-3xl font-bold text-gray-900">12</p>
                <p className="text-xs text-green-600 mt-1">↑ 20% from last month</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-2">Open Positions</p>
                <p className="text-3xl font-bold text-gray-900">8</p>
                <p className="text-xs text-orange-600 mt-1">3 high priority</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-2">Pending Approvals</p>
                <p className="text-3xl font-bold text-gray-900">5</p>
                <p className="text-xs text-blue-600 mt-1">2 leave requests</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Employee Growth Chart */}
        <Card header={<h2 className="text-lg font-semibold">Employee Growth Trend</h2>}>
          <div className="h-64 flex items-end gap-2 justify-around">
            {chartData.map((data) => {
              const maxValue = Math.max(...chartData.map(d => d.employees));
              const height = (data.employees / maxValue) * 100;
              return (
                <div key={data.month} className="flex flex-col items-center gap-2">
                  <div
                    className="bg-blue-600 rounded-t-lg w-8 transition-all hover:bg-blue-700"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-gray-600 font-medium">{data.month}</span>
                  <span className="text-xs text-gray-500">{data.employees}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Department Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card header={<h2 className="text-lg font-semibold">Department Productivity</h2>}>
            <div className="space-y-4">
              {[
                { name: 'Engineering', score: 92, trend: 'up' },
                { name: 'Sales', score: 85, trend: 'up' },
                { name: 'HR & Admin', score: 88, trend: 'stable' },
                { name: 'Marketing', score: 79, trend: 'down' },
              ].map((dept) => (
                <div key={dept.name}>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-900">{dept.name}</span>
                    <span className="text-sm text-gray-600">{dept.score}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${dept.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card header={<h2 className="text-lg font-semibold">Upcoming Events</h2>}>
            <div className="space-y-3">
              {[
                { event: 'Team Building Event', date: '2026-05-20', type: 'event' },
                { event: 'Performance Review Cycle', date: '2026-05-25', type: 'review' },
                { event: 'Payroll Processing', date: '2026-05-30', type: 'payroll' },
                { event: 'Mid-Year Planning', date: '2026-06-15', type: 'meeting' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.event}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
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

export default DashboardPage;
