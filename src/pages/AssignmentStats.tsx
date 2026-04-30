import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, onSnapshot, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AssignmentStats() {
  const { courseId, assignmentId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, {status: string, groupName: string}>>({});
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'}>({key: 'firstName', direction: 'asc'});
  
  // Editable state
  const [editingGroup, setEditingGroup] = useState<{studentId: string, value: string} | null>(null);
  const [updatingGroup, setUpdatingGroup] = useState(false);

  useEffect(() => {
    if (!courseId || !assignmentId) return;

    const loadData = async () => {
      try {
        // Load Course
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (courseDoc.exists()) {
          const courseData = { id: courseDoc.id, ...courseDoc.data() };
          setCourse(courseData);
          
          const isMonitor = (courseData as any).monitors?.includes(currentUser?.uid);
          if (userProfile?.role !== 'admin' && !isMonitor) {
            setNoAccess(true);
            return;
          }

          // Load Students
          const studentIds = (courseData as any).students || [];
          if (studentIds.length > 0) {
            const usersSnap = await getDocs(collection(db, 'users'));
            const classStudents = usersSnap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(u => studentIds.includes(u.id));
            setStudents(classStudents);
          } else {
            setStudents([]);
          }
        }

        // Load Assignment
        const asgDoc = await getDoc(doc(db, 'courses', courseId, 'assignments', assignmentId));
        if (asgDoc.exists()) setAssignment({ id: asgDoc.id, ...asgDoc.data() });

        // Listen to progress for this assignment
        const unsubProgress = onSnapshot(collection(db, 'courses', courseId, 'assignments', assignmentId, 'progress'), (snap) => {
          const pMap: Record<string, {status: string, groupName: string}> = {};
          snap.docs.forEach(d => {
            const data = d.data();
            pMap[d.id] = {
              status: data.status,
              groupName: data.groupName || ''
            };
          });
          setProgressMap(pMap);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `courses/${courseId}/assignments/${assignmentId}/progress`);
        });

        return () => unsubProgress();
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    loadData();
  }, [courseId, assignmentId, userProfile, currentUser]);

  if (noAccess) {
    return <div className="text-center py-12 text-red-600">Bạn không có quyền truy cập trang này.</div>;
  }

  if (loading || !assignment || !course) {
    return <div className="text-center py-12">Đang tải biểu đồ dữ liệu...</div>;
  }

  const handleProgressUpdate = async (studentId: string, updates: any) => {
    if (!courseId || !assignmentId) return;
    try {
      if ('groupName' in updates) setUpdatingGroup(true);
      await setDoc(doc(db, 'courses', courseId, 'assignments', assignmentId, 'progress', studentId), updates, { merge: true });
      if ('groupName' in updates) setEditingGroup(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}/assignments/${assignmentId}/progress/${studentId}`);
    } finally {
      if ('groupName' in updates) setUpdatingGroup(false);
    }
  };

  const getFirstName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1].toLowerCase();
  };

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedStudents = [...students].map(s => ({
    ...s,
    firstName: getFirstName(s.fullName),
    groupName: progressMap[s.id]?.groupName || ''
  })).sort((a, b) => {
    let valA = a[sortConfig.key as keyof typeof a] || '';
    let valB = b[sortConfig.key as keyof typeof b] || '';
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (sortConfig.key === 'groupName') {
      valA = a.groupName || 'zzzz';
      valB = b.groupName || 'zzzz';
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const chartData = [
    { name: 'Đã nhận/Hoàn thành', value: students.filter(s => progressMap[s.id]?.status === 'completed' || progressMap[s.id]?.status === 'received').length, color: '#10B981' }, 
    { name: 'Đã gửi', value: students.filter(s => progressMap[s.id]?.status === 'submitted').length, color: '#FBBF24' }, 
    { name: 'Chưa làm', value: students.filter(s => !progressMap[s.id]?.status || progressMap[s.id]?.status === 'not_started' || progressMap[s.id]?.status === 'in_progress').length, color: '#D1D5DB' }, 
  ].filter(d => d.value > 0);

  const STATUS_COLORS = {
    'not_started': 'bg-gray-50 border-gray-200 text-gray-500',
    'submitted': 'bg-yellow-50 border-yellow-200 text-yellow-700',
    'received': 'bg-blue-50 border-blue-200 text-blue-700',
    'completed': 'bg-green-50 border-green-200 text-green-700'
  };

  const getStatusDisplay = (status: string | undefined) => {
    switch (status) {
      case 'completed':
        return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS['completed']}`}><CheckCircle2 className="h-4 w-4 mr-1" />Hoàn thành</span>;
      case 'received':
        return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS['received']}`}><CheckCircle2 className="h-4 w-4 mr-1" />Đã nhận</span>;
      case 'submitted':
        return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS['submitted']}`}><Clock className="h-4 w-4 mr-1" />Đã gửi</span>;
      case 'not_started':
      case 'in_progress':
      default:
        return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS['not_started']}`}><Circle className="h-4 w-4 mr-1" />Chưa gửi</span>;
    }
  };

  const getStatusStyle = (status: string | undefined) => {
    if (status === 'completed') return 'border-l-green-500 bg-green-50/10';
    if (status === 'received') return 'border-l-blue-500 bg-blue-50/10';
    if (status === 'submitted') return 'border-l-yellow-500 bg-yellow-50/10';
    return 'border-l-gray-300 bg-white';
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link to={`/courses/${courseId}`} className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Quay lại {course.name}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thống kê Bài tập</h1>
          <h2 className="text-lg font-medium text-gray-600 mt-1">{assignment.title}</h2>
        </div>

        {students.length > 0 && chartData.length > 0 && (
          <div className="h-40 w-full md:w-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Danh sách sinh viên ({students.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('firstName')}>
                  Họ và tên {sortConfig.key === 'firstName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('id')}>
                  Mã SV {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('groupName')}>
                  Nhóm bài tập {sortConfig.key === 'groupName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái (Ban cán sự)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStudents.map((student, index) => {
                const currentStatus = progressMap[student.id]?.status || 'not_started';
                const displayStatus = currentStatus === 'in_progress' ? 'not_started' : currentStatus;
                
                return (
                  <tr key={student.id} className={`${getStatusStyle(displayStatus)} border-l-4`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.studentId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingGroup?.studentId === student.id ? (
                        <input
                          type="text"
                          autoFocus
                          defaultValue={student.groupName}
                          className="w-24 px-2 py-1 text-sm border border-blue-500 rounded outline-none"
                          onBlur={(e) => handleProgressUpdate(student.id, { groupName: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleProgressUpdate(student.id, { groupName: e.currentTarget.value });
                            if (e.key === 'Escape') setEditingGroup(null);
                          }}
                          disabled={updatingGroup}
                        />
                      ) : (
                        <div 
                          className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded inline-block border border-transparent hover:border-gray-300 min-h-[28px]"
                          onClick={() => setEditingGroup({studentId: student.id, value: student.groupName})}
                        >
                          {student.groupName || <span className="text-gray-400 italic">Thêm nhóm...</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {getStatusDisplay(displayStatus)}
                        <select
                          value={displayStatus}
                          onChange={(e) => handleProgressUpdate(student.id, { status: e.target.value })}
                          className="ml-2 block pl-3 pr-8 py-1 text-xs border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md border bg-white"
                        >
                          <option value="not_started">Chưa làm</option>
                          <option value="in_progress">Đang làm</option>
                          <option value="submitted">Đã gửi (Chờ duyệt)</option>
                          <option value="received">Đã nhận bài</option>
                          <option value="completed">Hoàn thành (Đã duyệt)</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chưa có sinh viên nào trong lớp này.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
