'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  Users,
  Building2,
  Calendar,
  FileWarning,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/context/CompanyContext';

interface UpcomingItem { label: string; detail: string; date: string }

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const [stats, setStats] = useState([
    { label: 'Total Employees', value: 0, icon: Users, color: 'bg-blue-100 text-blue-600', href: '/employees' },
    { label: 'Total Companies', value: 0, icon: Building2, color: 'bg-green-100 text-green-600', href: '/companies' },
    { label: 'On Leave Today', value: 0, icon: Calendar, color: 'bg-orange-100 text-orange-600', href: '/attendance' },
    { label: 'Docs Expiring (30d)', value: 0, icon: FileWarning, color: 'bg-amber-100 text-amber-600', href: '/documents?filter=expiring' },
    { label: 'Docs Expired', value: 0, icon: FileWarning, color: 'bg-red-100 text-red-600', href: '/documents?filter=expired' },
  ]);
  const [chartData, setChartData] = useState<{ label: string; count: number }[]>([]);
  const [recentHires, setRecentHires] = useState<any[]>([]);
  const [deptHeadcount, setDeptHeadcount] = useState<{ name: string; count: number }[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const companyId = selectedCompany?.id;
        const today = new Date().toISOString().split('T')[0];
        const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

        // Employees (scoped to the selected company)
        let empQuery = supabase
          .from('employees')
          .select('id,date_of_joining,company_id,first_name,last_name,department,position,status,archived_at');
        if (companyId) empQuery = empQuery.eq('company_id', companyId);
        const { data: employees, error: empError } = await empQuery;
        if (empError) throw empError;
        const emps = employees || [];
        const companyEmpIds = emps.map((e: any) => e.id);
        const empIdFilter = companyEmpIds.length ? companyEmpIds : ['00000000-0000-0000-0000-000000000000'];
        const nameById = new Map<string, string>(emps.map((e: any) => [e.id, `${e.first_name} ${e.last_name}`]));

        // Companies (visible to this user)
        const { data: companies, error: compError } = await supabase.from('companies').select('id,name');
        if (compError) throw compError;

        // On leave today (attendance, scoped)
        let attQuery = supabase
          .from('attendance').select('id')
          .eq('date', today).eq('status', 'On Leave');
        if (companyId) attQuery = attQuery.in('employee_id', empIdFilter);
        const { data: todayAttendance, error: attError } = await attQuery;
        if (attError) throw attError;

        // Documents expiring within 30 days (scoped)
        let docQuery = supabase
          .from('documents')
          .select('id,document_type,expiry_date,employee_id')
          .gte('expiry_date', today).lte('expiry_date', in30)
          .order('expiry_date', { ascending: true });
        if (companyId) docQuery = docQuery.eq('company_id', companyId);
        const { data: expiringDocs } = await docQuery;

        // Documents already expired (scoped)
        let expiredQuery = supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .lt('expiry_date', today);
        if (companyId) expiredQuery = expiredQuery.eq('company_id', companyId);
        const { count: expiredCount } = await expiredQuery;

        setStats([
          { label: 'Total Employees', value: emps.length, icon: Users, color: 'bg-blue-100 text-blue-600', href: '/employees' },
          { label: 'Total Companies', value: companies?.length || 0, icon: Building2, color: 'bg-green-100 text-green-600', href: '/companies' },
          { label: 'On Leave Today', value: todayAttendance?.length || 0, icon: Calendar, color: 'bg-orange-100 text-orange-600', href: '/attendance' },
          { label: 'Docs Expiring (30d)', value: expiringDocs?.length || 0, icon: FileWarning, color: 'bg-amber-100 text-amber-600', href: '/documents?filter=expiring' },
          { label: 'Docs Expired', value: expiredCount || 0, icon: FileWarning, color: 'bg-red-100 text-red-600', href: '/documents?filter=expired' },
        ]);

        // Recent hires (last 4, from the already-scoped employee list)
        const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name]));
        const hires = [...emps]
          .filter((e: any) => e.date_of_joining)
          .sort((a: any, b: any) => (a.date_of_joining < b.date_of_joining ? 1 : -1))
          .slice(0, 4)
          .map((e: any) => ({ ...e, company_name: companyMap.get(e.company_id) || '' }));
        setRecentHires(hires);

        // Employee growth: cumulative headcount over the last 12 months (real dates)
        const points: { label: string; count: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // end of month
          const ym = d.toISOString().split('T')[0];
          const count = emps.filter((e: any) => e.date_of_joining && e.date_of_joining <= ym).length;
          points.push({ label: d.toLocaleString('default', { month: 'short' }), count });
        }
        setChartData(points);

        // Department headcount (real distribution, active employees)
        const deptMap: Record<string, number> = {};
        emps.filter((e: any) => !e.archived_at).forEach((e: any) => {
          const d = e.department || 'Unassigned';
          deptMap[d] = (deptMap[d] || 0) + 1;
        });
        setDeptHeadcount(Object.entries(deptMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));

        // Upcoming: approved/pending leaves starting soon + document expiries (next 30 days)
        let leaveQuery = supabase
          .from('leaves')
          .select('employee_id,leave_type,start_date,approval_status,status')
          .gte('start_date', today).lte('start_date', in30)
          .order('start_date', { ascending: true })
          .limit(5);
        if (companyId) leaveQuery = leaveQuery.in('employee_id', empIdFilter);
        const { data: upcomingLeaves } = await leaveQuery;

        const items: UpcomingItem[] = [
          ...(upcomingLeaves || []).map((l: any) => ({
            label: `${nameById.get(l.employee_id) || 'Employee'} — ${l.leave_type || 'Leave'}`,
            detail: (l.approval_status || l.status || '').toString(),
            date: l.start_date,
          })),
          ...(expiringDocs || []).map((doc: any) => ({
            label: `${doc.document_type || 'Document'} expires`,
            detail: doc.employee_id ? (nameById.get(doc.employee_id) || 'Company document') : 'Company document',
            date: doc.expiry_date,
          })),
        ].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 6);
        setUpcoming(items);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedCompany?.id]);

  const maxDept = Math.max(1, ...deptHeadcount.map((d) => d.count));

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
        {/* Key Statistics — each tile links to its detail page */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} onClick={() => router.push(stat.href)} className="cursor-pointer"
                title={`Open ${stat.label}`}>
                <Card className="hover:shadow-lg transition h-full">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`${stat.color} p-3 rounded-lg`}>
                        <Icon size={24} />
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Recent Hires */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Hires</h2>
              <Button variant="outline" size="sm" onClick={() => router.push('/employees')}>View All</Button>
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
                      {hire.date_of_joining ? new Date(hire.date_of_joining).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Employee Growth Chart — cumulative headcount, last 12 months */}
        <Card header={<h2 className="text-lg font-semibold">Employee Growth (last 12 months)</h2>}>
          {chartData.every((d) => d.count === 0) ? (
            <p className="text-gray-500 text-center py-8">No employee data yet</p>
          ) : (
            <div className="h-64 flex items-end gap-2 justify-around">
              {chartData.map((data, i) => {
                const maxValue = Math.max(1, ...chartData.map((d) => d.count));
                const height = (data.count / maxValue) * 100;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1">
                    <div
                      className="bg-blue-600 rounded-t-lg w-full max-w-8 transition-all hover:bg-blue-700"
                      style={{ height: `${Math.max(2, height)}%` }}
                      title={`${data.label}: ${data.count}`}
                    />
                    <span className="text-xs text-gray-600 font-medium">{data.label}</span>
                    <span className="text-xs text-gray-500">{data.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Department headcount + upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card header={<h2 className="text-lg font-semibold">Department Headcount</h2>}>
            <div className="space-y-4">
              {deptHeadcount.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No employees yet</p>
              ) : (
                deptHeadcount.map((dept) => (
                  <div key={dept.name}>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-gray-900">{dept.name}</span>
                      <span className="text-sm text-gray-600">{dept.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(dept.count / maxDept) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card header={<h2 className="text-lg font-semibold">Upcoming (next 30 days)</h2>}>
            <div className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nothing scheduled — no leaves starting or documents expiring in the next 30 days</p>
              ) : (
                upcoming.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {item.detail && <span className="capitalize"> · {item.detail}</span>}
                      </p>
                    </div>
                  </div>
                ))
              )}
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
