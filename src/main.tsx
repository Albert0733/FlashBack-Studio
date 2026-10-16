import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

class ErrorBoundary extends React.Component<any, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    const pre = document.getElementById('root');
    if (pre) pre.innerHTML = `<pre style="color:#ff6b6b;padding:20px;font-size:13px;white-space:pre-wrap;font-family:monospace">${error.message}\n\n${error.stack}</pre>`;
  }
  render() { return this.state.error ? null : this.props.children; }
}

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary><App /></ErrorBoundary>
  );
} catch (e: any) {
  const root = document.getElementById('root');
  if (root) root.innerHTML = `<pre style="color:#ff6b6b;padding:20px">FATAL: ${e.message}\n${e.stack}</pre>`;
}
