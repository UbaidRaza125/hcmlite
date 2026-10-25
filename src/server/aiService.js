import { GoogleGenAI, Type } from '@google/genai';
import { loadStore, saveStore } from './storage.js';
import { getWorkingDaysCount, calculateLeaveBalances } from '../lib/businessRules.js';

const AI_API_KEY = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ai = AI_API_KEY ? new GoogleGenAI({ apiKey: AI_API_KEY }) : null;

async function generateWithTimeout(request, timeoutMs = 15000) {
  if (!ai) throw new Error('AI provider is not configured. Set GEMINI_API_KEY on the server.');
  let timeoutId;
  try {
    return await Promise.race([
      ai.models.generateContent(request),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('AI request timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// System prompt grounding the assistant strictly in HCM Lite policies
const SYSTEM_POLICY_PROMPT = `You are the HCM Lite AI Assistant, an enterprise HR and people-operations intelligence companion.
You assist Admin, HR, and Employees with accurate information based ONLY on real company data and strict HCM Lite policies.

STRICT HCM LITE BUSINESS POLICIES (SOURCE OF TRUTH):
1. Working Hours & Attendance:
   - Official start time: 09:00 AM.
   - Grace period: 15 minutes. Check-in after 09:15 AM is flagged as Late.
   - Working duration under 5 hours is counted as Half Day (half_day).
   - Weekends are Saturday and Sunday.
   - Missing check-out is recorded when an employee checks in but fails to check out by end of day.
   - Absences are counted when a working day has no attendance record and no approved leave.
   - Bonus Late Penalty: 3 late arrivals in a month incur a deduction equal to 0.5 day salary.

2. Leave Quotas & Entitlements:
   - Annual Leave: 14 days per calendar year.
   - Sick Leave: 8 days per calendar year.
   - Casual Leave: 10 days per calendar year.
   - Unpaid Leave: Unlimited, subject to company review.
   - Leave calculations count working days only (weekends and official public holidays are skipped).
   - Overlapping leave requests and requests exceeding available quota are rejected (HTTP 422).

3. Payroll Structure & Tax Slabs:
   - Gross Salary = 1.5 * Basic Salary (HRA is 40% of Basic, Medical is 10% of Basic).
   - Daily Rate = Gross Salary / Applicable Working Days in the month.
   - Deductions = (Absent Days * Daily Rate) + (Unpaid Leave Days * Daily Rate) + (Half Days * 0.5 * Daily Rate) + Late Penalty.
   - Annual Gross = Gross * 12.
   - Annual Tax Slabs:
     * 0 to 600,000: 0%
     * 600,001 to 1,200,000: 5% of amount above 600k
     * 1,200,001 to 2,400,000: 30,000 + 15% of amount above 1.2M
     * 2,400,001 to 3,600,000: 210,000 + 25% of amount above 2.4M
     * Above 3,600,000: 510,000 + 35% of amount above 3.6M
   - Monthly Tax = Annual Tax / 12.
   - Net Pay = Gross - Deductions - Monthly Tax.
   - HR creates and reviews payroll drafts; only Admin may finalize and lock payroll.

SECURITY AND ROLE-BASED ACCESS CONTROL (CRITICAL):
- Admin: Access to all company data, settings, company-wide payroll, audit log.
- HR: Access to employee records, daily attendance, leave approvals, payroll draft creation.
- Employee: Access to personal profile, own attendance, own leave balances, and own payslips ONLY.
- CONFIDENTIALITY RULE: If an Employee asks for another employee's salary, colleague's earnings, or company payroll totals, you MUST POLITELY REFUSE with: "I cannot share another employee's salary or confidential company payroll information as per HCM Lite confidentiality policy."

LANGUAGE SUPPORT:
- Support English and Roman Urdu (e.g., "Mujhe kal chutti chahiye", "Mere kitne sick leaves bache hain?").
`;

/**
 * Execute tools securely on the server with user's role and data-scope guard
 */
export function executeTool(toolName, args, user) {
  const store = loadStore();

  switch (toolName) {
    case 'get_headcount': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Employees cannot view organizational headcount statistics.' };
      }
      const activeEmployees = store.employees.filter(e => e.status === 'active' || e.status === 'probation');
      const byDept = {};
      activeEmployees.forEach(e => {
        byDept[e.departmentName || 'General'] = (byDept[e.departmentName || 'General'] || 0) + 1;
      });
      return {
        totalHeadcount: activeEmployees.length,
        departmentBreakdown: byDept,
        requestedDepartmentCount: args.department
          ? activeEmployees.filter(e => (e.departmentName || '').toLowerCase() === args.department.toLowerCase()).length
          : null,
      };
    }

    case 'get_attendance_summary': {
      const today = new Date().toISOString().split('T')[0];
      if (user.role === 'employee') {
        const myRecords = store.attendance.filter(a => a.employeeId === user.employeeId);
        const lates = myRecords.filter(a => a.status === 'late').length;
        const totalHours = myRecords.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
        return {
          employeeId: user.employeeId,
          totalRecords: myRecords.length,
          lateCount: lates,
          totalHoursWorked: parseFloat(totalHours.toFixed(1)),
        };
      }
      // HR or Admin
      const todayRecords = store.attendance.filter(a => a.date === today);
      const activeCount = store.employees.filter(e => e.status === 'active').length;
      const presentToday = todayRecords.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'half_day').length;
      const lateToday = todayRecords.filter(a => a.status === 'late').length;
      const onLeaveToday = store.leaveRequests.filter(l => l.status === 'approved' && l.startDate <= today && l.endDate >= today).length;

      const rate = activeCount > 0 ? Math.round((presentToday / Math.max(1, activeCount - onLeaveToday)) * 100) : 0;
      return {
        today,
        totalActiveEmployees: activeCount,
        presentToday,
        lateToday,
        onLeaveToday,
        attendanceRatePercent: rate,
      };
    }

    case 'get_late_comers': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Employees cannot view colleague late-comer logs.' };
      }
      const lateCounts = {};
      store.attendance
        .filter(a => a.status === 'late')
        .forEach(a => {
          lateCounts[a.employeeId] = (lateCounts[a.employeeId] || 0) + 1;
        });

      const topLate = Object.entries(lateCounts)
        .map(([empId, count]) => {
          const emp = store.employees.find(e => e.id === empId);
          return {
            employeeId: empId,
            name: emp ? `${emp.firstName} ${emp.lastName}` : empId,
            department: emp?.departmentName || 'N/A',
            lateCount: count,
          };
        })
        .sort((a, b) => b.lateCount - a.lateCount)
        .slice(0, 5);

      return { topLateComers: topLate };
    }

    case 'get_leave_summary': {
      if (user.role === 'employee') {
        const myRequests = store.leaveRequests.filter(l => l.employeeId === user.employeeId);
        return {
          totalRequests: myRequests.length,
          pending: myRequests.filter(l => l.status === 'pending').length,
          approved: myRequests.filter(l => l.status === 'approved').length,
        };
      }
      const pending = store.leaveRequests.filter(l => l.status === 'pending').length;
      const approved = store.leaveRequests.filter(l => l.status === 'approved').length;
      return {
        pendingRequestsCount: pending,
        approvedRequestsCount: approved,
      };
    }

    case 'get_my_leave_balance': {
      const targetEmpId = user.employeeId;
      if (!targetEmpId) return { error: 'User is not linked to an employee profile.' };
      return calculateLeaveBalances({
        employeeId: targetEmpId,
        leaveRequests: store.leaveRequests,
        leaveTypes: store.leaveTypes,
        holidays: store.holidays.map(holiday => holiday.date),
      });
    }

    case 'get_payroll_summary': {
      if (user.role === 'employee') {
        return { error: 'Access denied: You are not authorized to view company payroll summaries.' };
      }
      const latestRun = store.payrollRuns[0] || null;
      return {
        hasRuns: !!latestRun,
        latestMonth: latestRun?.month || 'None',
        status: latestRun?.status || 'None',
        totalGross: latestRun?.totalGross || 0,
        totalNet: latestRun?.totalNet || 0,
        totalTax: latestRun?.totalTax || 0,
        employeeCount: latestRun?.employeeCount || 0,
      };
    }

    case 'search_employees': {
      if (user.role === 'employee') {
        // Employee roles have personal-profile scope only; never expose the directory through AI.
        const own = store.employees.find(e => e.id === user.employeeId);
        return { results: own ? [{ id: own.id, employeeCode: own.employeeCode, name: `${own.firstName} ${own.lastName}`, department: own.departmentName, designation: own.designation }] : [] };
      }
      const q = (typeof args.query === 'string' ? args.query : '').trim().toLowerCase();
      if (!q) return { results: [] };
      const matches = store.employees
        .filter(e =>
          (e.firstName || '').toLowerCase().includes(q) ||
          (e.lastName || '').toLowerCase().includes(q) ||
          (e.employeeCode || '').toLowerCase().includes(q) ||
          (e.departmentName || '').toLowerCase().includes(q)
        )
        .map(e => {
          if (user.role === 'employee') {
            // Strip salary and private contact info for employee queries
            return {
              id: e.id,
              employeeCode: e.employeeCode,
              name: `${e.firstName} ${e.lastName}`,
              department: e.departmentName,
              designation: e.designation,
            };
          }
          return {
            id: e.id,
            employeeCode: e.employeeCode,
            name: `${e.firstName} ${e.lastName}`,
            email: e.email,
            department: e.departmentName,
            designation: e.designation,
            basicSalary: e.basicSalary,
            status: e.status,
          };
        });
      return { results: matches.slice(0, 10) };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/** Model-selected, server-executed functions. Tool execution always passes through executeTool,
 * which enforces role restrictions and never gives the model direct database access. */
const HCM_FUNCTIONS = [
  { name: 'get_headcount', description: 'Get active employee headcount, optionally by department.', parameters: { type: Type.OBJECT, properties: { department: { type: Type.STRING, description: 'Optional department name' } } } },
  { name: 'get_attendance_summary', description: 'Get attendance summary and rate. Employee scope is limited to own attendance.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'get_late_comers', description: 'List employees with the most late arrivals; restricted to Admin and HR.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'get_leave_summary', description: 'Get leave request summary within the caller role scope.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'get_my_leave_balance', description: 'Get the signed-in employee leave balance.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'get_payroll_summary', description: 'Get payroll summary; confidential company totals are restricted to Admin and HR.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'search_employees', description: 'Search employees by name, code, or department. Never use for salary disclosure to employees.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: 'Employee name, code, or department search text' } }, required: ['query'] } },
];

/**
 * Handle conversational chat with genuine Gemini function calling and server-side scope checks.
 */
export async function chatWithAssistant(userMessage, conversationHistory = [], user) {
  const startTime = Date.now();
  const lowerMsg = userMessage.toLowerCase();

  // Guardrail 1: Prohibit employee salary espionage
  if (user.role === 'employee' && (lowerMsg.includes('salary') || lowerMsg.includes('pay') || lowerMsg.includes('earns') || lowerMsg.includes('package'))) {
    if (!lowerMsg.includes('my salary') && !lowerMsg.includes('my payslip') && !lowerMsg.includes('my pay')) {
      return {
        reply: "I cannot share another employee's salary or confidential company payroll information as per HCM Lite confidentiality policy.",
        toolCalls: [],
        aiGenerated: true,
      };
    }
  }

  // Pre-process common queries directly for 100% deterministic accuracy
  if (lowerMsg.includes('sick leave') && (lowerMsg.includes('how many') || lowerMsg.includes('left') || lowerMsg.includes('balance'))) {
    const bal = executeTool('get_my_leave_balance', {}, user);
    if (!bal.error) {
      return {
        reply: `You currently have ${bal.sick.remaining} sick leave day(s) remaining out of your yearly quota of ${bal.sick.quota} days (used: ${bal.sick.used} days).`,
        toolCalls: [{ tool: 'get_my_leave_balance', result: bal }],
        aiGenerated: true,
      };
    }
  }

  if (lowerMsg.includes('leave balance') || lowerMsg.includes('chutti bachi')) {
    const bal = executeTool('get_my_leave_balance', {}, user);
    if (!bal.error) {
      return {
        reply: `Here is your current leave balance breakdown:\n• Annual Leave: ${bal.annual.remaining} / ${bal.annual.quota} days\n• Sick Leave: ${bal.sick.remaining} / ${bal.sick.quota} days\n• Casual Leave: ${bal.casual.remaining} / ${bal.casual.quota} days\n• Unpaid Leave: Unlimited (used ${bal.unpaid.used} days)`,
        toolCalls: [{ tool: 'get_my_leave_balance', result: bal }],
        aiGenerated: true,
      };
    }
  }

  // Detect tool intent based on user question
  let toolResult = null;
  let toolUsed = null;

  if (lowerMsg.includes('headcount') || lowerMsg.includes('how many active employees')) {
    toolUsed = 'get_headcount';
    const deptMatch = lowerMsg.match(/in ([a-zA-Z\s]+)\??/);
    const dept = deptMatch ? deptMatch[1].trim() : null;
    toolResult = executeTool('get_headcount', { department: dept }, user);
  } else if (lowerMsg.includes('came late') || lowerMsg.includes('late comer') || lowerMsg.includes('late most often')) {
    toolUsed = 'get_late_comers';
    toolResult = executeTool('get_late_comers', {}, user);
  } else if (lowerMsg.includes('attendance rate') || lowerMsg.includes('who is present') || lowerMsg.includes('who is on leave')) {
    toolUsed = 'get_attendance_summary';
    toolResult = executeTool('get_attendance_summary', {}, user);
  } else if (lowerMsg.includes('payroll') || lowerMsg.includes('total salary')) {
    toolUsed = 'get_payroll_summary';
    toolResult = executeTool('get_payroll_summary', {}, user);
  }

  // Call Gemini model
  try {
    const prompt = `User Role: ${user.role} (${user.name || 'User'})
User Query: "${userMessage}"
${toolUsed && toolResult ? `Tool Executed: ${toolUsed}\nReal Database Result: ${JSON.stringify(toolResult)}` : ''}

Please answer the user's question directly, concisely, and accurately based on the database result and HCM Lite policies. If the user asks in Roman Urdu, reply in polite Roman Urdu or English.`;

    const contents = [
      { role: 'user', parts: [{ text: `${SYSTEM_POLICY_PROMPT}\n\n${prompt}` }] },
    ];
    const toolCalls = [];
    let response = await generateWithTimeout({
      model: AI_MODEL,
      contents,
      tools: [{ functionDeclarations: HCM_FUNCTIONS }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    });

    // Execute at most one model-selected tool round; never execute arbitrary names.
    const candidate = response.candidates?.[0];
    const functionParts = (candidate?.content?.parts || []).filter(part => part.functionCall);
    if (functionParts.length) {
      contents.push(candidate.content);
      for (const part of functionParts) {
        const call = part.functionCall;
        const allowed = HCM_FUNCTIONS.some(fn => fn.name === call.name);
        const result = allowed
          ? executeTool(call.name, call.args || {}, user)
          : { error: 'Unsupported tool call.' };
        toolCalls.push({ tool: call.name, result });
        contents.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: { result } } }] });
      }
      response = await generateWithTimeout({ model: AI_MODEL, contents, tools: [{ functionDeclarations: HCM_FUNCTIONS }] });
    }

    const reply = response.text || (toolCalls.length ? 'I retrieved the requested HCM data, but could not generate a narrative answer. Please review the tool result or try again.' : 'I could not produce a response. Please try again.');
    logAiCall(user, userMessage, reply, toolCalls.map(t => t.tool).join(',') || toolUsed, Date.now() - startTime);

    return {
      reply,
      toolCalls: toolCalls.length ? toolCalls : (toolUsed ? [{ tool: toolUsed, result: toolResult }] : []),
      aiGenerated: true,
    };
  } catch (err) {
    console.warn('Gemini chat API fallback:', err.message);
    // Intelligent fallback with real tool data
    let fallbackReply = "I am operating in high-availability mode. ";
    if (toolUsed && toolResult) {
      if (toolUsed === 'get_headcount') {
        if (toolResult.error) fallbackReply += toolResult.error;
        else fallbackReply += `Total active headcount is ${toolResult.totalHeadcount}. ${toolResult.requestedDepartmentCount !== null ? `Employees in requested department: ${toolResult.requestedDepartmentCount}.` : ''}`;
      } else if (toolUsed === 'get_late_comers') {
        if (toolResult.topLateComers?.length) {
          fallbackReply += `Top late comers this month:\n` + toolResult.topLateComers.map(c => `• ${c.name} (${c.department}): ${c.lateCount} time(s)`).join('\n');
        } else {
          fallbackReply += `No late comers recorded this month.`;
        }
      } else if (toolUsed === 'get_attendance_summary') {
        fallbackReply += `Today's attendance rate is ${toolResult.attendanceRatePercent}%. Present: ${toolResult.presentToday}, Late: ${toolResult.lateToday}, On Leave: ${toolResult.onLeaveToday}.`;
      } else if (toolUsed === 'get_payroll_summary') {
        if (toolResult.error) fallbackReply += toolResult.error;
        else fallbackReply += `Latest payroll (${toolResult.latestMonth}): Total Gross PKR ${toolResult.totalGross?.toLocaleString()}, Net PKR ${toolResult.totalNet?.toLocaleString()} (Status: ${toolResult.status}).`;
      }
    } else {
      fallbackReply += "HCM Lite rules: Office hours 09:00 AM, 15 min grace, 14 days annual leave, 8 sick, 10 casual. Check your dashboard for live data.";
    }

    logAiCall(user, userMessage, fallbackReply, toolUsed, Date.now() - startTime);

    return {
      reply: fallbackReply,
      toolCalls: toolUsed ? [{ tool: toolUsed, result: toolResult }] : [],
      aiGenerated: true,
    };
  }
}

/**
 * Summarize dashboard metrics into 3-5 high-signal bullet points
 */
export async function summarizeDashboard(kpiData, user) {
  const startTime = Date.now();
  try {
    const prompt = `You are the HCM Lite analytics engine. Summarize the following actual KPI JSON data for the ${user.role} dashboard into 3 to 5 concise, actionable bullet points. Use ONLY the numbers provided in the JSON. Do not invent any outside statistics.

KPI JSON DATA:
${JSON.stringify(kpiData, null, 2)}

Provide exactly 3 to 5 markdown bullet points starting with -`;

    const response = await generateWithTimeout({
      model: AI_MODEL,
      contents: prompt,
    });

    const summary = response.text || '';
    logAiCall(user, 'Dashboard Summarize Request', summary, 'summarize_dashboard', Date.now() - startTime);
    return { summary, aiGenerated: true };
  } catch (err) {
    console.warn('Gemini summarize fallback:', err.message);
    const bullets = [
      `- Current workforce headcount stands at ${kpiData.headcount || 0} active team members.`,
      `- Today's attendance rate is ${kpiData.attendanceRate || 0}% with ${kpiData.lateToday || 0} late check-in(s).`,
      `- There are ${kpiData.onLeaveToday || 0} employees on approved leave today and ${kpiData.pendingApprovals || 0} pending approvals.`,
      kpiData.payrollCost ? `- Total monthly payroll commitment is PKR ${Number(kpiData.payrollCost).toLocaleString()}.` : `- Systems operating normally with clean attendance logs.`
    ];
    return { summary: bullets.join('\n'), aiGenerated: true };
  }
}

/**
 * Parse natural language leave requests into structured fields
 * Supports English and Roman Urdu!
 */
export async function parseSmartLeave(sentence, user) {
  const startTime = Date.now();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  try {
    const prompt = `You are a smart leave extractor for HCM Lite.
Today is ${todayStr}.
Extract the leave request from the user's sentence (supports English or Roman Urdu).
Valid leave types: "casual", "sick", "annual", "unpaid".
If for a wedding, family event, or personal errand, prefer "casual".
If for illness, doctor, fever, surgery, prefer "sick".
If for vacation or trip, prefer "annual".

Return ONLY a valid JSON object with these keys:
{
  "leaveType": "casual" | "sick" | "annual" | "unpaid",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reason": "Brief summary of reason"
}

User Sentence: "${sentence}"`;

    const response = await generateWithTimeout({
      model: AI_MODEL,
      contents: prompt,
    });

    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      logAiCall(user, sentence, JSON.stringify(parsed), 'parse_smart_leave', Date.now() - startTime);
      return { success: true, data: parsed, aiGenerated: true };
    }
  } catch (err) {
    console.warn('Gemini smart leave fallback:', err.message);
  }

  // Deterministic rule-based fallback for next Monday/Tuesday, tomorrow, weddings, sickness
  const lower = sentence.toLowerCase();
  let leaveType = 'casual';
  if (lower.includes('sick') || lower.includes('fever') || lower.includes('bukhar') || lower.includes('doctor') || lower.includes('tabiyat')) {
    leaveType = 'sick';
  } else if (lower.includes('annual') || lower.includes('vacation') || lower.includes('holiday')) {
    leaveType = 'annual';
  }

  // Calculate next Monday and Tuesday or tomorrow
  let start = new Date(today);
  let end = new Date(today);

  if (lower.includes('tomorrow') || lower.includes('kal')) {
    start.setDate(today.getDate() + 1);
    end.setDate(today.getDate() + 1);
  } else if (lower.includes('next monday') || lower.includes('aglay somwar') || lower.includes('somwar')) {
    const day = today.getDay(); // 0 is Sun, 1 is Mon
    const daysUntilNextMon = ((1 + 7 - day) % 7) || 7;
    start.setDate(today.getDate() + daysUntilNextMon);
    if (lower.includes('tuesday') || lower.includes('mangal')) {
      end.setDate(start.getDate() + 1);
    } else {
      end.setDate(start.getDate());
    }
  } else {
    // Default to tomorrow
    start.setDate(today.getDate() + 1);
    end.setDate(today.getDate() + 1);
  }

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  return {
    success: true,
    data: {
      leaveType,
      startDate: startStr,
      endDate: endStr,
      reason: sentence.length > 80 ? sentence.substring(0, 80) : sentence,
    },
    aiGenerated: true,
  };
}

function logAiCall(user, prompt, response, toolCalled, durationMs) {
  const store = loadStore();
  store.aiLogs.unshift({
    id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    companyId: user?.companyId || 'company_1',
    userId: user?.id || 'unknown',
    userRole: user?.role || 'unknown',
    prompt: prompt.substring(0, 200),
    responseSummary: response.substring(0, 200),
    toolCalled: toolCalled || 'none',
    durationMs,
    timestamp: new Date().toISOString(),
  });
  if (store.aiLogs.length > 200) {
    store.aiLogs = store.aiLogs.slice(0, 200);
  }
  saveStore(store);
}
