import { Routes, Route } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout.jsx';
import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import AdminReports from '../pages/admin/AdminReports.jsx';
import AdminUsers from '../pages/admin/AdminUsers.jsx';
import AdminAbuseReports from '../pages/admin/AdminAbuseReports.jsx';
import AdminDisputes from '../pages/admin/AdminDisputes.jsx';
import AdminAuditLogs from '../pages/admin/AdminAuditLogs.jsx';
import Landing from '../pages/Landing.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import Profile from '../pages/Profile.jsx';
import Browse from '../pages/Browse.jsx';
import ItemDetails from '../pages/ItemDetails.jsx';
import CreateReport from '../pages/CreateReport.jsx';
import EditReport from '../pages/EditReport.jsx';
import MyReports from '../pages/MyReports.jsx';
import ClaimForm from '../pages/ClaimForm.jsx';
import ClaimDetails from '../pages/ClaimDetails.jsx';
import MyClaims from '../pages/MyClaims.jsx';
import IncomingClaims from '../pages/IncomingClaims.jsx';
import MatchSuggestions from '../pages/MatchSuggestions.jsx';
import MyHandovers from '../pages/MyHandovers.jsx';
import HandoverDetails from '../pages/HandoverDetails.jsx';
import Conversations from '../pages/Conversations.jsx';
import Chat from '../pages/Chat.jsx';
import Notifications from '../pages/Notifications.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import Safety from '../pages/Safety.jsx';
import NotFound from '../pages/NotFound.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

const guard = (el) => <ProtectedRoute>{el}</ProtectedRoute>;

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/safety" element={<Safety />} />
      <Route path="/dashboard" element={guard(<Dashboard />)} />
      <Route path="/items" element={<Browse />} />
      <Route path="/items/:id" element={<ItemDetails />} />
      <Route path="/items/:id/edit" element={guard(<EditReport />)} />
      <Route path="/items/:id/claim" element={guard(<ClaimForm />)} />
      <Route path="/items/:id/matches" element={guard(<MatchSuggestions />)} />
      <Route path="/claims/:id" element={guard(<ClaimDetails />)} />
      <Route path="/my-claims" element={guard(<MyClaims />)} />
      <Route path="/incoming-claims" element={guard(<IncomingClaims />)} />
      <Route path="/handovers" element={guard(<MyHandovers />)} />
      <Route path="/handovers/:id" element={guard(<HandoverDetails />)} />
      <Route path="/conversations" element={guard(<Conversations />)} />
      <Route path="/conversations/:id" element={guard(<Chat />)} />
      <Route path="/notifications" element={guard(<Notifications />)} />
      <Route path="/report/lost" element={guard(<CreateReport type="LOST" />)} />
      <Route path="/report/found" element={guard(<CreateReport type="FOUND" />)} />
      <Route path="/my-reports" element={guard(<MyReports />)} />
      <Route path="/profile" element={guard(<Profile />)} />
      <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="abuse-reports" element={<AdminAbuseReports />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
