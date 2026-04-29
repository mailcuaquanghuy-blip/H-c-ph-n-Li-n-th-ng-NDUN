import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Plus, Book, ChevronRight } from 'lucide-react';

type Course = {
  id: string;
  name: string;
  description: string;
  zaloLink: string;
  createdBy: string;
  monitors: string[];
  createdAt: any;
};

export default function Courses() {
  const { userProfile, currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseZalo, setNewCourseZalo] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courseList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      setCourses(courseList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !newCourseZalo.trim() || !currentUser) return;
    
    setCreating(true);
    try {
      // Create a specific ID to use standard patterns or let addDoc create one. 
      // But we need to use a generated ID
      const courseRef = doc(collection(db, 'courses'));
      await setDoc(courseRef, {
        name: newCourseName,
        description: newCourseDesc,
        zaloLink: newCourseZalo,
        createdBy: currentUser.uid,
        monitors: [],
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewCourseName('');
      setNewCourseDesc('');
      setNewCourseZalo('');
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
                  <div className="bg-blue-50 rounded-lg p-3">
                    <Book className="h-6 w-6 text-blue-600" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 truncate">
                  {course.name}
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddModal(false)}></div>

            {/* This element is to trick the browser into centering the modal contents. */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateCourse}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Tạo Lớp học phần mới
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tên Lớp (Môn học)</label>
                      <input
                        type="text"
                        required
                        value={newCourseName}
                        onChange={e => setNewCourseName(e.target.value)}
                        className="mt-1 flex-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2"
                        placeholder="VD: Điều dưỡng cơ bản 1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mô tả chi tiết</label>
                      <textarea
                        value={newCourseDesc}
                        onChange={e => setNewCourseDesc(e.target.value)}
                        className="mt-1 flex-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Link Nhóm Zalo</label>
                      <input
                        type="url"
                        required
                        value={newCourseZalo}
                        onChange={e => setNewCourseZalo(e.target.value)}
                        className="mt-1 flex-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2"
                        placeholder="https://zalo.me/g/..."
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {creating ? 'Đang tạo...' : 'Tạo Lớp'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
