import { reportClientError } from '../utils/reportClientError';
import React from 'react';
import { RotateCcw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Quiz Arena ErrorBoundary caught error:', error, errorInfo);
    reportClientError(error, { source: 'react-error-boundary' });
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-arena-darker flex items-center justify-center p-4 font-arabic text-white">
          <div className="bg-arena-card border-2 border-arena-red/50 rounded-3xl p-6 md:p-8 max-w-lg w-full text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-arena-red/20 border-2 border-arena-red flex items-center justify-center text-3xl mx-auto animate-bounce-short">
              ⚠️
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white">
                حصل عطل فني في الساحة! 🛠️
              </h1>
              <p className="text-sm text-gray-300">
                حدث خطأ غير متوقع أثناء تشغيل الجولة. لا تقلق، يمكنك إعادة تحميل الساحة الآن ومتابعة اللعب فوراً.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-arena-darker/90 p-3 rounded-xl border border-white/10 text-xs font-mono text-arena-red text-left overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReset}
                className="btn-arcade-cyan px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تحميل الساحة 🔄</span>
              </button>

              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="btn-arcade-dark px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>الرئيسية</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
