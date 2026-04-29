import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Users as UsersIcon, Database, RefreshCw } from 'lucide-react';
import { Navigate } from 'react-router';
import { studentsCSV } from '../lib/students-data';

export default function Users() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  if (userProfile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
       // Filter out raw Admin if you want or leave it
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      if (userProfile.role !== 'admin') return;
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn reset mật khẩu cho [${userId}] về 123456 không?`)) return;
    try {
      if (userProfile.role !== 'admin') return;
      await updateDoc(doc(db, 'users', userId), { 
        password: '123456',
        isPasswordChanged: false
      });
      alert('Đã reset mật khẩu thành công!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleSeedData = async () => {
    if (!window.confirm('Khởi tạo dữ liệu sinh viên từ file CSV? (Chỉ thực hiện lần đầu)')) return;
    setSeeding(true);
    try {
      const rows = studentsCSV.trim().split('\n').slice(1); // skip header
      const batchList: any[] = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      // Ensure Admin exists
      currentBatch.set(doc(db, 'users', 'Admin'), {
        fullName: 'Administrator',
        studentId: 'Admin',
        role: 'admin',
        password: 'Huyhuyhuy2.',
        createdAt: new Date().toISOString()
      }, { merge: true });
      count++;

      for (const row of rows) {
        if (!row.trim()) continue;
        const [rawId, firstName, lastName] = row.split(',');
        const id = rawId.trim();
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        
        currentBatch.set(doc(db, 'users', id), {
          fullName,
          studentId: id,
          role: 'student',
          password: '123456',
          phoneNumber: '',
          workplace: '',
          isPasswordChanged: false,
          createdAt: new Date().toISOString()
        }, { merge: true });
        
        count++;
        if (count >= 400) { // Firestore batch limit is 500
          batchList.push(currentBatch);
          currentBatch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        batchList.push(currentBatch);
      }

      for (const b of batchList) {
        await b.commit();
      }

      alert('Đã khởi tạo dữ liệu thành công!');
    } catch (err: any) {
      console.error(err);
      alert('Lỗi khởi tạo: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <UsersIcon className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Tài khoản</h1>
            <p className="mt-1 text-sm text-gray-500">
              Xem danh sách, phân quyền và reset mật khẩu sinh viên.
            </p>
          </div>
        </div>
        <div>
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Database className="mr-2 h-4 w-4" />
            {seeding ? 'Đang khởi tạo...' : 'Khởi tạo Dữ liệu gốc'}
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ và tên</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Đăng Nhập (MSV)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mật khẩu</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vai trò</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Đang tải...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chưa có dữ liệu. Vui lòng bấm "Khởi tạo Dữ liệu gốc".</td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.fullName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.password === '123456' ? (
                        <span className="text-gray-400">Mặc định</span>
                      ) : (
                        <span className="text-green-600 font-medium">Đã đổi</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="mt-1 block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                      >
                        <option value="student">Sinh viên</option>
                        <option value="admin">Quản trị viên</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                       <button
                         onClick={() => handleResetPassword(user.id)}
                         className="inline-flex items-center text-red-600 hover:text-red-900"
                       >
                         <RefreshCw className="mr-1 h-4 w-4" /> Reset Pass
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
