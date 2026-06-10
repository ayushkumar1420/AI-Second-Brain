import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoute";

// Lazy load pages for faster initial load
const LandingPage = lazy(() => import("../pages/LandingPage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const SignUpPage = lazy(() => import("../pages/SignUpPage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const NotesPage = lazy(() => import("../pages/NotesPage"));
const UploadPage = lazy(() => import("../pages/UploadPage"));
const LinksPage = lazy(() => import("../pages/LinksPage"));
const ChatPage = lazy(() => import("../pages/ChatPage"));
const SearchPage = lazy(() => import("../pages/SearchPage"));
const InsightsPage = lazy(() => import("../pages/InsightsPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/app" element={<DashboardPage />} />
              <Route path="/app/notes" element={<NotesPage />} />
              <Route path="/app/upload" element={<UploadPage />} />
              <Route path="/app/links" element={<LinksPage />} />
              <Route path="/app/chat" element={<ChatPage />} />
              <Route path="/app/search" element={<SearchPage />} />
              <Route path="/app/insights" element={<InsightsPage />} />
              <Route path="/app/profile" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
