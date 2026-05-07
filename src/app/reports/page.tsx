'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Download, Filter, BarChart3 } from 'lucide-react';

const ReportsPage: React.FC = () => {
  const reports = [
    {
      id: 'employee-summary',
      title: 'Employee Summary Report',
      description: 'Overview of all employees across companies',
      lastGenerated: '2026-05-06',
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Detailed attendance tracking and statistics',
      lastGenerated: '2026-05-05',
    },
    {
      id: 'payroll',
      title: 'Payroll Report',
      description: 'Monthly payroll and salary analysis',
      lastGenerated: '2026-05-01',
    },
    {
      id: 'leave',
      title: 'Leave Utilization Report',
      description: 'Leave balance and utilization across organization',
      lastGenerated: '2026-04-30',
    },
    {
      id: 'turnover',
      title: 'Turnover Analysis',
      description: 'Employee retention and turnover metrics',
      lastGenerated: '2026-04-28',
    },
    {
      id: 'department',
      title: 'Department Performance Report',
      description: 'Performance metrics by department',
      lastGenerated: '2026-04-25',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate and view HR reports and analytics</p>
        </div>

        {/* Filter Options */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Last 30 Days</option>
                <option>Last 90 Days</option>
                <option>This Quarter</option>
                <option>This Year</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Companies</option>
                <option>GulfZone Tech</option>
                <option>GulfZone Trading</option>
                <option>GulfZone Logistics</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Departments</option>
                <option>Engineering</option>
                <option>Sales</option>
                <option>HR & Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="primary" className="w-full gap-2">
                <Filter size={20} />
                Apply Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <Card key={report.id} className="hover:shadow-lg transition">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BarChart3 size={20} className="text-blue-600" />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-3">
                    Last generated: {new Date(report.lastGenerated).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" className="flex-1 gap-2">
                      <Download size={16} />
                      Generate
                    </Button>
                    <Button variant="secondary" size="sm">View</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Reports */}
        <Card header={<h2 className="text-lg font-semibold">Recent Reports Generated</h2>}>
          <div className="space-y-3">
            {[
              { name: 'Employee_Summary_May2026.pdf', date: '2026-05-06', size: '2.4 MB' },
              { name: 'Payroll_April2026.xlsx', date: '2026-05-01', size: '1.8 MB' },
              { name: 'Attendance_April2026.pdf', date: '2026-04-30', size: '3.1 MB' },
            ].map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-600">{file.size} • {file.date}</p>
                </div>
                <Button variant="outline" size="sm">
                  <Download size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default ReportsPage;
