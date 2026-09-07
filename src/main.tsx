import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import DashboardPage from './pages/DashboardPage'
import SyllabusPage from './pages/SyllabusPage'
import ChapterPage from './pages/ChapterPage'
import QuizPage from './pages/QuizPage'
import FlashcardsPage from './pages/FlashcardsPage'
import MistakesPage from './pages/MistakesPage'
import PlannerPage from './pages/PlannerPage'
import ExamStudioPage from './pages/ExamStudioPage'
import ExamTakePage from './pages/ExamTakePage'
import ExamResultPage from './pages/ExamResultPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<SyllabusPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/subject/:subjectId/chapter/:chapterId" element={<ChapterPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/cards" element={<FlashcardsPage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/exams" element={<ExamStudioPage />} />
          <Route path="/exam/:paperId" element={<ExamTakePage />} />
          <Route path="/result/:paperId" element={<ExamResultPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
