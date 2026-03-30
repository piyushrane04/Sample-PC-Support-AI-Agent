import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

// Mock Telemetry Data
export const mockTelemetry = {
  cpuUsage: 95,
  memoryUsage: 88,
  diskTemperature: 75, // Celsius (Anomaly: High)
  fanSpeed: 4500,
  batteryHealth: "Good",
  lastBootTime: "2026-03-30T08:00:00Z",
  anomalies: [
    { component: "Disk", issue: "High Temperature Detected", value: 75, threshold: 60 }
  ]
};

// Mock User History
export const mockUserHistory = [
  { date: "2026-03-15", event: "System Update", status: "Success" },
  { date: "2026-03-20", event: "User reported slow performance", resolution: "Restarted system" },
  { date: "2026-03-28", event: "Installed 'HeavyApp v2'", status: "Success" }
];

// Mock Knowledge Base
const knowledgeBase = [
  {
    topic: "High Disk Temperature",
    resolution: "Check for background indexing processes or failing hardware. Try disabling 'Indexing Service' or cleaning fans."
  },
  {
    topic: "CPU Spikes",
    resolution: "Identify high-usage processes. Often caused by browser extensions or antivirus scans."
  },
  {
    topic: "HeavyApp v2 Issues",
    resolution: "HeavyApp v2 is known to cause high disk I/O during initial indexing. Disabling its 'Auto-Sync' feature reduces temperature."
  }
];

// Tool Definitions for Gemini
export const tools: FunctionDeclaration[] = [
  {
    name: "checkSystemLogs",
    description: "Retrieves detailed system logs for a specific component.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        component: { type: Type.STRING, description: "The component to check (e.g., Disk, CPU, Memory)" }
      },
      required: ["component"]
    }
  },
  {
    name: "runDiagnostic",
    description: "Runs a specific diagnostic test on the system.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        testName: { type: Type.STRING, description: "The name of the test (e.g., DiskHealthCheck, FanTest)" }
      },
      required: ["testName"]
    }
  },
  {
    name: "searchKnowledgeBase",
    description: "Searches the internal knowledge base for resolutions to specific issues.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "The search query for the KB." }
      },
      required: ["query"]
    }
  },
  {
    name: "applyFix",
    description: "Applies a specific fix to the system.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        fixName: { type: Type.STRING, description: "The name of the fix to apply (e.g., DisableIndexing, CleanFansPrompt, DisableHeavyAppSync)" }
      },
      required: ["fixName"]
    }
  }
];

// Tool Implementations
export const toolHandlers = {
  checkSystemLogs: (args: { component: string }) => {
    if (args.component.toLowerCase() === "disk") {
      return "Log entry: 2026-03-30 12:00:01 - Disk I/O spike detected from process 'HeavyApp.exe'.";
    }
    return "No significant logs found for " + args.component;
  },
  runDiagnostic: (args: { testName: string }) => {
    if (args.testName === "DiskHealthCheck") {
      return "Diagnostic Result: Hardware health is 98%. High temperature is likely software-induced I/O stress.";
    }
    return "Diagnostic " + args.testName + " completed successfully.";
  },
  searchKnowledgeBase: (args: { query: string }) => {
    const results = knowledgeBase.filter(kb => 
      kb.topic.toLowerCase().includes(args.query.toLowerCase()) || 
      kb.resolution.toLowerCase().includes(args.query.toLowerCase())
    );
    return results.length > 0 ? JSON.stringify(results) : "No relevant KB articles found.";
  },
  applyFix: (args: { fixName: string }) => {
    return "Success: Applied fix '" + args.fixName + "'. System monitoring shows temperature decreasing.";
  }
};
