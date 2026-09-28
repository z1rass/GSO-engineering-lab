import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ShowcaseApp } from './showcase/App';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import './showcase/showcase.css';

createRoot(document.getElementById('root')!).render(<BrowserRouter><ShowcaseApp /></BrowserRouter>);
