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
import Layout from './Layout.jsx';


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
}

export const pagesConfig = {
    mainPage: "Onboarding",
    Pages: PAGES,
    Layout: Layout,
};