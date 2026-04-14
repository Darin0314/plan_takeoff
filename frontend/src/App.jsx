import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProjectList from './pages/ProjectList.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import TakeoffResults from './pages/TakeoffResults.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ProjectList />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/takeoffs/:runId" element={<TakeoffResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
