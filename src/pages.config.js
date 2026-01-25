import AssignmentHistory from './pages/AssignmentHistory';
import ChangePassword from './pages/ChangePassword';
import DocumentViewer from './pages/DocumentViewer';
import EmailManager from './pages/EmailManager';
import Feedback from './pages/Feedback';
import GradeResults from './pages/GradeResults';
import Home from './pages/Home';
import LessonHistory from './pages/LessonHistory';
import Onboarding from './pages/Onboarding';
import PricingPlans from './pages/PricingPlans';
import ProfileInformation from './pages/ProfileInformation';
import Settings from './pages/Settings';
import SmartGrader from './pages/SmartGrader';
import CreateLesson from './pages/CreateLesson';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AssignmentHistory": AssignmentHistory,
    "ChangePassword": ChangePassword,
    "DocumentViewer": DocumentViewer,
    "EmailManager": EmailManager,
    "Feedback": Feedback,
    "GradeResults": GradeResults,
    "Home": Home,
    "LessonHistory": LessonHistory,
    "Onboarding": Onboarding,
    "PricingPlans": PricingPlans,
    "ProfileInformation": ProfileInformation,
    "Settings": Settings,
    "SmartGrader": SmartGrader,
    "CreateLesson": CreateLesson,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};