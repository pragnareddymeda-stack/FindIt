import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { RealtimeProvider } from './context/RealtimeContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RealtimeProvider>
          <Navbar />
          <AppRoutes />
          <Footer />
        </RealtimeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
