'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card';
import { Calendar, Clock, DollarSign, FileText, AlertCircle } from 'lucide-react';

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [upcomingLeave, setUpcomingLeave] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [latestPayslip, setLatestPayslip] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    loadEmployeeData();
  }, [user]);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading employee dashboard data for user:', user?.id);

      // Get employee profile
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', user?.company_id)
        .single();

      if (empError) {
        console.error('❌ Error loading employee data:', empError);
      } else {
        console.log('✅ Employee data loaded:', empData);
        setEmployeeData(empData);
      }

      // Get leave balance
      const { data: balanceData, error: balanceError } = await supabase
        .from('employee_leave_balance')
        .select('*')
        .eq('employee_id', empData?.id || '')
        .single();

      if (!balanceError) {
        console.log('✅ Leave balance loaded:', balanceData);
        setLeaveBalance(balanceData);
      }

      // Get upcoming leaves (next 30 days)
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data: leavesData, error: leavesError } = await supabase
        .from('leaves')
        .select('*')
        .eq('employee_id', empData?.id || '')
        .gte('start_date', today)
        .lte('start_date', futureDate)
        .eq('status', 'approved')
        .order('start_date');

      if (!leavesError) {
        console.log('✅ Upcoming leaves loaded:', leavesData);
        setUpcomingLeave(leavesData || []);
      }

      // Get recent attendance (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', empData?.id || '')
        .gte('date', sevenDaysAgo)
        .order('date', { ascending: false });

      if (!attendanceError) {
        console.log('✅ Recent attendance loaded:', attendanceData);
        setRecentAttendance(attendanceData || []);
      }

      // Get latest payslip
      const { data: payslipData, error: payslipError } = await supabase
        .from('payroll')
        .select('*')
        .eq('employee_id', empData?.id || '')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!payslipError) {
        console.log('✅ Latest payslip loaded:', payslipData);
        setLatestPayslip(payslipData);
      }
    } catch (err) {
      console.error('❌ Error loading employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading your dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {user?.first_name}!
          </h1>
          <p className="text-gray-600 mt-2">Your personal HR dashboard</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Leave Balance */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Leave Balance</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {leaveBalance?.balance || 0} days
                </p>
              </div>
              <Calendar className="text-blue-500" size={32} />
            </div>
          </Card>

          {/* Attendance Rate */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">This Month</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {recentAttendance.filter(a => a.status === 'present').length} / {recentAttendance.length}
                </p>
                <p className="text-xs text-gray-600 mt-1">Days present</p>
              </div>
              <Clock className="text-green-500" size={32} />
            </div>
          </Card>

          {/* Latest Salary */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Latest Salary</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {latestPayslip ? `${latestPayslip.net_pay?.toLocaleString()}` : 'N/A'}
                </p>
                <p className="text-xs text-gray-600 mt-1">{latestPayslip?.month || 'No payslip'}</p>
              </div>
              <DollarSign className="text-purple-500" size={32} />
            </div>
          </Card>

          {/* Position */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Position</p>
                <p className="text-xl font-bold text-gray-900 mt-2">
                  {employeeData?.position || 'N/A'}
                </p>
                <p className="text-xs text-gray-600 mt-1">{employeeData?.department || 'N/A'}</p>
              </div>
              <FileText className="text-orange-500" size={32} />
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming Leaves */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Approved Leaves</h2>
              {upcomingLeave.length > 0 ? (
                <div className="space-y-3">
                  {upcomingLeave.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {leave.leave_type}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(leave.start_date).toLocaleDateString()} -{' '}
                          {new Date(leave.end_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{leave.days} days</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        {leave.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto text-gray-400 mb-3" size={40} />
                  <p className="text-gray-600">No upcoming approved leaves</p>
                </div>
              )}
            </Card>

            {/* Recent Attendance */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Attendance (Last 7 Days)</h2>
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.slice(0, 7).map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-gray-600">
                          {record.check_in ? `${record.check_in} - ${record.check_out || 'Checked out'}` : 'No check-in'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          record.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {record.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto text-gray-400 mb-3" size={40} />
                  <p className="text-gray-600">No attendance records</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Employee Details */}
            <Card className="p-6 bg-blue-50">
              <h3 className="font-semibold text-gray-900 mb-4">Employee Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{employeeData?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone</p>
                  <p className="font-medium text-gray-900">{employeeData?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Date of Birth</p>
                  <p className="font-medium text-gray-900">
                    {employeeData?.date_of_birth
                      ? new Date(employeeData.date_of_birth).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Joining Date</p>
                  <p className="font-medium text-gray-900">
                    {employeeData?.date_of_joining
                      ? new Date(employeeData.date_of_joining).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Employment Type</p>
                  <p className="font-medium text-gray-900">{employeeData?.employment_type || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
              <div className="space-y-2">
                <a
                  href="/leaves"
                  className="block w-full px-4 py-2 text-center bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
                >
                  Request Leave
                </a>
                <a
                  href="/payroll"
                  className="block w-full px-4 py-2 text-center bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium text-sm"
                >
                  View Payslips
                </a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
