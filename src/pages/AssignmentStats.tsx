import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, onSnapshot, getDoc, getDocs } from 'firebase/firestore';
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
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

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
          const pMap: Record<string, string> = {};
          snap.docs.forEach(d => {
            pMap[d.id] = d.data().status;
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

  const chartData = [
    { name: 'Đã hoàn thành', value: students.filter(s => progressMap[s.id] === 'completed').length, color: '#10B981' }, // emerald-500
    { name: 'Chưa làm', value: students.filter(s => !progressMap[s.id] || progressMap[s.id] === 'not_started' || progressMap[s.id] === 'in_progress').length, color: '#D1D5DB' }, // gray-300
  ].filter(d => d.value > 0);

  const getStatusDisplay = (status: string | undefined) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center text-green-600"><CheckCircle2 className="h-4 w-4 mr-1" />Hoàn thành</span>;
      case 'not_started':
      case 'in_progress': // Handle legacy data
      default:
        return <span className="inline-flex items-center text-gray-500"><Circle className="h-4 w-4 mr-1" />Chưa làm</span>;
    }
  };

  const getStatusStyle = (status: string | undefined) => {
    if (status === 'completed') return 'bg-green-50 border-green-200';
    return 'bg-white border-gray-200';
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
        <ul className="divide-y divide-gray-200">
          {students.map(student => {
            const status = progressMap[student.id] || 'not_started';
            const displayStatus = status === 'in_progress' ? 'not_started' : status;
            
            return (
              <li key={student.id} className={`p-4 sm:px-6 border-l-4 ${displayStatus === 'completed' ? 'border-l-green-500' : 'border-l-gray-300'} ${getStatusStyle(displayStatus)}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">{student.fullName}</p>
                    <p className="text-sm text-gray-500">MSV: {student.studentId}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    {getStatusDisplay(status)}
                  </div>
                </div>
              </li>
            );
          })}
          {students.length === 0 && (
            <li className="p-6 text-center text-gray-500">Chưa có sinh viên nào trong lớp này.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
