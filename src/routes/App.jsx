import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import SignUpPage from "../pages/SignUpPage";
import DashboardPage from "../pages/DashboardPage";
import NotesPage from "../pages/NotesPage";
import UploadPage from "../pages/UploadPage";
import LinksPage from "../pages/LinksPage";
import ChatPage from "../pages/ChatPage";
import SearchPage from "../pages/SearchPage";
import InsightsPage from "../pages/InsightsPage";
import ProfilePage from "../pages/ProfilePage";

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
