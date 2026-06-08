import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import { Login, Setup } from './pages/Login';
import Instances from './pages/Instances';
import InstanceDetail from './pages/InstanceDetail';

export default function App() {
  const { loading, needsSetup, authenticated } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <Spinner size={32} />
      </div>
    );
  }
  if (needsSetup) return <Setup />;
  if (!authenticated) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Instances />} />
        <Route path="/instances/:id" element={<InstanceDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
