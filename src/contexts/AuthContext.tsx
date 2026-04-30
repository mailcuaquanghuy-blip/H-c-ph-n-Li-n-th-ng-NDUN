import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export type UserProfile = {
  id: string; // Map to doc ID (Mã SV or Admin)
  fullName: string;
  studentId: string;
  role: 'student' | 'admin';
  phoneNumber?: string;
  workplace?: string;
  password?: string;
  isPasswordChanged?: boolean;
  createdAt?: any;
};

interface AuthContextType {
  currentUser: { uid: string } | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Always ensure we have an anonymous Firebase session so Firestore works
    signInAnonymously(auth).then(async (userCredential) => {
      const firebaseUid = userCredential.user.uid;
      
      // 2. Check local session
      const savedUsername = localStorage.getItem('loggedInUser');
      if (savedUsername) {
        try {
          const userDoc = await getDoc(doc(db, 'users', savedUsername));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setUserProfile({ ...data, id: userDoc.id });
            setCurrentUser({ uid: userDoc.id });
            
            // Register this session uid to allow secure rules logic if we used it
            await updateDoc(doc(db, 'users', savedUsername), {
              sessionUids: arrayUnion(firebaseUid)
            });
          } else {
            localStorage.removeItem('loggedInUser');
          }
        } catch (error) {
          console.error("Session restore error", error);
        }
      }
      setLoading(false);
    }).catch(err => {
      console.error("Anonymous auth failed", err);
      setLoading(false);
    });
  }, []);

  const login = async (usernameInput: string, passwordInput: string) => {
    try {
      // Normalize 'admin' username to 'Admin' and trim whitespaces
      const cleanInput = usernameInput.trim();
      const username = cleanInput.toLowerCase() === 'admin' ? 'Admin' : cleanInput;
      let userDoc = await getDoc(doc(db, 'users', username));
      
      // Bootstrap the Admin account if it does not exist
      if (!userDoc.exists() && username === 'Admin' && passwordInput === 'Huyhuyhuy2.') {
        const adminData = {
          fullName: 'Administrator',
          studentId: 'Admin',
          role: 'admin',
          password: 'Huyhuyhuy2.',
          sessionUids: [],
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', 'Admin'), adminData);
        userDoc = await getDoc(doc(db, 'users', username));
      }

      if (!userDoc.exists()) {
        throw new Error('Tài khoản không tồn tại. Nếu bạn là sinh viên mới, Vui lòng liên hệ Admin để khởi tạo dữ liệu.');
      }

      const data = userDoc.data();
      if (data?.password !== passwordInput) {
        throw new Error('Sai mật khẩu!');
      }

      const firebaseUid = auth.currentUser?.uid;
      if (firebaseUid) {
        await updateDoc(doc(db, 'users', username), {
          sessionUids: arrayUnion(firebaseUid)
        });
      }

      setUserProfile({ ...data, id: userDoc.id } as UserProfile);
      setCurrentUser({ uid: userDoc.id });
      localStorage.setItem('loggedInUser', username);
    } catch (error: any) {
      if (error.message === 'Sai mật khẩu!' || error.message.includes('không tồn tại')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.GET, `users/${usernameInput}`);
      throw new Error('Lỗi hệ thống khi đăng nhập');
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setUserProfile(null);
    localStorage.removeItem('loggedInUser');
    window.location.href = '/login';
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      
      const updatedDoc = await getDoc(userRef);
      setUserProfile({ ...updatedDoc.data(), id: updatedDoc.id } as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, login, logout, updateProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
