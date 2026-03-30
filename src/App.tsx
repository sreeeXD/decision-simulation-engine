import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Rocket, 
  Lightbulb, 
  Users, 
  DollarSign, 
  Target, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Heart,
  ChevronRight,
  RefreshCw,
  FileText,
  LayoutDashboard,
  Map
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import type { 
  StartupInfo, 
  DecisionPoint, 
  SimulationOutcome, 
  FinalReport, 
  Metrics,
  StartupStage,
  Option
} from './types';

const INITIAL_METRICS: Metrics = {
  impact: 50,
  financials: 50,
  risk: 30,
  trust: 50
};

export default function App() {
  const [step, setStep] = useState<'welcome' | 'input' | 'simulating' | 'decision' | 'outcome' | 'report'>('welcome');
  const [startupInfo, setStartupInfo] = useState<StartupInfo>({
    name: '',
    idea: '',
    stage: 'idea',
    targetUsers: '',
    budget: '',
    goals: ''
  });
  const [decisionPoints, setDecisionPoints] = useState<DecisionPoint[]>([]);
  const [currentDecisionIndex, setCurrentDecisionIndex] = useState(0);
  const [currentOutcome, setCurrentOutcome] = useState<SimulationOutcome | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(INITIAL_METRICS);
  const [history, setHistory] = useState<{ decision: string; option: string; optionId: string; outcome: SimulationOutcome }[]>([]);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [customOption, setCustomOption] = useState('');
  const [alternatives, setAlternatives] = useState<{ optionId: string; summary: string; metricsDelta: Metrics }[] | null>(null);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const loadingMessages = [
    "Analyzing your startup vision...",
    "Identifying key market challenges...",
    "Mapping potential execution paths...",
    "Consulting with virtual mentors...",
    "Finalizing your simulation journey..."
  ];

  useEffect(() => {
    let interval: any;
    if (loading && step === 'simulating') {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingMessages.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading, step]);

  const startSimulation = async () => {
    setLoading(true);
    setError(null);
    setStep('simulating');
    try {
      const response = await fetch('/api/generate-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupInfo })
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (!data.decisionPoints || data.decisionPoints.length === 0) {
        throw new Error("No decision points were generated. Please try again.");
      }
      setDecisionPoints(data.decisionPoints);
      setStep('decision');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (option: Option | { text: string; description: string; id: string }, isCustom = false) => {
    setLoading(true);
    setError(null);
    setAlternatives(null);
    try {
      const response = await fetch('/api/simulate-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startupInfo, 
          decision: decisionPoints[currentDecisionIndex], 
          selectedOption: option,
          isCustom
        })
      });
      const outcome: SimulationOutcome = await response.json();
      
      if ((outcome as any).error) {
        throw new Error((outcome as any).error);
      }
      
      setCurrentOutcome(outcome);
      setMetrics(prev => ({
        impact: Math.min(100, Math.max(0, prev.impact + outcome.metricsDelta.impact)),
        financials: Math.min(100, Math.max(0, prev.financials + outcome.metricsDelta.financials)),
        risk: Math.min(100, Math.max(0, prev.risk + outcome.metricsDelta.risk)),
        trust: Math.min(100, Math.max(0, prev.trust + outcome.metricsDelta.trust))
      }));
      setHistory(prev => [...prev, { 
        decision: decisionPoints[currentDecisionIndex].title, 
        option: option.text, 
        optionId: option.id,
        outcome 
      }]);
      setCustomOption('');
      setStep('outcome');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to simulate outcome. Please try again.");
      // Stay on decision step so user can retry
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchPath = async (option: Option) => {
    // 1. Undo current metrics from the outcome we are switching AWAY from
    if (currentOutcome) {
      setMetrics(prev => ({
        impact: Math.min(100, Math.max(0, prev.impact - currentOutcome.metricsDelta.impact)),
        financials: Math.min(100, Math.max(0, prev.financials - currentOutcome.metricsDelta.financials)),
        risk: Math.min(100, Math.max(0, prev.risk - currentOutcome.metricsDelta.risk)),
        trust: Math.min(100, Math.max(0, prev.trust - currentOutcome.metricsDelta.trust))
      }));
    }
    
    // 2. Remove last history item
    setHistory(prev => prev.slice(0, -1));
    
    // 3. Trigger new decision (this will add to history and update metrics again)
    await handleDecision(option);
  };

  const fetchAlternatives = async () => {
    setLoadingAlternatives(true);
    try {
      const response = await fetch('/api/simulate-alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startupInfo, 
          decision: decisionPoints[currentDecisionIndex]
        })
      });
      const data = await response.json();
      setAlternatives(data.alternatives);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const nextStep = async () => {
    if (currentDecisionIndex < (decisionPoints?.length || 0) - 1) {
      setCurrentDecisionIndex(prev => prev + 1);
      setStep('decision');
    } else {
      setLoading(true);
      setError(null);
      setStep('simulating');
      try {
        const response = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startupInfo, history, finalMetrics: metrics })
        });
        const report = await response.json();
        if (report.error) {
          throw new Error(report.error);
        }
        setFinalReport(report);
        setStep('report');
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to generate report.");
        setStep('outcome');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-[#F27D26] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#141414]/10 py-6 px-8 flex justify-between items-center sticky top-0 bg-[#FDFCFB]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
            <Rocket size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase italic font-serif">Startup Journey</h1>
        </div>
        
        {step !== 'welcome' && step !== 'input' && (
          <div className="flex gap-8">
            <MetricItem label="Impact" value={metrics.impact} icon={<TrendingUp size={14} />} color="text-blue-600" />
            <MetricItem label="Sustainability" value={metrics.financials} icon={<DollarSign size={14} />} color="text-green-600" />
            <MetricItem label="Risk" value={metrics.risk} icon={<AlertTriangle size={14} />} color="text-red-600" />
            <MetricItem label="Trust" value={metrics.trust} icon={<Heart size={14} />} color="text-pink-600" />
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto py-16 px-6">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <div className="inline-block px-4 py-1.5 bg-[#F27D26]/10 text-[#F27D26] rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                Virtual Mentor & Simulation Engine
              </div>
              <h2 className="text-7xl font-bold tracking-tighter leading-[0.9] uppercase font-serif italic">
                Experience the Future <br /> of Your Startup
              </h2>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">
                Simulate your journey, understand the consequences of your decisions, 
                and bridge the execution gap before you even start.
              </p>
              <button 
                onClick={() => setStep('input')}
                className="group relative inline-flex items-center gap-3 bg-[#141414] text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-[#F27D26] transition-all duration-500 hover:scale-105 active:scale-95"
              >
                Begin Your Journey
                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
              </button>
            </motion.div>
          )}

          {step === 'input' && (
            <motion.div 
              key="input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="space-y-2">
                <h3 className="text-4xl font-bold tracking-tight italic font-serif">Setup Your Simulation</h3>
                <p className="text-gray-500">Tell us about your vision to generate a personalized journey.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup label="Startup Name" icon={<Rocket size={18} />}>
                  <input 
                    type="text" 
                    value={startupInfo.name}
                    onChange={e => setStartupInfo({...startupInfo, name: e.target.value})}
                    placeholder="e.g. EcoFlow"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F27D26] outline-none transition-all"
                  />
                </InputGroup>

                <InputGroup label="Current Stage" icon={<TrendingUp size={18} />}>
                  <div className="flex gap-4">
                    {(['idea', 'prototype'] as StartupStage[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setStartupInfo({...startupInfo, stage: s})}
                        className={cn(
                          "flex-1 py-3 rounded-xl border-2 transition-all font-bold capitalize",
                          startupInfo.stage === s 
                            ? "bg-[#141414] text-white border-[#141414]" 
                            : "bg-white text-gray-500 border-gray-100 hover:border-gray-300"
                        )}
                      >
                        {s} Stage
                      </button>
                    ))}
                  </div>
                </InputGroup>

                <div className="md:col-span-2">
                  <InputGroup label="The Big Idea" icon={<Lightbulb size={18} />}>
                    <textarea 
                      value={startupInfo.idea}
                      onChange={e => setStartupInfo({...startupInfo, idea: e.target.value})}
                      placeholder="What problem are you solving and how?"
                      rows={3}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F27D26] outline-none transition-all resize-none"
                    />
                  </InputGroup>
                </div>

                <InputGroup label="Target Users" icon={<Users size={18} />}>
                  <input 
                    type="text" 
                    value={startupInfo.targetUsers}
                    onChange={e => setStartupInfo({...startupInfo, targetUsers: e.target.value})}
                    placeholder="e.g. Gen Z eco-conscious shoppers"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F27D26] outline-none transition-all"
                  />
                </InputGroup>

                <InputGroup label="Budget & Goals" icon={<Target size={18} />}>
                  <input 
                    type="text" 
                    value={startupInfo.budget}
                    onChange={e => setStartupInfo({...startupInfo, budget: e.target.value})}
                    placeholder="e.g. $10k, reach 1000 users"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F27D26] outline-none transition-all"
                  />
                </InputGroup>
              </div>

              <div className="flex justify-end pt-8">
                <button 
                  onClick={startSimulation}
                  disabled={!startupInfo.name || !startupInfo.idea || loading}
                  className="bg-[#141414] text-white px-12 py-4 rounded-xl font-bold hover:bg-[#F27D26] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {loading ? 'Generating...' : 'Generate Simulation'}
                  <ArrowRight size={20} />
                </button>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-100 p-6 rounded-2xl flex items-start gap-4"
                >
                  <AlertTriangle className="text-red-500 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-bold text-red-800">Simulation Error</div>
                    <p className="text-sm text-red-600">{error}</p>
                    <div className="text-xs text-red-400 mt-2 space-y-1">
                      <p>Tip: If you see errors, the app will automatically try Groq, then OpenAI, then Gemini.</p>
                      <p>Ensure your API keys (GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY) are correctly configured in the Secrets panel (Settings → Secrets).</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'simulating' && (
            <motion.div 
              key="simulating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-8 py-20"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-gray-100 border-t-[#F27D26] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-[#F27D26]">
                  <RefreshCw size={32} className="animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold italic font-serif">AI Mentor is thinking...</h3>
                <div className="space-y-1">
                  <p className="text-[#F27D26] font-bold animate-pulse">
                    {loadingMessages[loadingStep]}
                  </p>
                  <p className="text-gray-400 text-sm">Generating your personalized startup journey</p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'decision' && decisionPoints && decisionPoints[currentDecisionIndex] && (
            <motion.div 
              key={`decision-${currentDecisionIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <div className="text-[#F27D26] font-bold text-sm uppercase tracking-widest">
                    Decision {currentDecisionIndex + 1} of {decisionPoints.length}
                  </div>
                  <h3 className="text-4xl font-bold tracking-tight italic font-serif">
                    {decisionPoints[currentDecisionIndex].title}
                  </h3>
                </div>
              </div>

              <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-sm space-y-4">
                <p className="text-xl leading-relaxed text-gray-700 font-light italic">
                  "{decisionPoints[currentDecisionIndex].scenario}"
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {decisionPoints[currentDecisionIndex].options.map((option, idx) => (
                  <button
                    key={option.id}
                    onClick={() => handleDecision(option)}
                    disabled={loading}
                    className="group flex items-start gap-6 p-6 bg-white border border-gray-100 rounded-2xl hover:border-[#F27D26] hover:shadow-xl hover:shadow-[#F27D26]/5 transition-all text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#F27D26] group-hover:text-white transition-colors font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-lg">{option.text}</div>
                      <div className="text-gray-500 text-sm">{option.description}</div>
                    </div>
                    <ChevronRight className="ml-auto text-gray-300 group-hover:text-[#F27D26] transition-colors" />
                  </button>
                ))}

                {/* Custom Option Input */}
                <div className="mt-4 p-6 bg-white border border-dashed border-gray-300 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
                    <Lightbulb size={16} />
                    Have a better idea?
                  </div>
                  <textarea
                    value={customOption}
                    onChange={e => setCustomOption(e.target.value)}
                    placeholder="Type your own out-of-the-box decision here..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F27D26] outline-none transition-all resize-none text-sm"
                    rows={2}
                  />
                  <button
                    onClick={() => handleDecision({ id: 'custom', text: customOption, description: 'Custom idea' }, true)}
                    disabled={!customOption.trim() || loading}
                    className="w-full bg-[#141414] text-white py-3 rounded-xl font-bold hover:bg-[#F27D26] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Submit Custom Idea
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-100 p-6 rounded-2xl flex items-start gap-4"
                >
                  <AlertTriangle className="text-red-500 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-bold text-red-800">Simulation Error</div>
                    <p className="text-sm text-red-600">{error}</p>
                    <button 
                      onClick={() => setError(null)}
                      className="text-xs text-[#F27D26] font-bold uppercase tracking-widest mt-2 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'outcome' && currentOutcome && (
            <motion.div 
              key="outcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-widest">
                  <CheckCircle2 size={14} />
                  Decision Simulated
                </div>
                <h3 className="text-4xl font-bold tracking-tight italic font-serif">The Consequences</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-100 p-8 rounded-3xl space-y-6">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Users size={16} />
                    Stakeholder Reactions
                  </h4>
                  <div className="space-y-4">
                    {currentOutcome.stakeholders.map((s, i) => (
                      <div key={i} className="flex gap-4 items-start p-4 bg-gray-50 rounded-2xl">
                        <div className={cn(
                          "w-3 h-3 rounded-full mt-1.5 shrink-0",
                          s.reaction === 'positive' ? 'bg-green-500' : s.reaction === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                        )} />
                        <div>
                          <div className="font-bold text-sm">{s.name} <span className="font-normal text-gray-400">({s.role})</span></div>
                          <p className="text-sm text-gray-600 italic">"{s.comment}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#141414] text-white p-8 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <TrendingUp size={16} />
                      AI Insight
                    </h4>
                    <p className="text-lg font-light leading-relaxed italic">
                      {currentOutcome.insight}
                    </p>
                  </div>

                  <div className="bg-[#F27D26]/5 border border-[#F27D26]/20 p-8 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-[#F27D26] flex items-center gap-2">
                      <Lightbulb size={16} />
                      Better Alternative
                    </h4>
                    <p className="text-gray-700 italic">
                      {currentOutcome.alternative}
                    </p>
                  </div>
                </div>
              </div>

              {/* What If Analysis */}
              <div className="bg-white border border-gray-100 p-8 rounded-3xl space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <RefreshCw size={16} />
                    What if I chose differently?
                  </h4>
                  {!alternatives && !loadingAlternatives && (
                    <button 
                      onClick={fetchAlternatives}
                      className="text-xs font-bold text-[#F27D26] hover:underline uppercase tracking-widest"
                    >
                      Explore Alternatives
                    </button>
                  )}
                </div>

                {loadingAlternatives && (
                  <div className="flex items-center gap-3 text-gray-400 italic animate-pulse">
                    <RefreshCw size={16} className="animate-spin" />
                    Simulating alternative realities...
                  </div>
                )}

                {alternatives && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alternatives
                      .filter(alt => {
                        const lastHistoryItem = history[history.length - 1];
                        return alt.optionId !== lastHistoryItem?.optionId;
                      })
                      .map((alt, i) => {
                        const originalOption = decisionPoints[currentDecisionIndex].options.find(o => o.id === alt.optionId);
                        if (!originalOption) return null;
                        return (
                          <div key={i} className="p-4 bg-gray-50 rounded-2xl space-y-3 border border-transparent hover:border-gray-200 transition-all group/alt">
                            <div className="flex justify-between items-start">
                              <div className="font-bold text-sm text-gray-800">{originalOption.text}</div>
                              <button 
                                onClick={() => handleSwitchPath(originalOption)}
                                className="text-[10px] font-bold text-[#F27D26] hover:underline uppercase tracking-widest opacity-0 group-hover/alt:opacity-100 transition-opacity"
                              >
                                Switch Path
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 italic">"{alt.summary}"</p>
                            <div className="flex gap-3 pt-2">
                              <AltMetric label="Imp" value={alt.metricsDelta.impact} />
                              <AltMetric label="Fin" value={alt.metricsDelta.financials} />
                              <AltMetric label="Rsk" value={alt.metricsDelta.risk} />
                              <AltMetric label="Trs" value={alt.metricsDelta.trust} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={nextStep}
                  className="bg-[#141414] text-white px-12 py-4 rounded-xl font-bold hover:bg-[#F27D26] transition-all flex items-center gap-3"
                >
                  {currentDecisionIndex < decisionPoints.length - 1 ? 'Next Decision' : 'Generate Final Report'}
                  <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'report' && finalReport && (
            <motion.div 
              key="report"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16 pb-20"
            >
              <div className="text-center space-y-4">
                <h2 className="text-6xl font-bold tracking-tighter italic font-serif">Journey Summary</h2>
                <p className="text-gray-500">Your performance analysis and execution roadmap.</p>
              </div>

              {/* Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReportMetric label="Impact" value={finalReport.dashboard.impact} icon={<TrendingUp />} />
                <ReportMetric label="Financials" value={finalReport.dashboard.financials} icon={<DollarSign />} />
                <ReportMetric label="Risk Control" value={100 - finalReport.dashboard.risk} icon={<ShieldCheck />} />
                <ReportMetric label="Readiness" value={finalReport.dashboard.readiness} icon={<Rocket />} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                  <section className="bg-white border border-gray-100 p-8 rounded-3xl space-y-4">
                    <h3 className="text-2xl font-bold italic font-serif flex items-center gap-3">
                      <FileText className="text-[#F27D26]" />
                      Mentor Summary
                    </h3>
                    <div className="prose prose-gray max-w-none">
                      <ReactMarkdown>{finalReport.summary}</ReactMarkdown>
                    </div>
                  </section>

                  <section className="bg-white border border-gray-100 p-8 rounded-3xl space-y-6">
                    <h3 className="text-2xl font-bold italic font-serif flex items-center gap-3">
                      <Map className="text-[#F27D26]" />
                      Execution Roadmap
                    </h3>
                    <div className="space-y-4">
                      {finalReport.roadmap.map((item, i) => (
                        <div key={i} className="flex gap-6 p-6 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-lg transition-all">
                          <div className="w-12 h-12 rounded-xl bg-[#141414] text-white flex items-center justify-center font-bold shrink-0">
                            {i + 1}
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold text-lg">{item.step}</div>
                            <p className="text-gray-600 italic">{item.action}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  <section className="bg-green-50 p-8 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-green-600 flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      Strengths
                    </h4>
                    <ul className="space-y-2">
                      {finalReport.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="bg-red-50 p-8 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-red-600 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Weaknesses
                    </h4>
                    <ul className="space-y-2">
                      {finalReport.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-red-800 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="bg-blue-50 p-8 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2">
                      <LayoutDashboard size={16} />
                      Observations
                    </h4>
                    <ul className="space-y-2">
                      {finalReport.observations.map((o, i) => (
                        <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-[#141414] text-white py-4 rounded-xl font-bold hover:bg-[#F27D26] transition-all flex items-center justify-center gap-3"
                  >
                    <RefreshCw size={18} />
                    Restart Simulation
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#141414]/5 py-12 px-8 text-center text-gray-400 text-sm">
        <p>© 2026 Startup Journey Simulator. Built with Gemini AI.</p>
      </footer>
    </div>
  );
}

function AltMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-bold uppercase text-gray-400">{label}</span>
      <span className={cn(
        "text-[10px] font-bold",
        value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-gray-400"
      )}>
        {value > 0 ? '+' : ''}{value}
      </span>
    </div>
  );
}

function MetricItem({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tighter text-gray-400">
        {icon}
        {label}
      </div>
      <div className={cn("text-lg font-bold font-mono", color)}>
        {Math.round(value)}%
      </div>
      <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={cn("h-full", color.replace('text', 'bg'))}
        />
      </div>
    </div>
  );
}

function InputGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function ReportMetric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-3xl flex flex-col items-center text-center space-y-2">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-[#F27D26]">
        {icon}
      </div>
      <div className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</div>
      <div className="text-3xl font-bold italic font-serif">{Math.round(value)}%</div>
    </div>
  );
}
