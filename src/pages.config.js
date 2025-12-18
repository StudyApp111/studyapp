import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import CreateLesson from './pages/CreateLesson';
import DiagnosticQuiz from './pages/DiagnosticQuiz';
import Worksheet from './pages/Worksheet';
import Feedback from './pages/Feedback';
import LessonDetail from './pages/LessonDetail';
import LessonHistory from './pages/LessonHistory';
import Settings from './pages/Settings';
import ProfileInformation from './pages/ProfileInformation';
import ChangePassword from './pages/ChangePassword';
import PricingPlans from './pages/PricingPlans';
import Leaderboard from './pages/Leaderboard';
import SmartGrader from './pages/SmartGrader';
import GradeResults from './pages/GradeResults';
import AssignmentHistory from './pages/AssignmentHistory';
import CourseMapper from './pages/CourseMapper';
import Analytics from './pages/Analytics';
import LearningProgress from './pages/LearningProgress';
import EmailManager from './pages/EmailManager';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Onboarding": Onboarding,
    "Home": Home,
    "CreateLesson": CreateLesson,
    "DiagnosticQuiz": DiagnosticQuiz,
    "Worksheet": Worksheet,
    "Feedback": Feedback,
    "LessonDetail": LessonDetail,
    "LessonHistory": LessonHistory,
    "Settings": Settings,
    "ProfileInformation": ProfileInformation,
    "ChangePassword": ChangePassword,
    "PricingPlans": PricingPlans,
    "Leaderboard": Leaderboard,
    "SmartGrader": SmartGrader,
    "GradeResults": GradeResults,
    "AssignmentHistory": AssignmentHistory,
    "CourseMapper": CourseMapper,
    "Analytics": Analytics,
    "LearningProgress": LearningProgress,
    "EmailManager": EmailManager,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};