import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, query, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function CourseMonitors() {
  const { courseId } = useParams();
  const { userProfile } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  if (userProfile?.role !== 'admin') {
    return <Navigate to={`/courses/${courseId}`} replace />;
  }

  useEffect(() => {
    if (!courseId) return;

    // Load Course
    const unsubCourse = onSnapshot(doc(db, 'courses', courseId), (docSnap) => {
      if (docSnap.exists()) {
        setCourse({ id: docSnap.id, ...docSnap.data() });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `courses/${courseId}`));

    // Load Users (We theoretically only assign from users who have checked in, but simplest is list all students)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'student'));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users`));

    return () => {
      unsubCourse();
      unsubUsers();
    };
  }, [courseId]);

  const toggleMonitor = async (userId: string) => {
    if (!course || !courseId) return;
    try {
      const currentMonitors = course.monitors || [];
      let newMonitors;
      if (currentMonitors.includes(userId)) {
        newMonitors = currentMonitors.filter((id: string) => id !== userId);
      } else {
        newMonitors = [...currentMonitors, userId];
      }
      await updateDoc(doc(db, 'courses', courseId), { monitors: newMonitors });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
    }
  };

  if (loading || !course) return <div className="p-12 text-center">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link to={`/courses/${courseId}`} className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Quay lại {course.name}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center space-x-3">
        <div className="bg-blue-100 p-2 rounded-lg">
          <ShieldAlert className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Cán sự lớp</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cán sự có thể phân công bài tập và xem thống kê tiến độ của sinh viên.
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {users.filter(u => (course.students || []).includes(u.id)).length === 0 ? (
            <li className="p-6 text-center text-gray-500">Lớp học phần chưa có sinh viên nào.</li>
          ) : (
            users.filter(u => (course.students || []).includes(u.id)).map(user => {
              const isMonitor = (course.monitors || []).includes(user.id);
              
              return (
                <li key={user.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 flex items-center">
                      {user.fullName}
                      {isMonitor && <ShieldCheck className="h-4 w-4 text-green-500 ml-2" />}
                    </h3>
                    <p className="text-sm text-gray-500">MSV: {user.studentId} | {user.email}</p>
                  </div>
                  <div className="mt-4 sm:mt-0">
                    <button
                      onClick={() => toggleMonitor(user.id)}
                      className={`inline-flex items-center px-3 py-1.5 border rounded-md text-sm font-medium ${
                        isMonitor 
                          ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                          : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {isMonitor ? 'Hủy Cán sự' : 'Chỉ định làm Cán sự'}
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
