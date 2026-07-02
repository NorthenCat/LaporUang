"use client";

import React, { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { apiRequest } from "@/utils/api";
import { Button } from "@/components/atoms/Button";
import { FormField } from "@/components/molecules/FormField";
import {
  MessageSquareCode,
  Send,
  Plus,
  Settings,
  Bot,
  User,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  X,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  last_active_at: string;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  generated_at: string;
}

export default function AIChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // AI Config panel state
  const [showConfig, setShowConfig] = useState(false);
  const [providerName, setProviderName] = useState("Local LLM");
  const [baseURL, setBaseURL] = useState("http://localhost:11434/v1"); // default Ollama
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama3");
  const [hasAPIKey, setHasAPIKey] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);

  // Message states
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchInitialData = async () => {
    setIsLoadingSessions(true);
    try {
      const [sessionData, providerConfig] = await Promise.all([
        apiRequest("/ai/sessions"),
        apiRequest("/ai/provider"),
      ]);

      setSessions(sessionData || []);
      if (sessionData && sessionData.length > 0) {
        setActiveSessionId(sessionData[0].id);
      }

      if (providerConfig) {
        setProviderName(providerConfig.name || "OpenAI Compatible");
        setBaseURL(providerConfig.base_url || "");
        setSelectedModel(providerConfig.selected_model || "");
        setHasAPIKey(providerConfig.has_key || false);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchMessages = async (sessId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await apiRequest(`/ai/sessions/${sessId}/messages`);
      setMessages(msgs || []);
    } catch {
      // ignore
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfigSaving(true);

    try {
      await apiRequest("/ai/provider", "POST", {
        name: providerName,
        base_url: baseURL,
        api_key: apiKey,
        selected_model: selectedModel,
      });
      alert("AI Provider berhasil dikonfigurasi!");
      setShowConfig(false);
      setApiKey("");
      setHasAPIKey(true);
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan konfigurasi AI");
    } finally {
      setIsConfigSaving(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      const newSession = await apiRequest("/ai/sessions", "POST", { title: "Diskusi Keuangan" });
      if (newSession && newSession.id) {
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch {
      alert("Gagal membuat sesi obrolan baru");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSessionId || isSending) return;

    const userText = inputText;
    setInputText("");
    setIsSending(true);

    // Optimistically insert user message into list
    const tempUserMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      content: userText,
      generated_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const reply = await apiRequest(`/ai/sessions/${activeSessionId}/chat`, "POST", {
        message: userText,
      });

      if (reply) {
        setMessages((prev) => [...prev, reply]);
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghubungi AI Assistant");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto h-[85vh]">
        
        {/* Upper Header Welcome */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" /> Asisten AI Keuangan
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500">
              Konsultasi anggaran, prediksi cash flow harian, dan deteksi anomali rekening Anda.
            </p>
          </div>
          <Button
            onClick={() => setShowConfig(!showConfig)}
            variant="glass"
            className="flex items-center gap-1.5 shrink-0"
          >
            <Settings className="h-4 w-4" /> Setelan Endpoint
          </Button>
        </div>

        {/* AI Config modal drawer overlay */}
        {showConfig ? (
          <div className="glass-panel p-6 rounded-2xl border border-zinc-800 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Konfigurasi AI Server</h3>
              <button onClick={() => setShowConfig(false)} className="text-zinc-500 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <FormField
                label="Nama Endpoint"
                placeholder="Ollama / Local"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                required
              />
              <FormField
                label="Base URL API"
                placeholder="http://localhost:11434/v1"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                required
              />
              <FormField
                label="API Key (Kosongkan jika local)"
                type="password"
                placeholder={hasAPIKey ? "••••••••" : "Ketik API Key..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <FormField
                label="Nama Model Terpilih"
                placeholder="llama3, deepseek, gpt-4"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                required
              />
              <div className="sm:col-span-2 md:col-span-4 flex justify-end gap-2 mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowConfig(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isConfigSaving}>
                  Simpan Setelan
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Chat Main Workspace Panel split sidebar and main panel */}
        <div className="flex-1 w-full flex rounded-2xl glass-panel border border-zinc-800/80 overflow-hidden min-h-0 relative">
          
          {/* Chat Sessions Sidebar */}
          <div className={`absolute z-20 md:static w-[80%] max-w-[280px] md:w-64 h-full bg-[#0c121e] md:bg-transparent border-r border-zinc-800 flex flex-col shrink-0 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${showMobileSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
            <div className="p-4 border-b border-zinc-800 shrink-0">
              <Button
                onClick={() => {
                  handleCreateSession();
                  setShowMobileSidebar(false);
                }}
                variant="glass"
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2 border-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" /> Sesi Baru
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {isLoadingSessions ? (
                [1, 2, 3].map((idx) => (
                  <div key={idx} className="h-10 bg-zinc-900/40 rounded-lg animate-pulse" />
                ))
              ) : sessions.length > 0 ? (
                sessions.map((s) => {
                  const isActive = activeSessionId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold truncate transition flex justify-between items-center group cursor-pointer ${
                        isActive
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.15)]"
                          : "text-zinc-400 hover:text-white hover:bg-slate-900/40"
                      }`}
                    >
                      <span className="truncate">{s.title}</span>
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition shrink-0" />
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-xs text-zinc-600">Belum ada obrolan</div>
              )}
            </div>
          </div>

          {/* Mobile Overlay for Sidebar */}
          {showMobileSidebar && (
            <div 
              className="md:hidden absolute inset-0 bg-black/60 z-10 backdrop-blur-sm transition-opacity" 
              onClick={() => setShowMobileSidebar(false)}
            />
          )}

          {/* Active Chat panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/20">
            
            {/* Disclaimer Security info banner */}
            <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center gap-2 text-[10px] sm:text-xs text-zinc-500 font-semibold uppercase tracking-wider shrink-0">
              <button 
                onClick={() => setShowMobileSidebar(true)} 
                className="md:hidden p-1.5 bg-zinc-800/80 rounded-md text-zinc-300 hover:text-white shrink-0 cursor-pointer"
              >
                <MessageSquareCode className="w-4 h-4" />
              </button>
              <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
              <span className="truncate">Otomatis menyematkan ringkasan neraca kas & top pengeluaran 30 hari terakhir.</span>
            </div>

            {/* Message Thread Scrollport */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {activeSessionId ? (
                messages.length > 0 ? (
                  messages.map((m) => {
                    const isAI = m.sender === "ai";
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-3 max-w-[85%] ${isAI ? "self-start" : "self-end flex-row-reverse"}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center border shrink-0 ${
                            isAI
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.15)]"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {isAI ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>

                        {/* Speech Bubble */}
                        <div className="flex flex-col gap-1">
                          <div
                            className={`p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                              isAI
                                ? "bg-slate-900 border border-zinc-800/80 text-slate-100"
                                : "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_4px_15px_rgba(56,189,248,0.2)]"
                            }`}
                          >
                            {m.content}
                          </div>
                          <span
                            className={`text-[10px] text-zinc-650 font-semibold ${
                              isAI ? "self-start" : "self-end"
                            }`}
                          >
                            {new Date(m.generated_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <Bot className="h-12 w-12 text-zinc-750 stroke-[1.5]" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-400">Tanyakan Pada LaporUang AI</span>
                      <span className="text-xs text-zinc-600 max-w-[260px] mt-0.5 leading-relaxed">
                        Tanyakan "Berapa total saldo saya?", "Kategori apa pengeluaran terbesar saya?", atau "Bagaimana perkiraan cash flow saya bulan depan?"
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                  Pilih atau buat sesi baru untuk memulai percakapan.
                </div>
              )}

              {/* Glowing loading dots while AI replies */}
              {isSending ? (
                <div className="flex gap-3 max-w-[85%] self-start">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 text-zinc-150 p-4 rounded-2xl flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              ) : null}
            </div>

            {/* Input form */}
            {activeSessionId ? (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-800 shrink-0 flex gap-3">
                <input
                  type="text"
                  placeholder="Ketik pertanyaan finansial Anda di sini..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isSending}
                  className="flex-1 bg-slate-950/40 border border-zinc-800 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-50 placeholder:text-zinc-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="p-3 bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-500 hover:to-blue-700 text-white rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.25)] flex items-center justify-center active:scale-95 disabled:opacity-20 cursor-pointer shrink-0 transition-all"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </form>
            ) : null}

          </div>

        </div>

      </div>
    </MainLayout>
  );
}
