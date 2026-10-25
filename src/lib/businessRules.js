/**
 * HCM Lite — Core Business Rules & Formulas
 * Pure JavaScript logic functions for attendance, leave, payroll, and geofencing.
 */

/**
 * Checks if a given date string (YYYY-MM-DD) is a weekend (Saturday or Sunday)
 * @param {string|Date} date 
 * @returns {boolean}
 */
export function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Calculates working days between start date and end date inclusive,
 * excluding weekends and optional list of public holiday date strings (YYYY-MM-DD).
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} endDateStr - YYYY-MM-DD
 * @param {string[]} [holidays=[]] - Array of YYYY-MM-DD
 * @returns {number}
 */
export function getWorkingDaysCount(startDateStr, endDateStr, holidays = []) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (start > end) return 0;

  const holidaySet = new Set(holidays);
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const day = current.getDay();
    const isWknd = day === 0 || day === 6;
    const isHoliday = holidaySet.has(dateStr);

    if (!isWknd && !isHoliday) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate calendar-year leave balances from configured leave types and approved requests.
 * Requests spanning year boundaries are clipped to the requested year and counted as working
 * days, using the same weekend/holiday rules as leave submission.
 */
export function calculateLeaveBalances({ employeeId, leaveRequests = [], leaveTypes = [], holidays = [], year = new Date().getFullYear() }) {
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const types = leaveTypes.length ? leaveTypes : [
    { id: 'leave_annual', name: 'Annual Leave', quotaDays: 14, isPaid: true },
    { id: 'leave_sick', name: 'Sick Leave', quotaDays: 8, isPaid: true },
    { id: 'leave_casual', name: 'Casual Leave', quotaDays: 10, isPaid: true },
    { id: 'leave_unpaid', name: 'Unpaid Leave', quotaDays: 999999, isPaid: false },
  ];
  const byType = types.map(type => {
    const matching = leaveRequests.filter(request => {
      if (request.employeeId !== employeeId || request.status !== 'approved') return false;
      return request.leaveTypeId ? request.leaveTypeId === type.id : request.leaveTypeName === type.name;
    });
    const used = matching.reduce((total, request) => {
      if (!request.startDate || !request.endDate || request.endDate < startOfYear || request.startDate > endOfYear) return total;
      const clippedStart = request.startDate < startOfYear ? startOfYear : request.startDate;
      const clippedEnd = request.endDate > endOfYear ? endOfYear : request.endDate;
      const days = clippedStart === request.startDate && clippedEnd === request.endDate
        ? Number(request.workingDays) || getWorkingDaysCount(clippedStart, clippedEnd, holidays)
        : getWorkingDaysCount(clippedStart, clippedEnd, holidays);
      return total + days;
    }, 0);
    const quota = Math.max(0, Number(type.quotaDays) || 0);
    const unlimited = !type.isPaid || /unpaid/i.test(type.name) || quota >= 999999;
    const key = /annual/i.test(type.name) ? 'annual'
      : /sick/i.test(type.name) ? 'sick'
      : /casual/i.test(type.name) ? 'casual'
      : /unpaid/i.test(type.name) ? 'unpaid'
      : String(type.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || type.id;
    return { key, id: type.id, name: type.name, quota: unlimited ? 'Unlimited' : quota, used, remaining: unlimited ? 'Unlimited' : Math.max(0, quota - used), isPaid: !!type.isPaid };
  });
  const result = { types: byType };
  for (const entry of byType) {
    result[entry.key] = { quota: entry.quota, used: entry.used, remaining: entry.remaining };
  }
  return result;
}

/**
 * Determines attendance status for a check-in event.
 * Office start: 09:00. Grace period: 15 min.
 * Late if checkIn is after 09:15:00.
 * Half day if total working hours < 5.
 * 
 * @param {string} checkInTime - "HH:MM" or ISO string
 * @param {string|null} [checkOutTime=null] - "HH:MM" or ISO string
 * @param {string} [officeStart="09:00"]
 * @param {number} [graceMinutes=15]
 * @returns {{ status: string, isLate: boolean, isHalfDay: boolean, hoursWorked: number }}
 */
export function evaluateAttendanceStatus(checkInTime, checkOutTime = null, officeStart = "09:00", graceMinutes = 15) {
  let inHours = 9, inMinutes = 0;
  if (checkInTime.includes('T')) {
    const d = new Date(checkInTime);
    inHours = d.getHours();
    inMinutes = d.getMinutes();
  } else {
    const parts = checkInTime.split(':');
    inHours = parseInt(parts[0], 10);
    inMinutes = parseInt(parts[1], 10);
  }

  const [startH, startM] = officeStart.split(':').map(v => parseInt(v, 10));
  const lateThresholdMinutes = startH * 60 + startM + graceMinutes;
  const checkInTotalMinutes = inHours * 60 + inMinutes;

  const isLate = checkInTotalMinutes > lateThresholdMinutes;

  let hoursWorked = 0;
  let isHalfDay = false;

  if (checkOutTime) {
    let outHours = 17, outMinutes = 0;
    if (checkOutTime.includes('T')) {
      const d = new Date(checkOutTime);
      outHours = d.getHours();
      outMinutes = d.getMinutes();
    } else {
      const parts = checkOutTime.split(':');
      outHours = parseInt(parts[0], 10);
      outMinutes = parseInt(parts[1], 10);
    }
    const checkOutTotalMinutes = outHours * 60 + outMinutes;
    const diffMinutes = Math.max(0, checkOutTotalMinutes - checkInTotalMinutes);
    hoursWorked = parseFloat((diffMinutes / 60).toFixed(2));
    if (hoursWorked < 5) {
      isHalfDay = true;
    }
  }

  let status = "present";
  if (!checkOutTime) {
    status = isLate ? "late" : "present"; // missing checkout will be flagged if not closed at day end
  } else if (isHalfDay) {
    status = "half_day";
  } else if (isLate) {
    status = "late";
  }

  return {
    status,
    isLate,
    isHalfDay,
    hoursWorked,
  };
}

/**
 * Calculates annual income tax based on the hackathon brief slabs:
 * - 0 to 600k: 0%
 * - 600,001 to 1.2M: 5% of amount above 600k
 * - 1,200,001 to 2.4M: 30,000 + 15% of amount above 1.2M
 * - 2,400,001 to 3.6M: 210,000 + 25% of amount above 2.4M
 * - Above 3.6M: 510,000 + 35% of amount above 3.6M
 * 
 * @param {number} annualGross
 * @returns {number} annualTax
 */
export function calculateAnnualTax(annualGross) {
  if (annualGross <= 600000) {
    return 0;
  }
  if (annualGross <= 1200000) {
    return (annualGross - 600000) * 0.05;
  }
  if (annualGross <= 2400000) {
    return 30000 + (annualGross - 1200000) * 0.15;
  }
  if (annualGross <= 3600000) {
    return 210000 + (annualGross - 2400000) * 0.25;
  }
  return 510000 + (annualGross - 3600000) * 0.35;
}

/**
 * Calculates monthly payroll details for an employee according to PDF specification:
 * - Gross = 1.5 * Basic (HRA = 40% of basic, Medical = 10% of basic, Basic = 100%)
 * - Daily Rate = Gross / workingDaysInMonth
 * - Deductions = absentDays * DailyRate + unpaidLeaveDays * DailyRate + halfDays * (0.5 * DailyRate) + latePenalty
 * - Proration for joiners / leavers based on active days vs total working days
 * - Monthly Tax = Annual Tax / 12
 * - Net Pay = Gross - Deductions - Monthly Tax
 * 
 * @param {Object} params
 * @param {number} params.basicSalary
 * @param {number} params.workingDaysInMonth
 * @param {number} [params.absentDays=0]
 * @param {number} [params.unpaidLeaveDays=0]
 * @param {number} [params.halfDays=0]
 * @param {number} [params.lateCount=0]
 * @param {number} [params.activeDaysInMonth] - for proration, defaults to workingDaysInMonth
 * @returns {Object} Full payroll breakdown
 */
export function calculatePayroll({
  basicSalary,
  workingDaysInMonth,
  absentDays = 0,
  unpaidLeaveDays = 0,
  halfDays = 0,
  lateCount = 0,
  activeDaysInMonth = null,
}) {
  const fullBasic = Math.max(0, Number(basicSalary) || 0);
  const fullHra = parseFloat((fullBasic * 0.40).toFixed(2));
  const fullMedical = parseFloat((fullBasic * 0.10).toFixed(2));
  const fullGross = parseFloat((fullBasic + fullHra + fullMedical).toFixed(2));
  const totalWorkingDays = Math.max(1, Number(workingDaysInMonth) || 1);
  const eligibleDays = activeDaysInMonth === null
    ? totalWorkingDays
    : Math.min(totalWorkingDays, Math.max(0, Number(activeDaysInMonth) || 0));
  const activeRatio = eligibleDays / totalWorkingDays;

  // Prorate each salary component for joiners/leavers while keeping the daily rate based
  // on the full monthly gross divided by the month's applicable working days.
  const basic = parseFloat((fullBasic * activeRatio).toFixed(2));
  const hra = parseFloat((fullHra * activeRatio).toFixed(2));
  const medical = parseFloat((fullMedical * activeRatio).toFixed(2));
  const grossSalary = parseFloat((basic + hra + medical).toFixed(2));
  const dailyRate = parseFloat((fullGross / totalWorkingDays).toFixed(2));

  const absentDeduction = parseFloat((absentDays * dailyRate).toFixed(2));
  const unpaidLeaveDeduction = parseFloat((unpaidLeaveDays * dailyRate).toFixed(2));
  const halfDayDeduction = parseFloat((halfDays * 0.5 * dailyRate).toFixed(2));

  // Bonus late penalty rule (+10 pts in brief): 3 lates = 0.5 day deduction
  const latePenaltyMultiplier = Math.floor(lateCount / 3) * 0.5;
  const latePenaltyDeduction = parseFloat((latePenaltyMultiplier * dailyRate).toFixed(2));

  const totalDeductions = parseFloat(
    (absentDeduction + unpaidLeaveDeduction + halfDayDeduction + latePenaltyDeduction).toFixed(2)
  );

  // Annual gross is annualized based on full monthly gross
  const annualGross = fullGross * 12;
  const annualTax = calculateAnnualTax(annualGross);
  const monthlyTax = parseFloat((annualTax / 12).toFixed(2));

  const netPay = parseFloat(Math.max(0, grossSalary - totalDeductions - monthlyTax).toFixed(2));

  return {
    basicSalary: basic,
    hra,
    medicalAllowance: medical,
    grossSalary,
    dailyRate,
    workingDaysInMonth: totalWorkingDays,
    absentDays,
    unpaidLeaveDays,
    halfDays,
    lateCount,
    deductions: {
      absentDeduction,
      unpaidLeaveDeduction,
      halfDayDeduction,
      latePenaltyDeduction,
      total: totalDeductions,
    },
    annualGross,
    annualTax: parseFloat(annualTax.toFixed(2)),
    monthlyTax,
    netPay,
  };
}

/**
 * Haversine formula to compute distance in meters between two coordinates.
 * Used for camera attendance geofence verification.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in meters
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return parseFloat((R * c).toFixed(1));
}

/**
 * Validates camera attendance coordinates against office geofence.
 * @param {Object} params
 * @param {number} params.userLat
 * @param {number} params.userLng
 * @param {number} [params.accuracy=10] - in meters
 * @param {number} params.officeLat
 * @param {number} params.officeLng
 * @param {number} [params.radius=150] - allowed distance in meters
 * @returns {{ allowed: boolean, distanceMeters: number, reason?: string }}
 */
export function verifyGeofence({ userLat, userLng, accuracy = 10, officeLat, officeLng, radius = 150 }) {
  if (accuracy > 100) {
    return {
      allowed: false,
      distanceMeters: 0,
      reason: `GPS accuracy too low (${Math.round(accuracy)}m > 100m required)`,
    };
  }

  const distance = calculateHaversineDistance(userLat, userLng, officeLat, officeLng);
  if (distance > radius) {
    return {
      allowed: false,
      distanceMeters: distance,
      reason: `Outside office radius (${distance}m > ${radius}m allowed)`,
    };
  }

  return {
    allowed: true,
    distanceMeters: distance,
  };
}
