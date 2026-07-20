import { createRoot } from 'react-dom/client';

import App from './App';
import { initOfflineSync } from './lib/offline-queue';

import './index.css';

initOfflineSync();

createRoot(document.getElementById('root')!).render(<App />);
