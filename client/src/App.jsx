import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const StudentAnalytics = lazy(() => import('./pages/StudentAnalytics'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminQuestions = lazy(() => import('./pages/AdminQuestions'));
const AdminExams = lazy(() => import('./pages/AdminExams'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const BatchAnalytics = lazy(() => import('./pages/admin/BatchAnalytics'));
const ExamView = lazy(() => import('./pages/ExamView'));
const ExamResultPage = lazy(() => import('./pages/ExamResultPage'));
const Profile = lazy(() => import('./pages/Profile'));
const AdaptiveTest = lazy(() => import('./pages/AdaptiveTest'));
const TestAnalysis = lazy(() => import('./pages/TestAnalysis'));
const ExamsPage = lazy(() => import('./pages/ExamsPage'));

function PageFallback() {
  return (
    <div className="container" style={{ paddingTop: '2rem', minHeight: '40vh' }}>
      <LoadingSpinner />
    </div>
  );
}

function renderRoute(element) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Toast />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={renderRoute(<Login />)} />
            <Route path="/register" element={renderRoute(<Register />)} />
            <Route path="/verify-email" element={renderRoute(<VerifyEmail />)} />

            <Route path="/dashboard" element={renderRoute(<ProtectedRoute><StudentDashboard /></ProtectedRoute>)} />
            <Route path="/exams" element={renderRoute(<ProtectedRoute><ExamsPage /></ProtectedRoute>)} />
            <Route path="/analytics" element={renderRoute(<ProtectedRoute><StudentAnalytics /></ProtectedRoute>)} />
            <Route path="/profile" element={renderRoute(<ProtectedRoute><Profile /></ProtectedRoute>)} />
            <Route path="/exam/:examId" element={renderRoute(<ProtectedRoute><ExamView /></ProtectedRoute>)} />
            <Route path="/result/:attemptId" element={renderRoute(<ProtectedRoute><ExamResultPage /></ProtectedRoute>)} />
            <Route path="/analysis/:attemptId" element={renderRoute(<ProtectedRoute><TestAnalysis /></ProtectedRoute>)} />
            <Route path="/adaptive-test" element={renderRoute(<ProtectedRoute><AdaptiveTest /></ProtectedRoute>)} />

            <Route path="/admin" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>)} />
            <Route path="/admin/dashboard" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>)} />
            <Route path="/admin/users" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>)} />
            <Route path="/admin/questions" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminQuestions /></ProtectedRoute>)} />
            <Route path="/admin/exams" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminExams /></ProtectedRoute>)} />
            <Route path="/admin/reports" element={renderRoute(<ProtectedRoute roles={["admin"]}><AdminReports /></ProtectedRoute>)} />
            <Route path="/admin/analytics" element={renderRoute(<ProtectedRoute roles={["admin"]}><BatchAnalytics /></ProtectedRoute>)} />

            <Route path="*" element={<div style={{ padding: 24 }}>404 - Not Found</div>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
