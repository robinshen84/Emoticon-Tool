import { useState, useEffect } from 'react'
import { Layout, Grid, Image, Square, Monitor, Moon, Sun, Film } from 'lucide-react'
import { ModuleBatchResize } from './components/ModuleBatchResize'
import { ModuleBanner, ModuleDonationGuide, ModuleDonationThanks } from './components/ModuleBanner'
import { ModuleCover } from './components/ModuleCover'
import { ModuleIcon } from './components/ModuleIcon'
import { ModuleAiMotion } from './components/ModuleAiMotion'

type Tab = 'batch' | 'banner' | 'donation-guide' | 'donation-thanks' | 'cover' | 'icon' | 'ai-motion';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('batch');
  const [darkMode, setDarkMode] = useState(false);
  const logoPng = `${import.meta.env.BASE_URL}logo.png`;
  const [logoSrc, setLogoSrc] = useState<string | null>(logoPng);

  useEffect(() => {
    // Check system dark mode preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const modules: Array<{ id: Tab; node: React.ReactNode }> = [
    { id: 'batch', node: <ModuleBatchResize /> },
    { id: 'banner', node: <ModuleBanner /> },
    { id: 'donation-guide', node: <ModuleDonationGuide /> },
    { id: 'donation-thanks', node: <ModuleDonationThanks /> },
    { id: 'cover', node: <ModuleCover /> },
    { id: 'icon', node: <ModuleIcon /> },
    { id: 'ai-motion', node: <ModuleAiMotion /> },
  ];

  const tabs = [
    { id: 'batch', label: '表情包批量', icon: Grid, desc: '8-24张 240x240' },
    { id: 'banner', label: '横幅处理', icon: Monitor, desc: '750x400' },
    { id: 'donation-guide', label: '赞赏引导图', icon: Monitor, desc: '750x560' },
    { id: 'donation-thanks', label: '赞赏致谢图', icon: Monitor, desc: '750x750' },
    { id: 'cover', label: '封面处理', icon: Square, desc: '240x240' },
    { id: 'icon', label: '图标处理', icon: Image, desc: '50x50' },
    { id: 'ai-motion', label: 'AI 动图', icon: Film, desc: '图生视频/GIF' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 md:p-8 transition-colors duration-200">
      <header className="mb-8 relative z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute right-0 top-0 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer shadow-md backdrop-blur-md border border-gray-200 dark:border-gray-700"
          title={darkMode ? '切换亮色模式' : '切换暗黑模式'}
          aria-label={darkMode ? '切换到亮色模式' : '切换到暗黑模式'}
        >
          {darkMode ? <Sun className="w-6 h-6 text-yellow-500" /> : <Moon className="w-6 h-6 text-blue-600" />}
        </button>
        <div className="text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Layout className="w-8 h-8 text-blue-500" />
            表情包尺寸处理工具
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">一站式解决表情包制作的尺寸烦恼</p>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex flex-col items-center p-4 rounded-xl transition-all
                ${activeTab === tab.id 
                  ? 'bg-blue-500 text-white shadow-lg scale-105' 
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
              `}
            >
              <tab.icon className={`w-6 h-6 mb-2 ${activeTab === tab.id ? 'text-white' : 'text-blue-500'}`} />
              <span className="font-semibold">{tab.label}</span>
              <span className={`text-xs mt-1 ${activeTab === tab.id ? 'text-blue-100' : 'text-gray-500'}`}>
                {tab.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl min-h-[500px]">
          {modules.map((m) => (
            <div key={m.id} className={activeTab === m.id ? 'block' : 'hidden'}>
              {m.node}
            </div>
          ))}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto mt-10 text-center text-xs text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
        {logoSrc && (
          <img
            src={logoSrc}
            alt="logo"
            className="h-10 w-10 object-contain"
            onError={() => {
              setLogoSrc(null)
            }}
            referrerPolicy="no-referrer"
          />
        )}
        <div>此应用由瓦叔创意制作，公众号：靠谱瓦叔AI趣探</div>
      </footer>
    </div>
  )
}

export default App
