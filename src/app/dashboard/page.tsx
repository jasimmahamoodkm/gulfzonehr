'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  Users,
  Building2,
  Calendar,
  BarChart3,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    { label: 'Total Employees', value: 0, change: '+0%', icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Companies', value: 0, change: '+0%', icon: Building2, color: 'bg-green-100 text-green-600' },
    { label: 'Active Projects', value: 0, change: '+0%', icon: BarChart3, color: 'bg-purple-100 text-purple-600' },
    { label: 'On Leave Today', value: 0, change: '+0%', icon: Calendar, color: 'bg-orange-100 text-orange-600' },
  ]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentHires, setRecentHires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Get total employees
        const { data: employees, error: empError } = await supabase
          .from('employees')
          .select('id,date_of_joining,company_id,first_name,last_name');

        if (empError) throw empError;

        // Get total companies
        const { data: companies, error: compError } = await supabase
          .from('companies')
          .select('id,name');

        if (compError) throw compError;

        // Get attendance for today
        const today = new Date().toISOString().split('T')[0];
        const { data: todayAttendance, error: attError } = await supabase
          .from('attendance')
          .select('id')
          .eq('date', today)
          .eq('status', 'On Leave');

        if (attError) throw attError;

        // Update stats
        setStats([
          { label: 'Total Employees', value: employees?.length || 0, change: '+0%', icon: Users, color: 'bg-blue-100 text-blue-600' },
          { label: 'Total Companies', value: companies?.length || 0, change: '+0%', icon: Building2, color: 'bg-green-100 text-green-600' },
          { label: 'Active Projects', value: 0, change: '+0%', icon: BarChart3, color: 'bg-purple-100 text-purple-600' },
          { label: 'On Leave Today', value: todayAttendance?.length || 0, change: '+0%', icon: Calendar, color: 'bg-orange-100 text-orange-600' },
        ]);

        // Get recent hires (last 4)
        const { data: hires, error: hiresError } = await supabase
          .from('employees')
          .select('*')
          .order('date_of_joining', { ascending: false })
          .limit(4);

        if (hiresError) throw hiresError;

        // Enrich with company names (avoid N+1 by fetching all companies once)
        if (hires && companies) {
          const companyMap = new Map(companies.map(c => [c.id, c.name]));
          const enrichedHires = hires.map((hire) => ({
            ...hire,
            company_name: companyMap.get(hire.company_id) || 'Unknown',
          }));
          setRecentHires(enrichedHires);
        }

        // Aggregate employee growth by month
        if (employees) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthCounts = new Map<number, number>();

          employees.forEach((emp: any) => {
            if (emp.date_of_joining) {
              const date = new Date(emp.date_of_joining);
              const month = date.getMonth();
              monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
            }
          });

          const chartDataPoints = [];
          let runningTotal = 0;
          for (let i = 0; i < 5; i++) {
            const count = monthCounts.get(i) || 0;
            runningTotal += count;
            chartDataPoints.push({
              month: months[i],
              employees: runningTotal || 0,
              applications: Math.floor(Math.random() * 70) + 30,
            });
          }
          setChartData(chartDataPoints);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-8 text-white">
          <h1 className="text-4xl font-bold mb-2">Welcome back, {user?.first_name || 'User'}!</h1>
          <p className="text-blue-100">Here's what's happening with your organization today.</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && (
          <>
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

        {/* Recent Hires */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Hires</h2>
              <Button variant="outline" size="sm">View All</Button>
            </div>
            <div className="space-y-3">
              {recentHires.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent hires</p>
              ) : (
                recentHires.map((hire, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{hire.first_name} {hire.last_name}</p>
                      <p className="text-sm text-gray-600">{hire.position} • {hire.company_name}</p>
                    </div>
                    <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                      {hire.date_of_joining ? new Date(hire.date_of_joining).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

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
          </>
        )}
      </div>
    </Layout>
  );
};

export default DashboardPage;
