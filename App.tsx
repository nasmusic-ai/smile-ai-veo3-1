import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Button } from './components/Button';
import { Alert } from './components/Alert';
import { Auth } from './components/Auth';
import { AdminDashboard } from './components/AdminDashboard';
import { generateVeoVideo, fileToBase64, VideoQuality } from './services/geminiService';
import { authService, adminService } from './services/mockBackend';
import { AspectRatio, GenerationStatus, User, WatermarkConfig } from './types';

// Safe environment variable access with user-provided fallback
const getEnvApiKey = (): string | undefined => {
  try {
    const envKey = process.env.API_KEY;
    // Check if the environment variable is set and not a placeholder
    if (envKey && !envKey.includes("UNUSED_PLACEHOLDER") && !envKey.includes("INSERT_API_KEY")) {
      return envKey;
    }
    // Fallback to the specific key provided by user to fix configuration issues
    return "AIzaSyClN9faPK0phC6OB3OD-ODQiPTsivvjdfE";
  } catch (e) {
    // If process.env fails entirely, use the fallback
    return "AIzaSyClN9faPK0phC6OB3OD-ODQiPTsivvjdfE";
  }
};

function App() {
  // Global App State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('auth'); // 'auth', 'generator', 'admin', 'pending'

  // Generator State
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE);
  const [quality, setQuality] = useState<VideoQuality>('fast');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({ enabled: true, text: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Auth
  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      handleLogin(user);
    }
    // Load Watermark Config
    const loadConfig = async () => {
      try {
        const config = await adminService.getWatermarkConfig();
        setWatermarkConfig(config);
      } catch (e) {
        console.error("Failed to load branding config", e);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    // Check key availability whenever user changes or mounts
    checkApiKey();
  }, [currentUser]);

  const checkApiKey = async () => {
    try {
      const envKey = getEnvApiKey();
      
      // Since getEnvApiKey now returns a fallback, this check will pass if the fallback is valid
      const isValidEnvKey = envKey && !envKey.includes("UNUSED_PLACEHOLDER") && !envKey.includes("INSERT_API_KEY");

      // 1. Check if the environment variable (or fallback) is already populated and valid
      if (isValidEnvKey) {
        setHasApiKey(true);
      }

      // 2. Check AI Studio environment (Development/IDX) and sync state
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        // If dynamic key is present, it overrides or confirms the state
        if (hasKey) setHasApiKey(true);
      }
    } catch (e) {
      console.error("Error checking API key", e);
    }
  };

  const handleSelectKey = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        
        // Re-check immediately after selection attempt
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
        
        if (hasKey && error && error.includes("API Key")) {
            setError(null);
        }
      } else {
        // Fallback for browsers outside AI Studio as requested
        alert("System configuration required: API Key missing. Please contact an administrator.");
      }
    } catch (e) {
      console.error("Failed to open key selector", e);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setCurrentView('admin'); // Admins go to dashboard first
    } else if (user.isApproved) {
      setCurrentView('generator');
    } else {
      setCurrentView('pending');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentView('auth');
    handleReset();
  };

  // Logic to determine which view to show
  const handleChangeView = async (view: string) => {
     if (view === 'admin' && currentUser?.role !== 'admin') return;
     // Reload watermark when switching views to ensure freshness
     if (view === 'generator') {
        const config = await adminService.getWatermarkConfig();
        setWatermarkConfig(config);
     }
     setCurrentView(view);
  };

  // Generator Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError("File size too large. Please select an image under 5MB.");
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError("Please upload a valid image file.");
        return;
      }
      setSelectedFile(file);
      setError(null);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setVideoUrl(null);
    setStatus(GenerationStatus.IDLE);
    setProgressMessage('');
    setProgress(0);
    setError(null);
    setPrompt('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!selectedFile || !currentUser) return;
    
    // API Key Logic: Allow anyone to set it if missing
    if (!hasApiKey) {
      await handleSelectKey();
      
      // Re-run checkApiKey logic effectively
      let keyAvailable = false;
      const envKey = getEnvApiKey();
      
      // Strict check (should pass now with fallback)
      if (envKey && !envKey.includes("UNUSED_PLACEHOLDER") && !envKey.includes("INSERT_API_KEY")) keyAvailable = true;
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) keyAvailable = true;

      if (!keyAvailable) {
        setError("Generation cancelled: API Key selection is required.");
        return;
      }
    }

    setStatus(GenerationStatus.UPLOADING);
    setProgressMessage("Preparing your image...");
    setProgress(10);
    setError(null);

    try {
      const base64Image = await fileToBase64(selectedFile);
      setStatus(GenerationStatus.GENERATING);
      setProgress(25);
      
      const videoBlob = await generateVeoVideo(
        base64Image,
        selectedFile.type,
        prompt.trim() || "Animate this image cinematically",
        aspectRatio,
        quality,
        (msg) => {
          setProgressMessage(msg);
          // Heuristic progress updates based on service messages
          if (msg.includes("Initializing")) setProgress(35);
          else if (msg.includes("Rendering")) setProgress(50);
          else if (msg.includes("Still dreaming")) setProgress(prev => Math.min(prev + 5, 90));
          else if (msg.includes("Downloading")) setProgress(95);
        }
      );

      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
      setStatus(GenerationStatus.COMPLETED);
      setProgress(100);
      
      // Log Success in CMS
      adminService.logActivity(currentUser.id, currentUser.username, `Generated video: ${prompt.slice(0, 30)}... (${quality})`);

    } catch (e: any) {
      console.error(e);
      let msg = e.message || "An unexpected error occurred.";
      if (msg.includes("Requested entity was not found") || msg.includes("Invalid API Key")) {
        // If the key is invalid, force re-selection prompt next time
        setHasApiKey(false);
        if (msg.includes("Invalid API Key")) {
            msg = "System configuration required: API Key missing or invalid.";
        } else {
            msg = "API Key Invalid or Expired. Please re-select your key.";
        }
      }
      setError(msg);
      setStatus(GenerationStatus.ERROR);
      adminService.logActivity(currentUser.id, currentUser.username, `Failed generation: ${msg}`);
    }
  };

  const isProcessing = status === GenerationStatus.UPLOADING || status === GenerationStatus.GENERATING || status === GenerationStatus.POLLING;

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Header 
        user={currentUser} 
        onLogout={handleLogout} 
        currentView={currentView}
        onChangeView={handleChangeView}
      />

      <main className="flex-grow w-full py-8">
        
        {/* VIEW: AUTH */}
        {!currentUser && (
          <Auth onLogin={handleLogin} />
        )}

        {/* VIEW: PENDING APPROVAL */}
        {currentUser && currentView === 'pending' && (
          <div className="max-w-md mx-auto mt-10 px-4">
             <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center shadow-sm">
                <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-amber-900 mb-2">Account Pending Approval</h2>
                <p className="text-amber-700 mb-6">
                  Thanks for registering, <strong>{currentUser.username}</strong>. <br/>
                  Your account must be approved by an administrator before you can generate videos.
                </p>
                <p className="text-sm text-amber-600">Please check back later.</p>
             </div>
          </div>
        )}

        {/* VIEW: ADMIN CMS */}
        {currentUser && currentView === 'admin' && (
           <div className="px-4">
             <AdminDashboard 
               hasApiKey={hasApiKey} 
               onConnectKey={handleSelectKey} 
             />
           </div>
        )}

        {/* VIEW: GENERATOR */}
        {currentUser && currentView === 'generator' && (
          <div className="max-w-3xl mx-auto px-4 flex flex-col gap-6 animate-fade-in">
             
             {/* Billing/Key Check - Visible to ALL users if key is missing */}
             {!hasApiKey && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center shadow-sm">
                 <h2 className="text-lg font-bold text-indigo-900 mb-2">Connect Google Cloud</h2>
                 <p className="text-indigo-700 mb-4 text-sm">
                   Veo generation requires a paid API key. Please connect your Google Cloud account to proceed.
                 </p>
                 <Button onClick={handleSelectKey} variant="primary" className="!py-2 !text-xs">
                   Connect API Key
                 </Button>
              </div>
            )}

            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            {/* Generator UI */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold mr-3">1</span>
                  Upload Source Image
                </h2>
                
                {!imagePreview ? (
                  <div 
                    className="relative border-2 border-dashed border-slate-300 rounded-xl p-8 sm:p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleFileChange}
                    />
                    <div className="mx-auto h-16 w-16 text-slate-300 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-600 font-medium text-lg">Click to upload a photo</p>
                    <p className="text-slate-400 text-sm mt-2">PNG, JPG up to 5MB</p>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img src={imagePreview} alt="Preview" className="w-full h-64 object-contain" />
                    <button 
                      onClick={handleReset}
                      disabled={isProcessing}
                      className="absolute top-3 right-3 bg-white/90 p-2 rounded-full shadow-md text-slate-600 hover:text-red-500 transition-colors disabled:opacity-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold mr-3">2</span>
                  Animation Settings
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Prompt (Optional)</label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe how the image should move..."
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none h-32 text-base text-slate-700 placeholder-slate-400"
                        disabled={isProcessing}
                    />
                  </div>

                  <div className="space-y-4">
                      {/* Aspect Ratio */}
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Aspect Ratio</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => setAspectRatio(AspectRatio.LANDSCAPE)}
                            disabled={isProcessing}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                              aspectRatio === AspectRatio.LANDSCAPE 
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <div className="w-10 h-6 border-2 border-current rounded mb-1"></div>
                            <span className="text-xs font-medium">16:9</span>
                          </button>
                          <button
                            onClick={() => setAspectRatio(AspectRatio.PORTRAIT)}
                            disabled={isProcessing}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                              aspectRatio === AspectRatio.PORTRAIT 
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <div className="w-6 h-10 border-2 border-current rounded mb-1"></div>
                            <span className="text-xs font-medium">9:16</span>
                          </button>
                        </div>
                      </div>

                      {/* Quality Selector */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Model Quality</label>
                        <div className="bg-white border border-slate-200 p-1 rounded-xl flex">
                          <button
                            onClick={() => setQuality('fast')}
                            disabled={isProcessing}
                            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                              quality === 'fast'
                                ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Fast (Preview)
                          </button>
                          <button
                            onClick={() => setQuality('high')}
                            disabled={isProcessing}
                            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                              quality === 'high'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            High (Premium)
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                          High Quality requires a paid account and takes longer to generate.
                        </p>
                      </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 border-t border-slate-100 flex flex-col items-stretch gap-6">
                {isProcessing ? (
                  <div className="w-full space-y-2 animate-fade-in">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-indigo-700 flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {progressMessage}
                      </span>
                      <span className="font-bold text-indigo-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      >
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 text-center italic">
                      AI video generation takes time. Please do not close this tab.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-500 order-2 sm:order-1">
                      {status === GenerationStatus.IDLE && "Ready to generate"}
                      {status === GenerationStatus.COMPLETED && (
                        <span className="flex items-center text-green-600 font-bold">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                           </svg>
                           Video Generated Successfully!
                        </span>
                      )}
                    </div>
                    
                    <div className="order-1 sm:order-2 w-full sm:w-auto">
                      {!videoUrl ? (
                        <Button 
                          onClick={handleGenerate} 
                          disabled={!selectedFile}
                          className="w-full sm:w-auto"
                        >
                          Generate Video
                        </Button>
                      ) : (
                        <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto">
                          Create Another
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {videoUrl && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 text-center">Your Generated Video</h2>
                <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center group">
                  <video 
                    src={videoUrl} 
                    controls 
                    autoPlay 
                    loop 
                    className={`max-h-[600px] w-auto mx-auto shadow-2xl ${aspectRatio === AspectRatio.PORTRAIT ? 'h-full' : 'w-full'}`}
                  />
                  {/* Watermark Overlay on Video */}
                  {watermarkConfig.enabled && watermarkConfig.text && (
                    <div className="absolute bottom-10 right-4 sm:bottom-12 sm:right-6 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20 pointer-events-none select-none z-10">
                       <span className="text-white/90 text-[10px] sm:text-xs font-bold tracking-wider uppercase font-sans drop-shadow-md">
                         {watermarkConfig.text}
                       </span>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-col items-center justify-center">
                  <a 
                    href={videoUrl} 
                    download={`smile-veo3-${Date.now()}.mp4`}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors"
                  >
                    Download Video
                  </a>
                  
                  {/* Watermark Button Edge */}
                  {watermarkConfig.enabled && watermarkConfig.text && (
                    <div className="mt-2 text-[10px] text-slate-400 font-medium tracking-wide">
                       Protected by {watermarkConfig.text}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer className="w-full p-6 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
        <div>&copy; {new Date().getFullYear()} SMILE AI VEO3. Managed by SMILE CMS.</div>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-600 transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span>Connect on GitHub</span>
        </a>
      </footer>
    </div>
  );
}

export default App;