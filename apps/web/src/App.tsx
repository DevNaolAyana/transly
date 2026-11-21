import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Layout, RequireAuth, RequireTranslator } from './components/Layout'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import NotFound from './pages/NotFound'
import Upload from './pages/Upload'
import Documents from './pages/Documents'
import Review from './pages/Review'
import Translate from './pages/Translate'
import Issued from './pages/Issued'
import Verify from './pages/Verify'
import TranslatorQueue from './pages/TranslatorQueue'
import TranslatorReview from './pages/TranslatorReview'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="v/:id" element={<Verify />} />
            <Route element={<RequireAuth />}>
              <Route path="upload" element={<Upload />} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/:id/review" element={<Review />} />
              <Route path="documents/:id/translate" element={<Translate />} />
              <Route path="issued/:verificationId" element={<Issued />} />
              <Route element={<RequireTranslator />}>
                <Route path="translator" element={<TranslatorQueue />} />
                <Route path="translator/:id" element={<TranslatorReview />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
