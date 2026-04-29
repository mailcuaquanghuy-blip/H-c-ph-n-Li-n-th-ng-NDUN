/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './ErrorBoundary';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';
import AssignmentStats from './pages/AssignmentStats';
import CourseMonitors from './pages/CourseMonitors';
import Users from './pages/Users';
import './index.css';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Courses />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/users" element={<Users />} />
              <Route path="/courses/:courseId" element={<CourseDetails />} />
              <Route path="/courses/:courseId/monitors" element={<CourseMonitors />} />
              <Route path="/courses/:courseId/assignments/:assignmentId/stats" element={<AssignmentStats />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

