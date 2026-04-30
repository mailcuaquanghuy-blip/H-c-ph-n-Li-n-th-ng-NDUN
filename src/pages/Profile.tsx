import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Save } from 'lucide-react';
import { Navigate } from 'react-router';

export default function Profile() {
  const { userProfile, updateProfile } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [traditionalClass, setTraditionalClass] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (userProfile) {
      setPhoneNumber(userProfile.phoneNumber || '');
      setWorkplace(userProfile.workplace || '');
      setTraditionalClass(userProfile.traditionalClass || '');
      setPassword(userProfile.password || '');
    }
  }, [userProfile]);

  if (!userProfile) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const updates: any = {
        phoneNumber,
        workplace,
        traditionalClass,
      };

      if (password && password !== userProfile.password) {
        updates.password = password;
        updates.isPasswordChanged = true;
      }

      await updateProfile(updates);
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi lưu thông tin.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="bg-blue-100 p-3 rounded-full">
          <UserCircle className="h-8 w-8 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thông tin cá nhân</h1>
          <p className="mt-1 text-sm text-gray-500">
            Xem và cập nhật thông tin liên hệ, mật khẩu.
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {message.text && (
            <div className={`px-4 py-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Họ và tên (Không thể đổi)</label>
              <div className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm sm:text-sm text-gray-500">
                {userProfile.fullName}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">{userProfile.role === 'admin' ? 'Tên đăng nhập' : 'Mã sinh viên (Không thể đổi)'}</label>
              <div className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm sm:text-sm text-gray-500">
                {userProfile.id}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="traditionalClass" className="block text-sm font-medium text-gray-700">
                Lớp truyền thống
              </label>
              <div className="mt-1">
                <input
                  id="traditionalClass"
                  type="text"
                  value={traditionalClass}
                  onChange={(e) => setTraditionalClass(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Nhập lớp truyền thống (VD: K64A2)"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                Số điện thoại
              </label>
              <div className="mt-1">
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Nhập số điện thoại"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="workplace" className="block text-sm font-medium text-gray-700">
                Đơn vị công tác
              </label>
              <div className="mt-1">
                <input
                  id="workplace"
                  type="text"
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Nhập đơn vị công tác"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mật khẩu (Đổi mật khẩu)
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Để đảm bảo an toàn, hãy đổi mật khẩu mặc định nếu bạn chưa làm vậy.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Đang lưu...' : 'Lưu cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
