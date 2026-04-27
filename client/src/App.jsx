import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const StudentAnalytics = lazy(() => import('./pages/StudentAnalytics'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const AdminClasses = lazy(() => import('./pages/AdminClasses'));
const AdminSubjects = lazy(() => import('./pages/AdminSubjects'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminQuestions = lazy(() => import('./pages/AdminQuestions'));
const AdminExams = lazy(() => import('./pages/AdminExams'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const BatchAnalytics = lazy(() => import('./pages/admin/BatchAnalytics'));
const ExamView = lazy(() => import('./pages/ExamView'));
const ExamResultPage = lazy(() => import('./pages/ExamResultPage'));
const Profile = lazy(() => import('./pages/Profile'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const AdaptiveTest = lazy(() => import('./pages/AdaptiveTest'));
const TestAnalysis = lazy(() => import('./pages/TestAnalysis'));
const ExamsPage = lazy(() => import('./pages/ExamsPage'));
const ExamHistory = lazy(() => import('./pages/ExamHistory'));

function PageFallback() {
  return (
    <div className="container" style={{ paddingTop: '2rem', minHeight: '40vh' }}>
      <LoadingSpinner />
    </div>
  );
}

function AppNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigate = (event) => {
      const to = event?.detail?.to || '/login';
      navigate(to, {
        replace: event?.detail?.replace ?? true,
        state: event?.detail?.state,
      });
    };

    window.addEventListener('app:navigate', handleNavigate);
    return () => window.removeEventListener('app:navigate', handleNavigate);
  }, [navigate]);

  return null;
}

function renderRoute(element) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppNavigationBridge />
        <Header />
        <Toast />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={renderRoute(<Login />)} />
            <Route path="/register" element={renderRoute(<Register />)} />
            <Route path="/verify-email" element={renderRoute(<VerifyEmail />)} />
            <Route path="/forgot-password" element={renderRoute(<ForgotPassword />)} />
            <Route path="/reset-password" element={renderRoute(<ResetPassword />)} />

            <Route path="/dashboard" element={renderRoute(<ProtectedRoute><StudentDashboard /></ProtectedRoute>)} />
            <Route path="/exams" element={renderRoute(<ProtectedRoute><ExamsPage /></ProtectedRoute>)} />
            <Route path="/analytics" element={renderRoute(<ProtectedRoute><StudentAnalytics /></ProtectedRoute>)} />
            <Route path="/history" element={renderRoute(<ProtectedRoute><ExamHistory /></ProtectedRoute>)} />
            <Route path="/profile" element={renderRoute(<ProtectedRoute><Profile /></ProtectedRoute>)} />
            <Route path="/profile/password" element={renderRoute(<ProtectedRoute><ChangePassword /></ProtectedRoute>)} />
            <Route path="/exam/:examId" element={renderRoute(<ProtectedRoute><ExamView /></ProtectedRoute>)} />
            <Route path="/result/:attemptId" element={renderRoute(<ProtectedRoute><ExamResultPage /></ProtectedRoute>)} />
            <Route path="/analysis/:attemptId" element={renderRoute(<ProtectedRoute><TestAnalysis /></ProtectedRoute>)} />
            <Route path="/adaptive-test" element={renderRoute(<ProtectedRoute><AdaptiveTest /></ProtectedRoute>)} />

            <Route path="/admin" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>)} />
            <Route path="/admin/dashboard" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>)} />
            <Route path="/admin/users" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>)} />
            <Route path="/admin/classes" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminClasses /></ProtectedRoute>)} />
            <Route path="/admin/subjects" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminSubjects /></ProtectedRoute>)} />
            <Route path="/admin/questions" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminQuestions /></ProtectedRoute>)} />
            <Route path="/admin/exams" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminExams /></ProtectedRoute>)} />
            <Route path="/admin/reports" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminReports /></ProtectedRoute>)} />
            <Route path="/admin/analytics" element={renderRoute(<ProtectedRoute roles={["admin"]}><BatchAnalytics /></ProtectedRoute>)} />

            <Route path="/teacher" element={renderRoute(<ProtectedRoute roles={["teacher"]}><TeacherDashboard /></ProtectedRoute>)} />
            <Route path="/teacher/dashboard" element={renderRoute(<ProtectedRoute roles={["teacher"]}><TeacherDashboard /></ProtectedRoute>)} />
            <Route path="/teacher/questions" element={renderRoute(<ProtectedRoute roles={["teacher"]}><AdminQuestions /></ProtectedRoute>)} />
            <Route path="/teacher/exams" element={renderRoute(<ProtectedRoute roles={["teacher"]}><AdminExams /></ProtectedRoute>)} />
            <Route path="/teacher/reports" element={renderRoute(<ProtectedRoute roles={["teacher"]}><AdminReports /></ProtectedRoute>)} />
            <Route path="/teacher/analytics" element={renderRoute(<ProtectedRoute roles={["teacher"]}><BatchAnalytics /></ProtectedRoute>)} />

            <Route path="*" element={<div style={{ padding: 24 }}>404 - Not Found</div>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
