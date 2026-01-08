import AssignmentHistory from './pages/AssignmentHistory';
import ChangePassword from './pages/ChangePassword';
import EmailManager from './pages/EmailManager';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import PricingPlans from './pages/PricingPlans';
import ProfileInformation from './pages/ProfileInformation';
import Settings from './pages/Settings';
import SmartGrader from './pages/SmartGrader';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AssignmentHistory": AssignmentHistory,
    "ChangePassword": ChangePassword,
    "EmailManager": EmailManager,
    "Feedback": Feedback,
    "Home": Home,
    "Onboarding": Onboarding,
    "PricingPlans": PricingPlans,
    "ProfileInformation": ProfileInformation,
    "Settings": Settings,
    "SmartGrader": SmartGrader,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};