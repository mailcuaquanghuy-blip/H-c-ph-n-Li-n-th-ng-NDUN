import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, query, onSnapshot, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react';

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
        }

        // Load Assignment
        const asgDoc = await getDoc(doc(db, 'courses', courseId, 'assignments', assignmentId));
        if (asgDoc.exists()) setAssignment({ id: asgDoc.id, ...asgDoc.data() });

        // Load all users (assuming small class for now, otherwise we needed checkins)
        // Wait, realistically we should only fetch students who checked in to this course.
        const checkinsSnap = await getDocs(collection(db, 'courses', courseId, 'checkins'));
        const checkedInIds = checkinsSnap.docs.map(d => d.id);
        
        if (checkedInIds.length > 0) {
          const usersSnap = await getDocs(collection(db, 'users'));
          const classStudents = usersSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => checkedInIds.includes(u.id));
          setStudents(classStudents);
        } else {
          setStudents([]);
        }

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

  const getStatusDisplay = (status: string | undefined) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center text-green-600"><CheckCircle2 className="h-4 w-4 mr-1" />Hoàn thành</span>;
      case 'in_progress':
        return <span className="inline-flex items-center text-blue-600"><Clock className="h-4 w-4 mr-1" />Đang làm</span>;
      default:
        return <span className="inline-flex items-center text-gray-500"><Circle className="h-4 w-4 mr-1" />Chưa làm</span>;
    }
  };

  const getStatusStyle = (status: string | undefined) => {
    if (status === 'completed') return 'bg-green-50 border-green-200';
    if (status === 'in_progress') return 'bg-blue-50 border-blue-200';
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

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Thống kê Bài tập</h1>
        <h2 className="text-lg font-medium text-gray-600 mt-1">{assignment.title}</h2>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Danh sách sinh viên đã điểm danh ({students.length})</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {students.map(student => {
            const status = progressMap[student.id] || 'not_started';
            
            return (
              <li key={student.id} className={`p-4 sm:px-6 border-l-4 ${status === 'completed' ? 'border-l-green-500' : status === 'in_progress' ? 'border-l-blue-500' : 'border-l-gray-300'} ${getStatusStyle(status)}`}>
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
            <li className="p-6 text-center text-gray-500">Chưa có sinh viên nào điểm danh lớp này.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
