'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card';
import { Users, Calendar, AlertCircle, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    onLeave: 0,
  });
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<any[]>([]);
  const [teamAttendanceToday, setTeamAttendanceToday] = useState<any[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadManagerData();
  }, [user]);

  const loadManagerData = async () => {
    try {
      setLoading(true);

      // Step 1: find this manager's own employee record
      const { data: myEmpData } = await supabase
        .from('employees')
        .select('id, company_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      const myEmployeeId = myEmpData?.id;

      if (!myEmployeeId) {
        setLoading(false);
        return;
      }

      // Step 2: fetch own record + directly assigned team members
      const { data: allTeamData } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', myEmpData.company_id)
        .or(`id.eq.${myEmployeeId},manager_id.eq.${myEmployeeId}`)
        .order('first_name');

      const allTeam = allTeamData || [];
      const assignedOnly = allTeam.filter((e: any) => e.id !== myEmployeeId);
      const teamMemberIds = assignedOnly.map(e => e.id);


      // Get today's attendance for assigned team
      const today = new Date().toISOString().split('T')[0];
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*, employees(first_name, last_name)')
        .in('employee_id', teamMemberIds)
        .eq('date', today);

      if (!attendanceError) {
        setTeamAttendanceToday(attendanceData || []);

        // Calculate stats
        const stats = {
          totalMembers: teamMemberIds.length,
          presentToday: attendanceData?.filter(a => a.status === 'present').length || 0,
          lateToday: attendanceData?.filter(a => a.status === 'late').length || 0,
          absentToday: attendanceData?.filter(a => a.status === 'absent').length || 0,
          onLeave: 0,
        };

        // Count on leave
        const { data: leaveData } = await supabase
          .from('leaves')
          .select('*')
          .in('employee_id', teamMemberIds)
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today);

        stats.onLeave = leaveData?.length || 0;
        setTeamStats(stats);
      }

      // Get pending leave requests
      const { data: pendingLeaves, error: leavesError } = await supabase
        .from('leaves')
        .select('*, employees(first_name, last_name)')
        .in('employee_id', teamMemberIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!leavesError) {
        setPendingLeaveRequests(pendingLeaves || []);
      }

      // Get team performance metrics (attendance rate last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data: performanceData } = await supabase
        .from('attendance')
        .select('employee_id, status')
        .in('employee_id', teamMemberIds)
        .gte('date', thirtyDaysAgo);

      if (performanceData) {
        // Calculate attendance rate per employee
        const performanceMap = new Map();
        performanceData.forEach(record => {
          if (!performanceMap.has(record.employee_id)) {
            performanceMap.set(record.employee_id, {
              present: 0,
              total: 0,
            });
          }
          const stats = performanceMap.get(record.employee_id);
          stats.total += 1;
          if (record.status === 'present') stats.present += 1;
        });

        const performance = Array.from(performanceMap.entries()).map(([empId, stats]) => {
          const employee = allTeam.find((m: any) => m.id === empId);
          return {
            id: empId,
            name: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown',
            attendanceRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
            daysPresent: stats.present,
            daysTotal: stats.total,
          };
        });

        setTeamPerformance(performance.sort((a, b) => b.attendanceRate - a.attendanceRate));
      }
    } catch (err) {
      console.error('Error loading manager dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    try {
      const { error } = await supabase
        .from('leaves')
        .update({ status: 'approved' })
        .eq('id', leaveId);

      if (error) throw error;
      loadManagerData();
    } catch (err) {
      console.error('Error approving leave:', err);
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    try {
      const { error } = await supabase
        .from('leaves')
        .update({ status: 'rejected' })
        .eq('id', leaveId);

      if (error) throw error;
      loadManagerData();
    } catch (err) {
      console.error('Error rejecting leave:', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading your manager dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-gray-600 mt-2">Team overview and management</p>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Team Size</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{teamStats.totalMembers}</p>
              </div>
              <Users className="text-blue-500" size={32} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Present Today</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{teamStats.presentToday}</p>
              </div>
              <CheckCircle className="text-green-500" size={32} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Late Today</p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">{teamStats.lateToday}</p>
              </div>
              <Clock className="text-yellow-500" size={32} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Absent Today</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{teamStats.absentToday}</p>
              </div>
              <AlertCircle className="text-red-500" size={32} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">On Leave</p>
                <p className="text-2xl font-bold text-purple-600 mt-2">{teamStats.onLeave}</p>
              </div>
              <Calendar className="text-purple-500" size={32} />
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Leave Requests */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Leave Requests</h2>
              {pendingLeaveRequests.length > 0 ? (
                <div className="space-y-4">
                  {pendingLeaveRequests.map((leave) => (
                    <div
                      key={leave.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {leave.employees?.first_name} {leave.employees?.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{leave.leave_type}</p>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          Pending
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {new Date(leave.start_date).toLocaleDateString()} -{' '}
                        {new Date(leave.end_date).toLocaleDateString()} ({leave.days} days)
                      </p>
                      {leave.reason && (
                        <p className="text-sm text-gray-700 mb-3 bg-gray-50 p-2 rounded">
                          <span className="font-medium">Reason:</span> {leave.reason}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveLeave(leave.id)}
                          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleRejectLeave(leave.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto text-gray-400 mb-3" size={40} />
                  <p className="text-gray-600">No pending leave requests</p>
                </div>
              )}
            </Card>

            {/* Team Attendance Today */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Team Attendance Today</h2>
              {teamAttendanceToday.length > 0 ? (
                <div className="space-y-2">
                  {teamAttendanceToday.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {record.employees?.first_name} {record.employees?.last_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {record.check_in ? `${record.check_in} - ${record.check_out || 'Not checked out'}` : 'No check-in'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          record.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'late'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
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
                  <p className="text-gray-600">No attendance records for today</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column */}
          <div>
            {/* Team Performance */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp size={20} />
                Team Performance (30 days)
              </h3>
              {teamPerformance.length > 0 ? (
                <div className="space-y-3">
                  {teamPerformance.map((member) => (
                    <div key={member.id} className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm text-gray-900">{member.name}</p>
                        <span className="text-sm font-bold text-gray-900">{member.attendanceRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            member.attendanceRate >= 90
                              ? 'bg-green-600'
                              : member.attendanceRate >= 70
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${member.attendanceRate}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600">
                        {member.daysPresent} / {member.daysTotal} days
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto text-gray-400 mb-3" size={40} />
                  <p className="text-gray-600 text-sm">No performance data</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
