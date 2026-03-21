import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Document from './pages/Document';
import ChangeRequests from './pages/ChangeRequests';
import ChangeRequestDetail from './pages/ChangeRequestDetail';
import Admin from './pages/Admin';
import Verify from './pages/Verify';
import SetupPassword from './pages/SetupPassword';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LandingRedirect from './components/LandingRedirect';
import Legal from './pages/Legal';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/setup-password" element={<SetupPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/legal/:page" element={<Legal />} />
          <Route element={<Layout />}>
            <Route path="/home" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/document/*" element={<Document />} />
            <Route path="/activity" element={<ChangeRequests />} />
            <Route path="/changes/:id" element={<ChangeRequestDetail />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
