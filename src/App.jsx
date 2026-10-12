import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { PublicOnly, RequireAdmin, RequireAuth } from './components/Guards.jsx';
import { Loading } from './components/Ui.jsx';
import PlayerLayout from './layouts/PlayerLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Play from './pages/Play.jsx';
import Results from './pages/Results.jsx';
import Profile from './pages/Profile.jsx';
import History from './pages/History.jsx';
import Progress from './pages/Progress.jsx';
import Ranking from './pages/Ranking.jsx';
import Review from './pages/Review.jsx';
import Challenge from './pages/Challenge.jsx';
import Compare from './pages/Compare.jsx';
import ConfigMissing from './pages/ConfigMissing.jsx';

// El panel administrativo se carga bajo demanda: los jugadores nunca descargan ese código.
const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard.jsx'));
const AdminUsers = lazy(() => import('./admin/AdminUsers.jsx'));
const AdminCategories = lazy(() => import('./admin/AdminCategories.jsx'));
const AdminTopics = lazy(() => import('./admin/AdminTopics.jsx'));
const AdminQuestions = lazy(() => import('./admin/AdminQuestions.jsx'));
const AdminGames = lazy(() => import('./admin/AdminGames.jsx'));
const AdminAchievements = lazy(() => import('./admin/AdminAchievements.jsx'));
const AdminParameters = lazy(() => import('./admin/AdminParameters.jsx'));
const AdminFeedbacks = lazy(() => import('./admin/AdminFeedbacks.jsx')); // <-- 1. Importamos el componente de evaluaciones
const AdminImport = lazy(() => import('./admin/AdminImport.jsx'));
const AdminExport = lazy(() => import('./admin/AdminExport.jsx'));
const AdminAudit = lazy(() => import('./admin/AdminAudit.jsx'));

export default function App() {
  const { configured } = useAuth();
  if (!configured) return <ConfigMissing />;

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

        <Route element={<RequireAuth><PlayerLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/play" element={<Play />} />
          <Route path="/results" element={<Navigate to="/history" replace />} />
          <Route path="/results/:gameId" element={<Results />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/review" element={<Review />} />
          <Route path="/challenge" element={<Challenge />} />
          <Route path="/compare" element={<Compare />} />
        </Route>

        <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="topics" element={<AdminTopics />} />
          <Route path="questions" element={<AdminQuestions />} />
          <Route path="games" element={<AdminGames />} />
          <Route path="ranking" element={<Ranking embedded />} />
          <Route path="achievements" element={<AdminAchievements />} />
          <Route path="parameters" element={<AdminParameters />} />
          <Route path="feedbacks" element={<AdminFeedbacks />} /> {/* <-- 2. Añadimos la ruta para las evaluaciones */}
          <Route path="import" element={<AdminImport />} />
          <Route path="export" element={<AdminExport />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}