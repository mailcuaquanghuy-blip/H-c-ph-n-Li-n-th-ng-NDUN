import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, query, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { CheckCircle2, Users, FileText, ExternalLink, Plus, Clock, ArrowLeft, Settings, XCircle, Trash2, TrendingUp, Circle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

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
  const [newAsgType, setNewAsgType] = useState<'individual' | 'group'>('individual');
  const [creatingAsg, setCreatingAsg] = useState(false);

  // States for Practice Groups
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // States for Edit Assignment
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [editAsgTitle, setEditAsgTitle] = useState('');
  const [editAsgDesc, setEditAsgDesc] = useState('');
  const [updatingAsg, setUpdatingAsg] = useState(false);

  // States for Edit Course
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCoursePart, setEditCoursePart] = useState('');
  const [editCourseDesc, setEditCourseDesc] = useState('');
  const [editCourseZalo, setEditCourseZalo] = useState('');
  const [editCourseStudents, setEditCourseStudents] = useState('');
  const [updatingCourse, setUpdatingCourse] = useState(false);

  // States for tabs and stats
  const [activeTab, setActiveTab] = useState<'assignments' | 'students' | 'progress'>('assignments');
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'}>({key: 'firstName', direction: 'asc'});
  const [editingGroup, setEditingGroup] = useState<{studentId: string, value: string} | null>(null);
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const [allCheckIns, setAllCheckIns] = useState<string[]>([]);
  const [allProgress, setAllProgress] = useState<any[]>([]); // To calculate course progress

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
        } else {
          setCheckInStatus(null);
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

    // Load assignments
    const q = query(collection(db, 'courses', courseId, 'assignments'), orderBy('createdAt', 'desc'));
    const unsubscribeAsg = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `courses/${courseId}/assignments`));

    // Load all check-ins
    const unsubscribeAllCheckIns = onSnapshot(collection(db, 'courses', courseId, 'checkins'), (snapshot) => {
      setAllCheckIns(snapshot.docs.map(d => d.id));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `courses/${courseId}/checkins`));

    return () => {
      unsubscribeAsg();
      unsubscribeAllCheckIns();
    };
  }, [courseId]);

  // Load students data based on course.students
  useEffect(() => {
    if (!course || !course.students) return;

    const fetchStudents = async () => {
      try {
        const studentIds = course.students || [];
        if (studentIds.length > 0) {
          const usersSnap = await getDocs(collection(db, 'users'));
          const classStudents = usersSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => studentIds.includes(u.id));
          setAllStudents(classStudents);
        } else {
          setAllStudents([]);
        }
      } catch (error) {
        console.error("Error fetching students", error);
      }
    };
    
    fetchStudents();
  }, [course?.students]);

  // Load current user progress for assignments
  useEffect(() => {
    if (!courseId || !currentUser || assignments.length === 0) return;
    
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

  // Monitor Course progress by everyone
  useEffect(() => {
    if (!courseId || activeTab !== 'progress' || assignments.length === 0) return;

    const loadAllProgress = async () => {
      try {
        let allProg: any[] = [];
        for (const asg of assignments) {
          const snap = await getDocs(collection(db, 'courses', courseId, 'assignments', asg.id, 'progress'));
          snap.docs.forEach(d => {
            allProg.push({ assignmentId: asg.id, userId: d.id, ...d.data() });
          });
        }
        setAllProgress(allProg);
      } catch (error) {
        console.error("Error fetching all progress", error);
      }
    };

    loadAllProgress();
  }, [courseId, activeTab, assignments]);

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

  const handleAdminToggleCheckIn = async (studentUserId: string, studentIdStr: string, isCheckedIn: boolean) => {
    if (!courseId) return;
    try {
      if (isCheckedIn) {
        await deleteDoc(doc(db, 'courses', courseId, 'checkins', studentUserId));
      } else {
        await setDoc(doc(db, 'courses', courseId, 'checkins', studentUserId), {
          studentId: studentIdStr,
          timestamp: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `courses/${courseId}/checkins/${studentUserId}`);
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

  const handleUpdatePracticeGroup = async (studentId: string, value: string) => {
    if (!courseId || !isAdmin && !canManageAssignments) return;
    setUpdatingGroup(true);
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        [`studentGroups.${studentId}`]: value.trim()
      });
      setEditingGroup(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleAdminRemoveStudent = async (studentUserId: string) => {
    if (!courseId || !course) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa sinh viên khỏi lớp phần này?")) return;
    try {
      const newStudents = (course.students || []).filter((id: string) => id !== studentUserId);
      await updateDoc(doc(db, 'courses', courseId), {
        students: newStudents
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
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
        type: newAsgType,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setShowAddAssignment(false);
      setNewAsgTitle('');
      setNewAsgDesc('');
      setNewAsgType('individual');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `courses/${courseId}/assignments`);
    } finally {
      setCreatingAsg(false);
    }
  };

  const handleCreatePracticeGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !newGroupName.trim() || selectedMembers.length === 0) return;

    setCreatingGroup(true);
    try {
      const groupId = `group_${Date.now()}`;
      await updateDoc(doc(db, 'courses', courseId), {
        [`practiceGroups.${groupId}`]: {
          name: newGroupName.trim(),
          members: selectedMembers
        }
      });
      setNewGroupName('');
      setSelectedMembers([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeletePracticeGroup = async (groupId: string) => {
    if (!courseId || !window.confirm("Xóa nhóm này?")) return;
    try {
      const { [groupId]: _, ...remainingGroups } = course.practiceGroups || {};
      await updateDoc(doc(db, 'courses', courseId), {
        practiceGroups: remainingGroups
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!courseId || !canManageAssignments) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài tập này? Tất cả tiến độ của sinh viên cũng sẽ bị xóa.")) return;
    
    try {
      await deleteDoc(doc(db, 'courses', courseId, 'assignments', assignmentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `courses/${courseId}/assignments/${assignmentId}`);
    }
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !editingAssignment || !canManageAssignments) return;

    setUpdatingAsg(true);
    try {
      await updateDoc(doc(db, 'courses', courseId, 'assignments', editingAssignment.id), {
        title: editAsgTitle.trim(),
        description: editAsgDesc.trim()
      });
      setEditingAssignment(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}/assignments/${editingAssignment.id}`);
    } finally {
      setUpdatingAsg(false);
    }
  };

  const openEditAssignment = (asg: any) => {
    setEditingAssignment(asg);
    setEditAsgTitle(asg.title);
    setEditAsgDesc(asg.description || '');
  };

  const updateProgress = async (assignmentId: string, status: string) => {
    if (!currentUser || !courseId || !course) return;
    
    try {
      const asg = assignments.find(a => a.id === assignmentId);
      const isGroupAsg = asg?.type === 'group';
      
      const updateData = {
        status,
        updatedAt: serverTimestamp()
      };

      if (isGroupAsg) {
        // Find the user's practice group
        const groupEntry = Object.entries(course.practiceGroups || {}).find(([_, g]: any) => 
          g.members.includes(currentUser.uid)
        );

        if (groupEntry) {
          const [groupId, group]: [string, any] = groupEntry;
          // Update for all members in the group
          const batchPromises = group.members.map((mId: string) => 
            setDoc(doc(db, 'courses', courseId, 'assignments', assignmentId, 'progress', mId), {
              ...updateData,
              groupName: group.name,
              groupId: groupId
            }, { merge: true })
          );
          await Promise.all(batchPromises);
        } else {
          // If not in a group, update individually but maybe alert?
          await setDoc(doc(db, 'courses', courseId, 'assignments', assignmentId, 'progress', currentUser.uid), updateData, { merge: true });
        }
      } else {
        await setDoc(doc(db, 'courses', courseId, 'assignments', assignmentId, 'progress', currentUser.uid), updateData, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}/assignments/${assignmentId}/progress/${currentUser.uid}`);
    }
  };

  const markCourseCompleted = async () => {
    if (!courseId || !window.confirm("Đánh dấu môn học này đã hoàn thành?")) return;
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        status: 'completed',
        completedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}`);
    }
  };

  const handleOpenEditCourse = () => {
    setEditCourseName(course.name);
    setEditCoursePart(course.coursePart || '');
    setEditCourseDesc(course.description || '');
    setEditCourseZalo(course.zaloLink);
    setEditCourseStudents((course.students || []).join('\n'));
    setShowEditCourse(true);
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCourseName.trim() || !editCoursePart.trim() || !courseId) return;

    const studentIds = editCourseStudents
      .split(/[\n,\s\t]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);
    const uniqueStudentIds = Array.from(new Set(studentIds));

    setUpdatingCourse(true);
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        name: editCourseName,
        coursePart: editCoursePart,
        description: editCourseDesc,
        zaloLink: editCourseZalo,
        students: uniqueStudentIds
      });
      setShowEditCourse(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}`);
    } finally {
      setUpdatingCourse(false);
    }
  };

  const isAdmin = userProfile?.role === 'admin';
  const isMonitor = course?.monitors?.includes(currentUser?.uid);
  const canManageAssignments = isAdmin || isMonitor;
  const showZaloLink = canManageAssignments || checkInStatus;
  const courseCompleted = course?.status === 'completed';

  const STATUS_COLORS = {
    'not_started': 'bg-gray-100 text-gray-800 border-gray-200',
    'in_progress': 'bg-blue-50 text-blue-700 border-blue-100',
    'submitted': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'received': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'completed': 'bg-green-100 text-green-800 border-green-200'
  };

  // Progress metrics calculation
  const totalStudentAssignments = allStudents.length * assignments.length;
  const completedAssignments = allProgress.filter(p => (p.status === 'completed' || p.status === 'received') && allStudents.some(s => s.id === p.userId)).length;
  const submittedAssignments = allProgress.filter(p => p.status === 'submitted' && allStudents.some(s => s.id === p.userId)).length;
  const completionPercentage = totalStudentAssignments > 0 ? Math.round((completedAssignments / totalStudentAssignments) * 100) : 0;
  
  const chartData = React.useMemo(() => [
    { name: 'Đã nhận/Hoàn thành', value: completedAssignments, color: '#10B981' }, // Green
    { name: 'Đã gửi', value: submittedAssignments, color: '#FBBF24' }, // Yellow
    { name: 'Chưa làm', value: Math.max(0, totalStudentAssignments - completedAssignments - submittedAssignments), color: '#D1D5DB' }, // Gray
  ].filter(d => d.value > 0), [completedAssignments, submittedAssignments, totalStudentAssignments]);

  const sortedStudents = React.useMemo(() => {
    return [...allStudents].map(s => {
      // Find group name from practiceGroups
      let pgName = course?.studentGroups?.[s.id] || '';
      if (!pgName && course?.practiceGroups) {
        const groupEntry = Object.entries(course.practiceGroups).find(([_, g]: any) => g.members.includes(s.id));
        if (groupEntry) pgName = (groupEntry[1] as any).name;
      }

      return {
        ...s,
        practiceGroup: pgName,
        firstName: getFirstName(s.fullName)
      };
    }).sort((a, b) => {
      let valA = a[sortConfig.key as keyof typeof a] || '';
      let valB = b[sortConfig.key as keyof typeof b] || '';
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (sortConfig.key === 'practiceGroup') {
        valA = a.practiceGroup || 'zzzz';
        valB = b.practiceGroup || 'zzzz';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allStudents, course?.studentGroups, course?.practiceGroups, sortConfig]);

  if (!course) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

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
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{course.name} - Học phần {course.coursePart || 'N/A'}</h1>
              {courseCompleted && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Đã hoàn thành
                </span>
              )}
            </div>
            {course.description && <p className="mt-2 text-gray-600">{course.description}</p>}
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenEditCourse}
              className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="Sửa thông tin Lớp"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>
        
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`${activeTab === 'assignments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <FileText className="mr-2 h-4 w-4" />
            Bài tập
          </button>
          
          <button
            onClick={() => setActiveTab('students')}
            className={`${activeTab === 'students' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Users className="mr-2 h-4 w-4" />
            Học viên & Điểm danh
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`${activeTab === 'progress' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Tiến độ học phần
          </button>
        </nav>
      </div>

      {/* Tab Content: Assignments */}
      {activeTab === 'assignments' && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              Danh sách Bài tập
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
                  onClick={() => setShowManageGroups(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Quản lý Nhóm TH
                </button>
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
                const currentProgress = progressData[asg.id] || {};
                const currentStatus = currentProgress.status || 'in_progress';
                
                return (
                  <div key={asg.id} className="bg-white shadow-sm border border-gray-200 rounded-lg p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {asg.title}
                          {currentProgress.groupName && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              {currentProgress.groupName}
                            </span>
                          )}
                        </h3>
                        {asg.description && <p className="mt-1 text-gray-600 whitespace-pre-wrap text-sm">{asg.description}</p>}
                      </div>
                      
                    <div className="w-full sm:w-48 flex-shrink-0">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Hình thức: {asg.type === 'group' ? 'Nhóm' : 'Cá nhân'}
                        </label>
                        <select
                          value={currentStatus}
                          onChange={(e) => updateProgress(asg.id, e.target.value)}
                          disabled={currentStatus === 'received' || (currentStatus === 'completed' && !canManageAssignments)}
                          className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border ${STATUS_COLORS[currentStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS['not_started']}`}
                        >
                          <option value="in_progress">Đang làm</option>
                          <option value="completed">Sinh viên: Đã xong</option>
                          <option value="submitted">Sinh viên: Đã nộp bài</option>
                          <option value="received" disabled={!canManageAssignments} className={!canManageAssignments ? "text-gray-400" : ""}>Cán sự: Đã nhận bài</option>
                          <option value="completed" disabled={!canManageAssignments} className={!canManageAssignments ? "text-gray-400" : ""}>Cán sự: Đã duyệt xong</option>
                        </select>
                        {currentStatus === 'received' && (
                          <p className="mt-1 text-xs text-indigo-600 font-medium">Cán sự đã xác nhận nhận bài</p>
                        )}
                        {currentStatus === 'completed' && (
                          <p className="mt-1 text-xs text-green-600 font-medium">Hoàn thành / Đã duyệt</p>
                        )}
                      </div>
                    </div>

                    {canManageAssignments && (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                        <div className="flex gap-4 border-r border-gray-200 pr-4">
                          <button
                            onClick={() => openEditAssignment(asg)}
                            className="text-sm font-medium text-gray-600 hover:text-blue-600"
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(asg.id)}
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                          >
                            Xóa
                          </button>
                        </div>
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
        </>
      )}

      {/* Tab Content: Students */}
      {activeTab === 'students' && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Danh sách sinh viên lớp ({allStudents.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    STT
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('firstName')}>
                    Họ và tên {sortConfig.key === 'firstName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('id')}>
                    Mã SV {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('practiceGroup')}>
                    Nhóm TH {sortConfig.key === 'practiceGroup' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lớp truyền thống</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số điện thoại</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đơn vị công tác</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Điểm danh</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">Chưa có sinh viên nào trong lớp.</td>
                  </tr>
                ) : (
                  sortedStudents.map((student, index) => {
                    const isCheckedIn = allCheckIns.includes(student.id);
                    return (
                      <tr key={student.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.fullName}
                          {course.monitors?.includes(student.id) && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Cán sự
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {canManageAssignments ? (
                            editingGroup?.studentId === student.id ? (
                                <input
                                  type="text"
                                  autoFocus
                                  defaultValue={student.practiceGroup}
                                  className="w-20 px-2 py-1 text-sm border border-blue-500 rounded outline-none flex"
                                  onBlur={(e) => handleUpdatePracticeGroup(student.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdatePracticeGroup(student.id, e.currentTarget.value);
                                    if (e.key === 'Escape') setEditingGroup(null);
                                  }}
                                  disabled={updatingGroup}
                                />
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded border border-transparent hover:border-gray-300 min-h-[28px] flex items-center"
                                onClick={() => setEditingGroup({studentId: student.id, value: student.practiceGroup})}
                              >
                                {student.practiceGroup || <span className="text-gray-400 italic">Chưa phân</span>}
                              </div>
                            )
                          ) : (
                            student.practiceGroup || <span className="text-gray-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.traditionalClass || <span className="text-gray-400 italic">Chưa điền</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.phoneNumber || <span className="text-gray-400 italic">Chưa điền</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.workplace || <span className="text-gray-400 italic">Chưa điền</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {isAdmin ? (
                            <button
                              onClick={() => handleAdminToggleCheckIn(student.id, student.studentId, isCheckedIn)}
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${isCheckedIn ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                            >
                              {isCheckedIn ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Clock className="h-4 w-4 mr-1" />}
                              {isCheckedIn ? 'Đã điểm danh' : 'Chưa điểm danh'}
                            </button>
                          ) : (
                            isCheckedIn ? (
                              <span className="text-green-600 font-medium inline-flex items-center"><CheckCircle2 className="h-4 w-4 mr-1" /> Có mặt</span>
                            ) : (
                              <span className="text-gray-400 inline-flex items-center"><Clock className="h-4 w-4 mr-1" /> Vắng</span>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Progress */}
      {activeTab === 'progress' && (
        <div className="space-y-8">
          {/* Overview Section */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">Tổng quan Tiến độ</h2>
              <p className="mt-1 text-sm text-gray-500">
                Thống kê tổng mức độ hoàn thành các bài tập của toàn bộ sinh viên.
              </p>
              
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-blue-600">{completionPercentage}%</span>
                <span className="text-sm font-medium text-gray-500">hoàn thành toàn lớp</span>
              </div>
              
              <div className="mt-2 text-sm text-gray-500">
                {completedAssignments} / {totalStudentAssignments} lượt nộp bài
              </div>

              {canManageAssignments && !courseCompleted && (
                <div className="mt-6">
                  <button
                    onClick={markCourseCompleted}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Đánh dấu Hoàn thành Môn học
                  </button>
                </div>
              )}
              {courseCompleted && (
                <div className="mt-6 inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Môn học đã được hoàn thành
                </div>
              )}
            </div>

            {totalStudentAssignments > 0 && chartData.length > 0 && (
              <div className="h-56 w-full md:w-80 flex flex-col items-center">
                 <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} bài`, '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs font-medium text-gray-500">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                      {d.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Per Assignment Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map(asg => {
              const asgProg = allProgress.filter(p => p.assignmentId === asg.id && allStudents.some(s => s.id === p.userId));
              const done = asgProg.filter(p => p.status === 'completed' || p.status === 'received').length;
              const submitted = asgProg.filter(p => p.status === 'submitted').length;
              const working = Math.max(0, allStudents.length - done - submitted);
              
              const asgData = [
                { name: 'Xong', value: done, color: '#10B981' },
                { name: 'Đã nộp', value: submitted, color: '#FBBF24' },
                { name: 'Đang làm', value: working, color: '#3B82F6' }
              ].filter(d => d.value > 0);

              const asgDonePercent = Math.round((done / allStudents.length) * 100) || 0;

              return (
                <div key={asg.id} className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex flex-col">
                  <h4 className="font-bold text-gray-800 line-clamp-1 h-6 mb-1">{asg.title}</h4>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-4">
                    {asg.type === 'group' ? 'Bài tập Nhóm' : 'Bài tập Cá nhân'}
                  </p>
                  
                  <div className="h-40 w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={asgData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={55}
                          dataKey="value"
                        >
                          {asgData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} SV`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-auto space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Hoàn thành</span>
                      <span className="font-bold text-gray-900">{asgDonePercent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${asgDonePercent}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Progress Table */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">Chi tiết Tiến độ từng Sinh viên</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Học phẩm & Nhóm</th>
                    {assignments.map(asg => (
                      <th key={asg.id} scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider min-w-[120px]">
                        {asg.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedStudents.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{student.fullName}</div>
                        <div className="text-xs text-gray-500">
                          {student.id} • {student.practiceGroup || <span className="italic text-gray-400">Chưa phân nhóm</span>}
                        </div>
                      </td>
                      {assignments.map(asg => {
                        const prog = allProgress.find(p => p.assignmentId === asg.id && p.userId === student.id);
                        const status = prog?.status || 'in_progress';
                        
                        return (
                          <td key={asg.id} className="px-4 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}`}>
                              {status === 'completed' ? 'Xong' : 
                               status === 'received' ? 'Đã nhận' :
                               status === 'submitted' ? 'Đã nộp' :
                               'Đang làm'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddAssignment && canManageAssignments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <form onSubmit={handleCreateAssignment} className="flex flex-col max-h-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Thêm Bài tập mới
                </h3>
              </div>
              <div className="px-6 py-4 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tiêu đề bài tập</label>
                  <input
                    type="text"
                    required
                    value={newAsgTitle}
                    onChange={e => setNewAsgTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: Viết báo cáo thực hành"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hình thức Bài tập</label>
                  <select
                    value={newAsgType}
                    onChange={e => setNewAsgType(e.target.value as 'individual' | 'group')}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="individual">Cá nhân</option>
                    <option value="group">Theo Nhóm thực hành</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hướng dẫn chi tiết</label>
                  <textarea
                    value={newAsgDesc}
                    onChange={e => setNewAsgDesc(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddAssignment(false)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingAsg}
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {creatingAsg ? 'Đang tạo...' : 'Tạo Bài tập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && canManageAssignments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <form onSubmit={handleUpdateAssignment} className="flex flex-col max-h-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Sửa Thông tin Bài tập
                </h3>
              </div>
              <div className="px-6 py-4 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tiêu đề bài tập</label>
                  <input
                    type="text"
                    required
                    value={editAsgTitle}
                    onChange={e => setEditAsgTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hướng dẫn chi tiết</label>
                  <textarea
                    value={editAsgDesc}
                    onChange={e => setEditAsgDesc(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updatingAsg}
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {updatingAsg ? 'Đang lưu...' : 'Lưu Thay đổi'}
                </button>
              </div>
            </form>
          </div>
         </div>
      )}

      {/* Manage Practice Groups Modal */}
      {showManageGroups && canManageAssignments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Quản lý Nhóm thực hành</h3>
              <button onClick={() => setShowManageGroups(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* List Groups */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 flex items-center border-b pb-2">
                  <Users className="h-4 w-4 mr-2" />
                  Danh sách nhóm đã tạo
                </h4>
                {course.practiceGroups && Object.entries(course.practiceGroups).length > 0 ? (
                  Object.entries(course.practiceGroups as Record<string, any>).map(([id, group]) => (
                    <div key={id} className="p-3 border rounded-lg bg-gray-50 flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-800">{group.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {group.members.map((mId: string) => {
                            const student = allStudents.find(s => s.id === mId);
                            return (
                              <span key={mId} className="px-2 py-0.5 bg-white border rounded text-xs text-gray-600">
                                {student?.fullName || mId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeletePracticeGroup(id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">Chưa có nhóm nào được tạo.</p>
                )}
              </div>

              {/* Create Group Form */}
              <div className="space-y-4 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                <h4 className="font-semibold text-blue-800 flex items-center border-b border-blue-100 pb-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Tạo nhóm mới
                </h4>
                <form onSubmit={handleCreatePracticeGroup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tên nhóm</label>
                    <input 
                      type="text"
                      required
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="VD: Nhóm 1"
                      className="mt-1 block w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Chọn thành viên (Chỉ hiện SV chưa có nhóm)</label>
                    <div className="max-h-60 overflow-y-auto border rounded-md bg-white p-2">
                      {allStudents.filter(s => {
                        const allAssignedIds = Object.values(course.practiceGroups || {}).flatMap((g: any) => g.members);
                        return !allAssignedIds.includes(s.id);
                      }).map(student => {
                        const isSelected = selectedMembers.includes(student.id);
                        return (
                          <label key={student.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedMembers(prev => prev.filter(id => id !== student.id));
                                } else {
                                  setSelectedMembers(prev => [...prev, student.id]);
                                }
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-3 text-sm text-gray-700">{student.fullName} ({student.id})</span>
                          </label>
                        );
                      })}
                      {allStudents.filter(s => {
                        const allAssignedIds = Object.values(course.practiceGroups || {}).flatMap((g: any) => g.members);
                        return !allAssignedIds.includes(s.id);
                      }).length === 0 && (
                        <p className="text-sm text-gray-500 italic p-2">Tất cả sinh viên đã được phân vào nhóm.</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingGroup || !newGroupName.trim() || selectedMembers.length === 0}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creatingGroup ? 'Đang tạo...' : 'Tạo nhóm'}
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
              <button
                onClick={() => setShowManageGroups(false)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {showEditCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <form onSubmit={handleUpdateCourse} className="flex flex-col max-h-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Sửa thông tin Lớp học phần
                </h3>
              </div>
              <div className="px-6 py-4 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tên Môn học</label>
                    <input
                      type="text"
                      required
                      value={editCourseName}
                      onChange={e => setEditCourseName(e.target.value)}
                      className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Học phần mấy</label>
                    <input
                      type="text"
                      required
                      value={editCoursePart}
                      onChange={e => setEditCoursePart(e.target.value)}
                      className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mô tả chi tiết</label>
                  <textarea
                    value={editCourseDesc}
                    onChange={e => setEditCourseDesc(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Link Nhóm Zalo (Tùy chọn)</label>
                  <input
                    type="url"
                    value={editCourseZalo}
                    onChange={e => setEditCourseZalo(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Danh sách Sinh viên (Bắt buộc)</label>
                  <p className="text-xs text-gray-500 mb-1">Nhập các Mã sinh viên, cách nhau bởi dấu phẩy, khoảng trắng hoặc xuống dòng.</p>
                  <textarea
                    required
                    value={editCourseStudents}
                    onChange={e => setEditCourseStudents(e.target.value)}
                    className="mt-1 block w-full rounded-md sm:text-sm border-gray-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    rows={5}
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEditCourse(false)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updatingCourse}
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {updatingCourse ? 'Đang lưu...' : 'Lưu Thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
