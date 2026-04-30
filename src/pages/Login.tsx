import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router';
import { LogIn, GraduationCap, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Login() {
  const { currentUser, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'admin' && username.toLowerCase() !== 'admin') {
        throw new Error('Chỉ tài khoản Admin mới đăng nhập được ở tab này');
      }
      await login(username, password);
      // login successful, the Navigate component will redirect
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mt-8">
        <div className="flex justify-center">
          {activeTab === 'student' ? (
            <GraduationCap className="h-12 w-12 text-blue-600" />
          ) : (
            <ShieldCheck className="h-12 w-12 text-purple-600" />
          )}
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Class Manager
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Hệ thống quản lý Lớp học phần
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setActiveTab('student');
                setUsername('');
                setPassword('');
                setError(null);
              }}
              className={cn(
                "w-full py-2 text-sm font-medium rounded-md",
                activeTab === 'student' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Sinh viên
            </button>
            <button
              onClick={() => {
                setActiveTab('admin');
                setUsername('');
                setPassword('');
                setError(null);
              }}
              className={cn(
                "w-full py-2 text-sm font-medium rounded-md",
                activeTab === 'admin' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Quản trị viên
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {activeTab === 'student' ? 'Mã sinh viên' : 'Tên đăng nhập'}
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={activeTab === 'student' ? 'Nhập mã sinh viên (VD: 2401388)' : 'Nhập tên đăng nhập admin'}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={activeTab === 'student' ? 'Mặc định: 123456' : ''}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 items-center transition-colors mt-6",
                activeTab === 'student' 
                  ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500" 
                  : "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500",
                loading ? "opacity-75 cursor-not-allowed" : ""
              )}
            >
              <LogIn className="w-5 h-5 mr-2" />
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            {activeTab === 'student' 
              ? "Dành cho sinh viên tham gia lớp học phần và điểm danh."
              : "Dành cho ban quản trị hệ thống để quản lý lớp."}
          </div>
        </div>
      </div>
    </div>
  );
}
