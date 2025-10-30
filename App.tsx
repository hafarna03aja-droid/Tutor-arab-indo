
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppView } from './types';
import LiveConversation from './components/LiveConversation';
import ArabicBasics from './components/ArabicBasics';
import TextTranslator from './components/TextTranslator';
import { IconBook, IconMessageCircle, IconTranslate, IconSettings } from './components/common/Icons';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.CONVERSATION);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings panel when clicking outside
  // FIX: Added useEffect to the import statement from 'react' on line 1.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderView = useCallback(() => {
    const props = { speechRate };
    switch (view) {
      case AppView.CONVERSATION:
        return <LiveConversation {...props} />;
      case AppView.BASICS:
        return <ArabicBasics {...props} />;
      case AppView.TRANSLATOR:
        return <TextTranslator {...props} />;
      default:
        return <LiveConversation {...props} />;
    }
  }, [view, speechRate]);

  const NavButton: React.FC<{
    currentView: AppView;
    targetView: AppView;
    onClick: (view: AppView) => void;
    icon: React.ReactNode;
    label: string;
  }> = ({ currentView, targetView, onClick, icon, label }) => (
    <button
      onClick={() => onClick(targetView)}
      className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
        currentView === targetView
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 shadow-md p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">A</div>
            <h1 className="text-xl font-bold text-white tracking-wider">Tutor Arab-Indo</h1>
        </div>
        <div className="flex items-center gap-4">
            <nav className="w-full sm:w-auto flex gap-2 bg-gray-800 p-1 rounded-lg">
                <NavButton
                    currentView={view}
                    targetView={AppView.CONVERSATION}
                    onClick={setView}
                    icon={<IconMessageCircle />}
                    label="Percakapan Langsung"
                />
                <NavButton
                    currentView={view}
                    targetView={AppView.BASICS}
                    onClick={setView}
                    icon={<IconBook />}
                    label="Dasar Bahasa Arab"
                />
                <NavButton
                    currentView={view}
                    targetView={AppView.TRANSLATOR}
                    onClick={setView}
                    icon={<IconTranslate />}
                    label="Penerjemah"
                />
            </nav>
            <div className="relative" ref={settingsRef}>
                <button 
                    onClick={() => setShowSettings(s => !s)}
                    className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                    aria-label="Pengaturan"
                >
                    <IconSettings />
                </button>
                {showSettings && (
                    <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-lg shadow-xl p-4 z-10 border border-gray-600">
                        <label htmlFor="speech-rate" className="block text-sm font-medium text-gray-300">Kecepatan Bicara Tutor</label>
                        <input
                            id="speech-rate"
                            type="range"
                            min="0.75"
                            max="1.25"
                            step="0.25"
                            value={speechRate}
                            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mt-2"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                            <span>Lambat</span>
                            <span>Cepat</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {renderView()}
      </main>
    </div>
  );
};

export default App;