'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card';
import { Calendar, Clock, DollarSign, FileText, AlertCircle } from 'lucide-react';

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [upcomingLeave, setUpcomingLeave] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [latestPayslip, setLatestPayslip] = useState<any>(null);
  const cancelledRef = useRef(false);

  // Redirect admins to main dashboard — they don't have employee records
  useEffect(() => {
    if (!user) return;
    cancelledRef.current = false;
    const isAdmin = user.roles?.some(r =>
      r.role_name === 'Super Admin' ||
      r.role_name === 'Company Admin' ||
      r.role_name === 'HR Manager'
    );
    if (isAdmin) {
      router.replace('/dashboard');
      return;
    }
    loadEmployeeData();
    return () => { cancelledRef.current = true; };
  }, [user]);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);

      // Get employee profile by email (not company_id)
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user?.email)
        .single();

      if (empError) {
        if (!cancelledRef.current) setLoading(false);
        return;
      }
      if (cancelledRef.current) return;
      setEmployeeData(empData);

      // Get leave balance
      const { data: balanceData, error: balanceError } = await supabase
        .from('employee_leave_balance')
        .select('*')
        .eq('employee_id', empData?.id || '')
        .single();

      if (!balanceError && !cancelledRef.current) {
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

      if (!leavesError && !cancelledRef.current) {
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

      if (!attendanceError && !cancelledRef.current) {
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

      if (!payslipError && !cancelledRef.current) {
        setLatestPayslip(payslipData);
      }
    } catch (err) {
      console.error('Error loading employee dashboard:', err);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading your dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome, {user?.first_name}!
          </h1>
          <p className="text-muted-foreground mt-2">Your personal HR dashboard</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Leave Balance */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Leave Balance</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {leaveBalance?.balance || 0} days
                </p>
              </div>
              <Calendar className="text-primary" size={32} />
            </div>
          </Card>

          {/* Attendance Rate */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">This Month</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {recentAttendance.filter(a => a.status === 'present').length} / {recentAttendance.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Days present</p>
              </div>
              <Clock className="text-green-500" size={32} />
            </div>
          </Card>

          {/* Latest Salary */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Latest Salary</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {latestPayslip ? `${latestPayslip.net_pay?.toLocaleString()}` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{latestPayslip?.month || 'No payslip'}</p>
              </div>
              <DollarSign className="text-purple-500" size={32} />
            </div>
          </Card>

          {/* Position */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Position</p>
                <p className="text-xl font-bold text-foreground mt-2">
                  {employeeData?.position || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{employeeData?.department || 'N/A'}</p>
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
              <h2 className="text-xl font-bold text-foreground mb-4">Upcoming Approved Leaves</h2>
              {upcomingLeave.length > 0 ? (
                <div className="space-y-3">
                  {upcomingLeave.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {leave.leave_type}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(leave.start_date).toLocaleDateString()} -{' '}
                          {new Date(leave.end_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{leave.days} days</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        {leave.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto text-muted-foreground mb-3" size={40} />
                  <p className="text-muted-foreground">No upcoming approved leaves</p>
                </div>
              )}
            </Card>

            {/* Recent Attendance */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Recent Attendance (Last 7 Days)</h2>
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.slice(0, 7).map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.check_in ? `${record.check_in} - ${record.check_out || 'Checked out'}` : 'No check-in'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          record.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'absent'
                            ? 'bg-destructive/15 text-red-800'
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
                  <AlertCircle className="mx-auto text-muted-foreground mb-3" size={40} />
                  <p className="text-muted-foreground">No attendance records</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Employee Details */}
            <Card className="p-6 bg-accent">
              <h3 className="font-semibold text-foreground mb-4">Employee Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{employeeData?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{employeeData?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date of Birth</p>
                  <p className="font-medium text-foreground">
                    {employeeData?.date_of_birth
                      ? new Date(employeeData.date_of_birth).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Joining Date</p>
                  <p className="font-medium text-foreground">
                    {employeeData?.date_of_joining
                      ? new Date(employeeData.date_of_joining).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Employment Type</p>
                  <p className="font-medium text-foreground">{employeeData?.employment_type || 'N/A'}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
