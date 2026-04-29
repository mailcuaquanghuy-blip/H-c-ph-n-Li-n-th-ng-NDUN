import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, query, onSnapshot, getDoc, setDoc, serverTimestamp, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { CheckCircle2, Users, FileText, ExternalLink, Plus, Clock, ArrowLeft } from 'lucide-react';

export default function CourseDetails() {
  const { courseId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [checkInStatus, setCheckInStatus] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<Record<string, any>>({});
  const [checkingIn, setCheckingIn] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  
  // States for new assignment
  const [newAsgTitle, setNewAsgTitle] = useState('');
  const [newAsgDesc, setNewAsgDesc] = useState('');
  const [creatingAsg, setCreatingAsg] = useState(false);

  useEffect(() => {
    if (!courseId) return;

    // Course
    const unsubscribeCourse = onSnapshot(doc(db, 'courses', courseId), (docSnap) => {
      if (docSnap.exists()) {
        setCourse({ id: docSnap.id, ...docSnap.data() });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `courses/${courseId}`));

    // CheckIn for current user
    if (currentUser) {
      const unsubscribeCheckIn = onSnapshot(doc(db, 'courses', courseId, 'checkins', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          setCheckInStatus(docSnap.data());
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `courses/${courseId}/checkins/${currentUser.uid}`));
      return () => {
        unsubscribeCourse();
        unsubscribeCheckIn();
      }
    }

    return () => unsubscribeCourse();
  }, [courseId, currentUser]);

  useEffect(() => {
    if (!courseId) return;
    
    // Assignments
    const q = query(collection(db, 'courses', courseId, 'assignments'), orderBy('createdAt', 'desc'));
    const unsubscribeAsg = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `courses/${courseId}/assignments`));

    return () => unsubscribeAsg();
  }, [courseId]);

  useEffect(() => {
    if (!courseId || !currentUser || assignments.length === 0) return;
    
    // Load progress for current user for each assignment
    const unsubscribes: any[] = [];
    assignments.forEach(asg => {
      const unsub = onSnapshot(doc(db, 'courses', courseId, 'assignments', asg.id, 'progress', currentUser.uid), (ds) => {
        if (ds.exists()) {
          setProgressData(prev => ({ ...prev, [asg.id]: ds.data() }));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `courses/${courseId}/assignments/${asg.id}/progress/${currentUser.uid}`));
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(u => u());
  }, [courseId, currentUser, assignments]);

  const handleCheckIn = async () => {
    if (!currentUser || !courseId || !userProfile) return;
    setCheckingIn(true);
    try {
      await setDoc(doc(db, 'courses', courseId, 'checkins', currentUser.uid), {
        studentId: userProfile.studentId,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `courses/${courseId}/checkins/${currentUser.uid}`);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsgTitle.trim() || !currentUser || !courseId) return;

    setCreatingAsg(true);
    try {
      const asgRef = doc(collection(db, 'courses', courseId, 'assignments'));
      await setDoc(asgRef, {
        title: newAsgTitle,
        description: newAsgDesc,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setShowAddAssignment(false);
      setNewAsgTitle('');
      setNewAsgDesc('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `courses/${courseId}/assignments`);
    } finally {
      setCreatingAsg(false);
    }
  };

  const updateProgress = async (assignmentId: string, status: string) => {
    if (!currentUser || !courseId) return;
    try {
      await setDoc(doc(db, 'courses', courseId, 'assignments', assignmentId, 'progress', currentUser.uid), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}/assignments/${assignmentId}/progress/${currentUser.uid}`);
    }
  };

  if (!course) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  const isAdmin = userProfile?.role === 'admin';
  const isMonitor = course?.monitors?.includes(currentUser?.uid);
  const canManageAssignments = isAdmin || isMonitor;
  const showZaloLink = canManageAssignments || checkInStatus;

  const STATUS_TEXT = {
    'not_started': 'Chưa làm',
    'in_progress': 'Đang làm',
    'completed': 'Hoàn thành'
  };

  const STATUS_COLORS = {
    'not_started': 'bg-gray-100 text-gray-800 border-gray-200',
    'in_progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'completed': 'bg-green-100 text-green-800 border-green-200'
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Quay lại danh sách
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
        {course.description && <p className="mt-2 text-gray-600">{course.description}</p>}
        
        <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center text-sm text-gray-500">
            {checkInStatus ? (
              <span className="inline-flex items-center text-green-600 font-medium">
                <CheckCircle2 className="mr-1.5 h-5 w-5" />
                Bạn đã điểm danh
              </span>
            ) : !isAdmin ? (
              <span className="inline-flex items-center text-amber-600 font-medium">
                <Clock className="mr-1.5 h-5 w-5" />
                Cần điểm danh để hiển thị Nhóm Zalo
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!showZaloLink && (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {checkingIn ? 'Đang điểm danh...' : 'Điểm danh ngay'}
              </button>
            )}

            {showZaloLink && (
              <a
                href={course.zaloLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Users className="mr-2 h-4 w-4" />
                Tham gia Nhóm Zalo
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <FileText className="mr-2 h-5 w-5 text-gray-400" />
          Bài tập
        </h2>
        <div className="flex space-x-3">
          {isAdmin && (
            <Link
              to={`/courses/${courseId}/monitors`}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Users className="h-4 w-4 mr-1.5" />
              Quản lý Cán sự
            </Link>
          )}
          {canManageAssignments && (
            <button
              onClick={() => setShowAddAssignment(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo Bài tập
            </button>
          )}
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Không có bài tập</h3>
          <p className="mt-1 text-sm text-gray-500">
            {canManageAssignments ? 'Click tạo bài tập để giao việc cho sinh viên.' : 'Lớp chưa có bài tập nào.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(asg => {
            const currentStatus = progressData[asg.id]?.status || 'not_started';
            
            return (
              <div key={asg.id} className="bg-white shadow-sm border border-gray-200 rounded-lg p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{asg.title}</h3>
                    {asg.description && <p className="mt-1 text-gray-600 whitespace-pre-wrap text-sm">{asg.description}</p>}
                  </div>
                  
                  <div className="w-full sm:w-48 flex-shrink-0">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tiến độ của bạn:</label>
                    <select
                      value={currentStatus}
                      onChange={(e) => updateProgress(asg.id, e.target.value)}
                      className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border ${STATUS_COLORS[currentStatus as keyof typeof STATUS_COLORS]}`}
                    >
                      <option value="not_started">Chưa làm</option>
                      <option value="in_progress">Đang làm</option>
                      <option value="completed">Đã hoàn thành</option>
                    </select>
                  </div>
                </div>

                {canManageAssignments && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    <Link to={`/courses/${courseId}/assignments/${asg.id}/stats`} className="text-sm font-medium text-blue-600 hover:text-blue-500">
                      Xem thống kê lớp học &rarr;
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddAssignment && canManageAssignments && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddAssignment(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateAssignment}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Thêm Bài tập mới
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tiêu đề bài tập</label>
                      <input
                        type="text"
                        required
                        value={newAsgTitle}
                        onChange={e => setNewAsgTitle(e.target.value)}
                        className="mt-1 flex-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2"
                        placeholder="VD: Viết báo cáo thực hành"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Hướng dẫn chi tiết</label>
                      <textarea
                        value={newAsgDesc}
                        onChange={e => setNewAsgDesc(e.target.value)}
                        className="mt-1 flex-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={creatingAsg}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {creatingAsg ? 'Đang tạo...' : 'Tạo Bài tập'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddAssignment(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
