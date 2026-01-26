import AssignmentHistory from './pages/AssignmentHistory';
import ChangePassword from './pages/ChangePassword';
import CreateLesson from './pages/CreateLesson';
import EmailManager from './pages/EmailManager';
import Feedback from './pages/Feedback';
import GradeResults from './pages/GradeResults';
import LessonHistory from './pages/LessonHistory';
import ManageSubscription from './pages/ManageSubscription';
import Onboarding from './pages/Onboarding';
import PricingPlans from './pages/PricingPlans';
import ProfileInformation from './pages/ProfileInformation';
import SmartGrader from './pages/SmartGrader';
import Home from './pages/Home';
import DocumentViewer from './pages/DocumentViewer';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AssignmentHistory": AssignmentHistory,
    "ChangePassword": ChangePassword,
    "CreateLesson": CreateLesson,
    "EmailManager": EmailManager,
    "Feedback": Feedback,
    "GradeResults": GradeResults,
    "LessonHistory": LessonHistory,
    "ManageSubscription": ManageSubscription,
    "Onboarding": Onboarding,
    "PricingPlans": PricingPlans,
    "ProfileInformation": ProfileInformation,
    "SmartGrader": SmartGrader,
    "Home": Home,
    "DocumentViewer": DocumentViewer,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};