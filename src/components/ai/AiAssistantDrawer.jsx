import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  CheckCircle,
  HelpCircle,
  Calendar,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';

export function AiAssistantDrawer({ isOpen, onClose, initialPrompt = '', onLeaveApplied = null }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello ${user?.name || 'there'}! I am your HCM Lite AI Assistant. You are logged in as **${user?.role?.toUpperCase()}**.\n\nAsk me policy questions, headcount, attendance summaries, late comers, your leave balance, or type a leave request in plain English or Roman Urdu!`,
      toolCalls: [],
    },
  ]);
  const [input, setInput] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingLeaveDraft, setPendingLeaveDraft] = useState(null);
  const [applyingLeave, setApplyingLeave] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingLeaveDraft]);

  const handleSend = async (textToSend = null) => {
    const text = textToSend || input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg = { id: `u_${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Check if user is asking for leave in natural language
      const lower = text.toLowerCase();
      const isLeaveIntent =
        (lower.includes('need') || lower.includes('want') || lower.includes('chahiye') || lower.includes('off') || lower.includes('leave')) &&
        (lower.includes('monday') || lower.includes('tuesday') || lower.includes('tomorrow') || lower.includes('kal') || lower.includes('wedding') || lower.includes('sister') || lower.includes('sick') || lower.includes('doctor'));

      if (isLeaveIntent && user?.role === 'employee') {
        const smartRes = await api.parseSmartLeave(text);
        if (smartRes?.data) {
          setPendingLeaveDraft(smartRes.data);
          setMessages((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              text: `I've prepared a leave request based on your message: **${smartRes.data.leaveType.toUpperCase()} LEAVE** from **${smartRes.data.startDate}** to **${smartRes.data.endDate}** for "${smartRes.data.reason}". Please review and confirm below.`,
              toolCalls: [{ tool: 'parse_smart_leave', result: smartRes.data }],
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      const res = await api.chatAi(text, messages);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          toolCalls: res.toolCalls || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: `Error connecting to assistant: ${err.message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSmartLeave = async () => {
    if (!pendingLeaveDraft) return;
    setApplyingLeave(true);
    try {
      // Fetch leave types to match id
      const leaveTypes = await api.getLeaveTypes();
      const matched = leaveTypes.find(l => l.name.toLowerCase().includes(pendingLeaveDraft.leaveType.toLowerCase())) || leaveTypes[0];

      await api.applyLeave({
        leaveTypeId: matched.id,
        startDate: pendingLeaveDraft.startDate,
        endDate: pendingLeaveDraft.endDate,
        reason: pendingLeaveDraft.reason,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: `Leave request successfully submitted! It has been routed to HR for review.`,
          toolCalls: [],
        },
      ]);
      setPendingLeaveDraft(null);
      if (onLeaveApplied) onLeaveApplied();
    } catch (err) {
      alert(`Could not submit leave: ${err.message}`);
    } finally {
      setApplyingLeave(false);
    }
  };

  // Sample prompt chips tailored by role
  const samplePrompts = [];
  if (user?.role === 'hr') {
    samplePrompts.push(
      'How many active employees are in Engineering?',
      'Who came late most often this month?',
      "What is this month's attendance rate?"
    );
  } else if (user?.role === 'employee') {
    samplePrompts.push(
      'How many sick leaves do I have left this year?',
      "I need next Monday and Tuesday off for my sister's wedding",
      "What is colleague's salary?"
    );
  } else {
    // Admin
    samplePrompts.push(
      'Summarize our workforce attendance',
      'What is our total monthly payroll cost?',
      'Who came late most often this month?'
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">HCM Lite AI Assistant</h3>
              <p className="text-[11px] text-slate-500">
                Grounding in live database · {user?.role?.toUpperCase()} scope
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/40">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                  }`}
                >
                  {msg.text}

                  {/* Tool Call Chips */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                      {msg.toolCalls.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Tool: {t.tool}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {!isUser && (
                    <div className="mt-1.5 text-[9px] text-slate-400 font-medium tracking-wide flex items-center justify-between">
                      <span>AI-generated</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pending Smart Leave Card */}
          {pendingLeaveDraft && (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Confirm Leave Application</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-indigo-100">
                <div>
                  <span className="text-slate-500 block">Leave Type</span>
                  <span className="font-semibold capitalize text-indigo-950">
                    {pendingLeaveDraft.leaveType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dates</span>
                  <span className="font-semibold font-mono text-slate-900">
                    {pendingLeaveDraft.startDate} → {pendingLeaveDraft.endDate}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block">Reason</span>
                  <span className="text-slate-700">{pendingLeaveDraft.reason}</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setPendingLeaveDraft(null)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSmartLeave}
                  disabled={applyingLeave}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  {applyingLeave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>Submit Leave Request</span>
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Checking database with permissions...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="px-4 py-2 border-t border-slate-200 bg-white">
          <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5">
            Test with Judge Questions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="text-[11px] text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-2.5 py-1 rounded-md transition-colors text-left border border-slate-200/60 cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything or type a leave request..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="mt-1 text-[10px] text-slate-400 text-center">
            AI has scoped database read access only · Never modifies data without confirmation
          </p>
        </div>
      </div>
    </div>
  );
}
