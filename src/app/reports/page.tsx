'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Download, Filter, BarChart3 } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';

const ReportsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [reports] = useState([
    {
      id: 'employee-summary',
      title: 'Employee Summary Report',
      description: 'Overview of all employees across companies',
      lastGenerated: new Date().toISOString().split('T')[0],
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Detailed attendance tracking and statistics',
      lastGenerated: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    },
    {
      id: 'payroll',
      title: 'Payroll Report',
      description: 'Monthly payroll and salary analysis',
      lastGenerated: new Date(Date.now() - 432000000).toISOString().split('T')[0],
    },
    {
      id: 'leave',
      title: 'Leave Utilization Report',
      description: 'Leave balance and utilization across organization',
      lastGenerated: new Date(Date.now() - 518400000).toISOString().split('T')[0],
    },
    {
      id: 'turnover',
      title: 'Turnover Analysis',
      description: 'Employee retention and turnover metrics',
      lastGenerated: new Date(Date.now() - 604800000).toISOString().split('T')[0],
    },
    {
      id: 'department',
      title: 'Department Performance Report',
      description: 'Performance metrics by department',
      lastGenerated: new Date(Date.now() - 691200000).toISOString().split('T')[0],
    },
  ]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);

        const mockReports = [
          {
            name: `Employee_Summary_${new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' }).replace('/', '')}.pdf`,
            date: new Date().toISOString().split('T')[0],
            size: `${Math.floor(Math.random() * 3) + 2}.${Math.floor(Math.random() * 9)} MB`,
          },
          {
            name: `Payroll_${new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' }).replace('/', '')}.xlsx`,
            date: new Date(Date.now() - 432000000).toISOString().split('T')[0],
            size: `${Math.floor(Math.random() * 2) + 1}.${Math.floor(Math.random() * 9)} MB`,
          },
          {
            name: `Attendance_${new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' }).replace('/', '')}.pdf`,
            date: new Date(Date.now() - 604800000).toISOString().split('T')[0],
            size: `${Math.floor(Math.random() * 4) + 2}.${Math.floor(Math.random() * 9)} MB`,
          },
        ];

        setRecentReports(mockReports);
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [selectedCompany]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
            {selectedCompany ? `View reports for ${selectedCompany.name}` : 'Select a company to view reports'}
          </p>
        </div>

        {!selectedCompany && (
          <Card className="bg-blue-50 border border-blue-200">
            <p className="text-blue-700 text-center py-4">Please select a company from the header to view reports</p>
          </Card>
        )}

        {selectedCompany && (
          <>
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && (
          <>
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
            {recentReports.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent reports</p>
            ) : (
              recentReports.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-600">{file.size} • {file.date}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download size={16} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
          </>
        )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReportsPage;
