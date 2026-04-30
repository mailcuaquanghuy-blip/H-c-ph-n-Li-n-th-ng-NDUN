import React from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, User as UserIcon, Users, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function DashboardLayout() {
  const { currentUser, userProfile, logout } = useAuth();
  const location = useLocation();
  const [incompleteCount, setIncompleteCount] = React.useState(0);

  React.useEffect(() => {
    if (!currentUser || userProfile?.role !== 'student') return;

    const fetchIncomplete = async () => {
      try {
        // Fetch courses the user is in
        const coursesSnap = await getDocs(query(collection(db, 'courses'), where('students', 'array-contains', currentUser.uid)));
        const monitorsSnap = await getDocs(query(collection(db, 'courses'), where('monitors', 'array-contains', currentUser.uid)));
        
        // Merge unique courses
        const courseIds = Array.from(new Set([
          ...coursesSnap.docs.map(doc => doc.id),
          ...monitorsSnap.docs.map(doc => doc.id)
        ]));

        let totalIncomplete = 0;

        for (const cId of courseIds) {
          const asgsSnap = await getDocs(collection(db, 'courses', cId, 'assignments'));
          for (const asgDoc of asgsSnap.docs) {
            const progressDoc = await getDocs(query(collection(db, 'courses', cId, 'assignments', asgDoc.id, 'progress'), where('__name__', '==', currentUser.uid)));
            const status = progressDoc.docs[0]?.data()?.status || 'not_started';
            // Statuses considered incomplete for student notification: not_started, in_progress, completed
            // (Prompt says "after finishing student selects completed and submitted", implying submitted is the final action for them)
            if (status === 'not_started' || status === 'in_progress') {
              totalIncomplete++;
            }
          }
        }
        setIncompleteCount(totalIncomplete);
      } catch (err) {
        console.error("Error counting incomplete assignments", err);
      }
    };

    fetchIncomplete();
  }, [currentUser, userProfile]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <BookOpen className="h-6 w-6 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Class Manager</span>
              </Link>

              {/* Navigation Links */}
              <nav className="hidden md:flex space-x-4">
                <Link
                  to="/"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium",
                    location.pathname === '/' || location.pathname.startsWith('/courses')
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <BookOpen className="h-4 w-4 inline-block mr-1.5" />
                  Lớp học
                </Link>
                {userProfile?.role === 'admin' && (
                  <Link
                    to="/users"
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium",
                      location.pathname === '/users'
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <Users className="h-4 w-4 inline-block mr-1.5" />
                    Sinh viên
                  </Link>
                )}
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3 text-sm text-gray-600">
                <Link to="/profile" className="flex items-center space-x-1 hover:text-blue-600">
                  <UserIcon className="h-4 w-4" />
                  <span>{userProfile?.fullName} ({userProfile?.studentId})</span>
                </Link>
                {userProfile?.role === 'admin' && (
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-medium">Admin</span>
                )}
              </div>
              <Link
                to="/profile"
                className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-gray-100"
                title="Cài đặt tài khoản"
              >
                <Settings className="h-5 w-5" />
              </Link>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100"
                title="Đăng xuất"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {incompleteCount > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-3" />
              <p className="text-sm text-amber-800 font-medium">
                Bạn đang có <span className="text-amber-900 font-bold">{incompleteCount} bài tập</span> chưa hoàn thành ở trạng thái "Đang làm". Vui lòng kiểm tra và nộp bài!
              </p>
            </div>
            <Link to="/" className="text-xs font-bold text-amber-700 hover:text-amber-800 uppercase tracking-wider">
              Xem ngay
            </Link>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
