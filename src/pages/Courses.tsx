import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Plus, Book, ChevronRight, AlertCircle } from 'lucide-react';
import { getDoc, getDocs } from 'firebase/firestore';

type Course = {
  id: string;
  name: string;
  coursePart?: string;
  description: string;
  zaloLink: string;
  createdBy: string;
  monitors: string[];
  students: string[];
  createdAt: any;
  status?: string;
  completedAt?: any;
  hasIncomplete?: boolean;
};

export default function Courses() {
  const { userProfile, currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCoursePart, setNewCoursePart] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseZalo, setNewCourseZalo] = useState('');
  const [newCourseStudents, setNewCourseStudents] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let courseList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      
      if (userProfile?.role === 'student') {
        courseList = courseList.filter(c => c.students?.includes(userProfile.id) || c.monitors?.includes(userProfile.id));
      }

      // Check for incomplete assignments
      if (currentUser && userProfile?.role === 'student') {
        const updatedList = await Promise.all(courseList.map(async (course) => {
          try {
            const asgsSnap = await getDocs(collection(db, 'courses', course.id, 'assignments'));
            let hasIncomplete = false;
            for (const asgDoc of asgsSnap.docs) {
              const progDoc = await getDoc(doc(db, 'courses', course.id, 'assignments', asgDoc.id, 'progress', currentUser.uid));
              const status = progDoc.exists() ? progDoc.data().status : 'not_started';
              if (status === 'not_started' || status === 'in_progress') {
                hasIncomplete = true;
                break;
              }
            }
            return { ...course, hasIncomplete };
          } catch (e) {
            return course;
          }
        }));
        setCourses(updatedList);
      } else {
        setCourses(courseList);
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });

    return () => unsubscribe();
  }, [userProfile, currentUser]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !newCoursePart.trim() || !currentUser) return;
    
    // Parse student IDs from input (split by comma, space, newline, tab)
    const studentIds = newCourseStudents
      .split(/[\n,\s\t]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);
      
    // Remove duplicates
    const uniqueStudentIds = Array.from(new Set(studentIds));
    
    setCreating(true);
    try {
      const courseRef = doc(collection(db, 'courses'));
      await setDoc(courseRef, {
        name: newCourseName,
        coursePart: newCoursePart,
        description: newCourseDesc,
        zaloLink: newCourseZalo,
        createdBy: currentUser.uid,
        monitors: [],
        students: uniqueStudentIds,
        createdAt: serverTimestamp(),
        status: 'in_progress'
      });
      setShowAddModal(false);
      setNewCourseName('');
      setNewCoursePart('');
      setNewCourseDesc('');
      setNewCourseZalo('');
      setNewCourseStudents('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'courses');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Các Lớp học phần</h1>
          <p className="mt-1 text-sm text-gray-500">
            {userProfile?.role === 'admin' 
              ? 'Quản lý các lớp học phần và theo dõi tiến độ sinh viên.' 
              : 'Chọn lớp học phần để điểm danh và làm bài tập.'}
          </p>
        </div>
        {userProfile?.role === 'admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tạo Lớp mới
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 border-dashed">
          <Book className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có lớp học phần nào</h3>
          <p className="mt-1 text-sm text-gray-500">
            {userProfile?.role === 'admin' ? 'Bắt đầu bằng cách tạo lớp học phần mới.' : 'Vui lòng chờ cán sự lớp tạo lớp học phần.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map(course => (
            <Link 
              to={`/courses/${course.id}`} 
              key={course.id}
              className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow group"
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="bg-blue-50 rounded-lg p-3 relative">
                    <Book className="h-6 w-6 text-blue-600" />
                    {course.hasIncomplete && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white"></span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    {course.hasIncomplete && (
                      <span className="mb-2 inline-flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                        <AlertCircle className="h-3 w-3 mr-1" /> CÓ BÀI CHƯA XONG
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 truncate">
                  {course.name} - Học phần {course.coursePart || 'N/A'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {course.description || 'Không có mô tả'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <form onSubmit={handleCreateCourse} className="flex flex-col max-h-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Tạo Lớp học phần mới
                </h3>
              </div>
              <div className="px-6 py-4 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tên Môn học</label>
                    <input
                      type="text"
                      required
                      value={newCourseName}
                      onChange={e => setNewCourseName(e.target.value)}
                      className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Điều dưỡng cơ bản"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Học phần mấy</label>
                    <input
                      type="text"
                      required
                      value={newCoursePart}
                      onChange={e => setNewCoursePart(e.target.value)}
                      className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: 1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mô tả chi tiết</label>
                  <textarea
                    value={newCourseDesc}
                    onChange={e => setNewCourseDesc(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Link Nhóm Zalo (Tùy chọn)</label>
                  <input
                    type="url"
                    value={newCourseZalo}
                    onChange={e => setNewCourseZalo(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://zalo.me/g/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Danh sách Sinh viên (Bắt buộc)</label>
                  <p className="text-xs text-gray-500 mb-1">Nhập các Mã sinh viên, cách nhau bởi dấu phẩy, khoảng trắng hoặc xuống dòng.</p>
                  <textarea
                    required
                    value={newCourseStudents}
                    onChange={e => setNewCourseStudents(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="VD: 20210001, 20210002"
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {creating ? 'Đang tạo...' : 'Tạo Lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
