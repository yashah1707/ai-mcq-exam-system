import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Toast from './components/Toast';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import StudentDashboard from './pages/StudentDashboard';
import StudentAnalytics from './pages/StudentAnalytics';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminQuestions from './pages/AdminQuestions';
import AdminExams from './pages/AdminExams';
import AdminReports from './pages/AdminReports';
import BatchAnalytics from './pages/admin/BatchAnalytics';
import ExamPage from './pages/ExamPage';
import ExamResult from './pages/ExamResult';
import ExamHistory from './pages/ExamHistory';
import ExamView from './pages/ExamView';
import ExamResultPage from './pages/ExamResultPage';
import Profile from './pages/Profile';
import AdaptiveTest from './pages/AdaptiveTest';
import TestAnalysis from './pages/TestAnalysis';
import ExamsPage from './pages/ExamsPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Toast />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/exams" element={<ProtectedRoute><ExamsPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><StudentAnalytics /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/exam/:examId" element={<ProtectedRoute><ExamView /></ProtectedRoute>} />
            <Route path="/result/:attemptId" element={<ProtectedRoute><ExamResultPage /></ProtectedRoute>} />
            <Route path="/analysis/:attemptId" element={<ProtectedRoute><TestAnalysis /></ProtectedRoute>} />
            <Route path="/adaptive-test" element={<ProtectedRoute><AdaptiveTest /></ProtectedRoute>} />

            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/questions" element={<ProtectedRoute roles={["admin"]}><AdminQuestions /></ProtectedRoute>} />
            <Route path="/admin/exams" element={<ProtectedRoute roles={["admin"]}><AdminExams /></ProtectedRoute>} />
            <Route path="/admin/exams" element={<ProtectedRoute roles={["admin"]}><AdminExams /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReports /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute roles={["admin"]}><BatchAnalytics /></ProtectedRoute>} />

            <Route path="*" element={<div style={{ padding: 24 }}>404 - Not Found</div>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
