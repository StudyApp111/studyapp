import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import CreateLesson from './pages/CreateLesson';
import Layout from './Layout.jsx';


export const PAGES = {
    "Onboarding": Onboarding,
    "Home": Home,
    "CreateLesson": CreateLesson,
}

export const pagesConfig = {
    mainPage: "Onboarding",
    Pages: PAGES,
    Layout: Layout,
};