import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import CreateLesson from './pages/CreateLesson';
import DiagnosticQuiz from './pages/DiagnosticQuiz';
import Worksheet from './pages/Worksheet';
import Feedback from './pages/Feedback';
import Layout from './Layout.jsx';


export const PAGES = {
    "Onboarding": Onboarding,
    "Home": Home,
    "CreateLesson": CreateLesson,
    "DiagnosticQuiz": DiagnosticQuiz,
    "Worksheet": Worksheet,
    "Feedback": Feedback,
}

export const pagesConfig = {
    mainPage: "Onboarding",
    Pages: PAGES,
    Layout: Layout,
};