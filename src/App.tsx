import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Activity, 
  History, 
  Search, 
  Terminal, 
  Cpu, 
  Thermometer, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Loader2,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mockTelemetry, mockUserHistory, tools, toolHandlers } from './agentData';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogEntry {
  type: 'thought' | 'tool_call' | 'tool_result' | 'final';
  message: string;
  data?: any;
}

export default function App() {
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [telemetry, setTelemetry] = useState(mockTelemetry);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  };

  const startDiagnosis = async () => {
    if (isDiagnosing) return;
    
    setIsDiagnosing(true);
    setStatus('running');
    setLogs([]);
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = "gemini-3-flash-preview";

    const systemInstruction = `
      You are a PC Support AI Agent. Your goal is to diagnose and resolve system issues.
      You have access to:
      1. Telemetry Data: Current system metrics.
      2. User History: Recent events on the PC.
      3. Knowledge Base (via searchKnowledgeBase tool).
      
      Follow these steps:
      1. Analyze the telemetry and history.
      2. Use tools to investigate further (logs, diagnostics).
      3. Search the KB for resolutions.
      4. Apply a fix if identified.
      5. Summarize the resolution.
      
      Current Telemetry: ${JSON.stringify(mockTelemetry)}
      User History: ${JSON.stringify(mockUserHistory)}
    `;

    try {
      let contents: any[] = [{ role: 'user', parts: [{ text: "Start system diagnosis based on the telemetry and history provided." }] }];
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        attempts++;
        
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: tools }],
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate) break;

        const content = candidate.content;
        contents.push(content);

        // Handle text response (thoughts)
        const textPart = content.parts.find(p => p.text);
        if (textPart?.text) {
          addLog({ type: 'thought', message: textPart.text });
        }

        // Handle function calls
        const functionCalls = candidate.content.parts.filter(p => p.functionCall);
        if (functionCalls.length > 0) {
          const toolResultsParts = [];
          
          for (const fc of functionCalls) {
            const call = fc.functionCall!;
            addLog({ type: 'tool_call', message: `Executing ${call.name}`, data: call.args });
            
            const handler = (toolHandlers as any)[call.name];
            const result = handler ? await handler(call.args) : "Tool not found";
            
            addLog({ type: 'tool_result', message: `Result from ${call.name}`, data: result });
            
            toolResultsParts.push({
              functionResponse: {
                name: call.name,
                response: { result }
              }
            });

            // Simulate fix applying in UI
            if (call.name === 'applyFix') {
              setTelemetry(prev => ({ ...prev, diskTemperature: 55, anomalies: [] }));
            }
          }

          contents.push({ role: 'user', parts: toolResultsParts });
        } else {
          // No more tool calls, we are done
          addLog({ type: 'final', message: "Diagnosis and resolution complete." });
          break;
        }
      }
    } catch (error) {
      console.error("Diagnosis failed:", error);
      addLog({ type: 'final', message: "Error during diagnosis: " + (error as Error).message });
    } finally {
      setIsDiagnosing(false);
      setStatus('completed');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Telemetry & History */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Terminal className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SupportAgent v1.0</h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest">System Diagnostic Interface</p>
            </div>
          </div>

          {/* Telemetry Card */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 overflow-hidden relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Live Telemetry
              </h2>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Connected
              </span>
            </div>

            <div className="space-y-4">
              <MetricRow 
                icon={<Cpu className="w-4 h-4" />} 
                label="CPU Load" 
                value={`${telemetry.cpuUsage}%`} 
                progress={telemetry.cpuUsage}
              />
              <MetricRow 
                icon={<Database className="w-4 h-4" />} 
                label="Memory" 
                value={`${telemetry.memoryUsage}%`} 
                progress={telemetry.memoryUsage}
              />
              <MetricRow 
                icon={<Thermometer className="w-4 h-4" />} 
                label="Disk Temp" 
                value={`${telemetry.diskTemperature}°C`} 
                progress={(telemetry.diskTemperature / 100) * 100}
                isAlert={telemetry.diskTemperature > 60}
              />
            </div>

            {telemetry.anomalies.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-400">Anomaly Detected</p>
                  <p className="text-[11px] text-zinc-400">{telemetry.anomalies[0].issue}</p>
                </div>
              </motion.div>
            )}
          </section>

          {/* History Card */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-6">
              <History className="w-4 h-4 text-blue-400" />
              User History
            </h2>
            <div className="space-y-4">
              {mockUserHistory.map((item, i) => (
                <div key={i} className="flex gap-3 relative">
                  {i !== mockUserHistory.length - 1 && (
                    <div className="absolute left-2 top-6 bottom-0 w-[1px] bg-zinc-800" />
                  )}
                  <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 shrink-0 z-10" />
                  <div>
                    <p className="text-[10px] text-zinc-500 font-mono">{item.date}</p>
                    <p className="text-xs font-medium">{item.event}</p>
                    {item.status && <p className="text-[10px] text-zinc-500">Status: {item.status}</p>}
                    {item.resolution && <p className="text-[10px] text-emerald-400">Fixed: {item.resolution}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Agent Console */}
        <div className="lg:col-span-2 flex flex-col h-[calc(100vh-4rem)]">
          
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-zinc-400" />
              Agent Console
            </h2>
            <button
              onClick={startDiagnosis}
              disabled={isDiagnosing}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all",
                isDiagnosing 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95"
              )}
            >
              {isDiagnosing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Diagnosing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Start Diagnosis
                </>
              )}
            </button>
          </div>

          {/* Console Output */}
          <div className="flex-1 bg-black border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-3 border-bottom border-zinc-800 bg-zinc-900/30 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 ml-2">agent_session_logs.sh</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-6 scrollbar-hide">
              {logs.length === 0 && !isDiagnosing && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                  <Search className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Standby. Click 'Start Diagnosis' to begin analysis.</p>
                </div>
              )}

              <AnimatePresence mode="popLayout">
                {logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "p-4 rounded-xl border",
                      log.type === 'thought' && "bg-zinc-900/20 border-zinc-800 text-zinc-300",
                      log.type === 'tool_call' && "bg-blue-500/5 border-blue-500/20 text-blue-400",
                      log.type === 'tool_result' && "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
                      log.type === 'final' && "bg-zinc-100 text-black border-white font-bold"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase tracking-widest font-bold">
                      {log.type === 'thought' && "Agent Thought"}
                      {log.type === 'tool_call' && "Action Required"}
                      {log.type === 'tool_result' && "System Response"}
                      {log.type === 'final' && "Final Resolution"}
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{log.message}</p>
                    {log.data && (
                      <div className="mt-2 p-2 bg-black/40 rounded border border-white/5 text-[11px] text-zinc-500 overflow-x-auto">
                        {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, progress, isAlert }: { icon: React.ReactNode, label: string, value: string, progress: number, isAlert?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          {icon}
          <span>{label}</span>
        </div>
        <span className={cn("font-mono font-bold", isAlert ? "text-red-400" : "text-zinc-100")}>
          {value}
        </span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn(
            "h-full transition-colors duration-500",
            isAlert ? "bg-red-500" : "bg-emerald-500"
          )}
        />
      </div>
    </div>
  );
}
