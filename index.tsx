import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import * as Tone from 'tone';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Polyfill for MIDI
if (typeof (navigator as any).requestMIDIAccess === 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/web-midi-api';
  script.async = true;
  document.head.appendChild(script);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <App />
    </DndProvider>
  </React.StrictMode>
);
