import Analytics from './pages/Analytics';
import AssignmentHistory from './pages/AssignmentHistory';
import ChangePassword from './pages/ChangePassword';
import Collaborate from './pages/Collaborate';
import DiagnosticQuiz from './pages/DiagnosticQuiz';
import EmailManager from './pages/EmailManager';
import Feedback from './pages/Feedback';
import GradeResults from './pages/GradeResults';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import LearningProgress from './pages/LearningProgress';
import LessonHistory from './pages/LessonHistory';
import Onboarding from './pages/Onboarding';
import PricingPlans from './pages/PricingPlans';
import ProfileInformation from './pages/ProfileInformation';
import Settings from './pages/Settings';
import SmartGrader from './pages/SmartGrader';
import DocumentViewer from './pages/DocumentViewer';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "AssignmentHistory": AssignmentHistory,
    "ChangePassword": ChangePassword,
    "Collaborate": Collaborate,
    "DiagnosticQuiz": DiagnosticQuiz,
    "EmailManager": EmailManager,
    "Feedback": Feedback,
    "GradeResults": GradeResults,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "LearningProgress": LearningProgress,
    "LessonHistory": LessonHistory,
    "Onboarding": Onboarding,
    "PricingPlans": PricingPlans,
    "ProfileInformation": ProfileInformation,
    "Settings": Settings,
    "SmartGrader": SmartGrader,
    "DocumentViewer": DocumentViewer,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};