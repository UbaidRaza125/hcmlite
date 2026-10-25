import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeekend,
  getWorkingDaysCount,
  evaluateAttendanceStatus,
  calculateAnnualTax,
  calculatePayroll,
  calculateHaversineDistance,
  verifyGeofence,
  calculateLeaveBalances,
} from '../lib/businessRules.js';

test('isWeekend accurately identifies Saturdays and Sundays', () => {
  assert.equal(isWeekend('2026-10-24'), true); // Saturday
  assert.equal(isWeekend('2026-10-25'), true); // Sunday
  assert.equal(isWeekend('2026-10-26'), false); // Monday
  assert.equal(isWeekend('2026-10-27'), false); // Tuesday
});

test('getWorkingDaysCount skips weekends and public holidays', () => {
  // Monday 2026-10-19 to Friday 2026-10-23 = 5 working days
  assert.equal(getWorkingDaysCount('2026-10-19', '2026-10-23'), 5);

  // Including weekend: Monday 2026-10-19 to Sunday 2026-10-25 = still 5 working days
  assert.equal(getWorkingDaysCount('2026-10-19', '2026-10-25'), 5);

  // With a public holiday on Wednesday 2026-10-21
  const holidays = ['2026-10-21'];
  assert.equal(getWorkingDaysCount('2026-10-19', '2026-10-23', holidays), 4);
});

test('evaluateAttendanceStatus applies 09:00 start + 15 min grace period', () => {
  // On-time check-in at 09:10
  const onTime = evaluateAttendanceStatus('09:10', '17:30');
  assert.equal(onTime.isLate, false);
  assert.equal(onTime.isHalfDay, false);
  assert.equal(onTime.status, 'present');

  // Late check-in at 09:16 (after 09:15 threshold)
  const late = evaluateAttendanceStatus('09:16', '17:30');
  assert.equal(late.isLate, true);
  assert.equal(late.status, 'late');

  // Half day: worked under 5 hours (e.g. 09:00 to 13:30 = 4.5 hours)
  const halfDay = evaluateAttendanceStatus('09:00', '13:30');
  assert.equal(halfDay.isHalfDay, true);
  assert.equal(halfDay.hoursWorked, 4.5);
  assert.equal(halfDay.status, 'half_day');
});

test('calculateAnnualTax follows the hackathon PDF slabs exactly', () => {
  // 0 to 600,000 -> 0%
  assert.equal(calculateAnnualTax(500000), 0);
  assert.equal(calculateAnnualTax(600000), 0);

  // 600,001 to 1.2M -> 5% above 600k
  // For 1,000,000 -> (1,000,000 - 600,000) * 0.05 = 20,000
  assert.equal(calculateAnnualTax(1000000), 20000);

  // 1.2M to 2.4M -> 30,000 + 15% above 1.2M
  // For 1,800,000 -> 30,000 + (600,000 * 0.15) = 30,000 + 90,000 = 120,000
  assert.equal(calculateAnnualTax(1800000), 120000);

  // 2.4M to 3.6M -> 210,000 + 25% above 2.4M
  // For 3,000,000 -> 210,000 + (600,000 * 0.25) = 210,000 + 150,000 = 360,000
  assert.equal(calculateAnnualTax(3000000), 360000);

  // Above 3.6M -> 510,000 + 35% above 3.6M
  // For 4,000,000 -> 510,000 + (400,000 * 0.35) = 510,000 + 140,000 = 650,000
  assert.equal(calculateAnnualTax(4000000), 650000);
});

test('calculatePayroll computes gross, deductions, tax, and net pay correctly', () => {
  const result = calculatePayroll({
    basicSalary: 100000,
    workingDaysInMonth: 22,
    absentDays: 1,
    unpaidLeaveDays: 0,
    halfDays: 2,
    lateCount: 3, // 3 lates = 0.5 day penalty
  });

  // Gross = 1.5 * 100,000 = 150,000
  assert.equal(result.grossSalary, 150000);
  assert.equal(result.hra, 40000);
  assert.equal(result.medicalAllowance, 10000);

  // Daily rate = 150,000 / 22 = 6818.18
  assert.equal(result.dailyRate, 6818.18);

  // Deductions:
  // 1 absent = 6818.18
  // 2 half days = 2 * 0.5 * 6818.18 = 6818.18
  // 3 lates penalty = 0.5 * 6818.18 = 3409.09
  // Total deductions = 6818.18 + 6818.18 + 3409.09 = 17045.45
  assert.equal(result.deductions.total, 17045.45);

  // Annual Gross = 150,000 * 12 = 1,800,000
  // Annual Tax = 120,000 -> Monthly Tax = 10,000
  assert.equal(result.annualTax, 120000);
  assert.equal(result.monthlyTax, 10000);

  // Net Pay = 150,000 - 17045.45 - 10000 = 122954.55
  assert.equal(result.netPay, 122954.55);
});

test('verifyGeofence checks office proximity and accuracy bounds', () => {
  const officeLat = 24.8607;
  const officeLng = 67.0011;

  // Inside office radius (< 150m) and good accuracy (< 100m)
  const valid = verifyGeofence({
    userLat: 24.8608,
    userLng: 67.0012,
    accuracy: 15,
    officeLat,
    officeLng,
    radius: 150,
  });
  assert.equal(valid.allowed, true);

  // Low accuracy (> 100m) rejected
  const badAccuracy = verifyGeofence({
    userLat: 24.8608,
    userLng: 67.0012,
    accuracy: 120,
    officeLat,
    officeLng,
  });
  assert.equal(badAccuracy.allowed, false);
  assert.match(badAccuracy.reason, /GPS accuracy too low/);

  // Far away (e.g. 5km away)
  const outside = verifyGeofence({
    userLat: 24.9000,
    userLng: 67.0500,
    accuracy: 20,
    officeLat,
    officeLng,
    radius: 150,
  });
  assert.equal(outside.allowed, false);
  assert.match(outside.reason, /Outside office radius/);
});


test('calculatePayroll prorates salary components for a mid-month joiner', () => {
  const result = calculatePayroll({
    basicSalary: 100000,
    workingDaysInMonth: 22,
    activeDaysInMonth: 11,
  });
  assert.equal(result.basicSalary, 50000);
  assert.equal(result.hra, 20000);
  assert.equal(result.medicalAllowance, 5000);
  assert.equal(result.grossSalary, 75000);
  assert.equal(result.dailyRate, 6818.18);
  // Tax remains annualized from the full monthly salary, not the partial first month.
  assert.equal(result.annualGross, 1800000);
  assert.equal(result.monthlyTax, 10000);
});

test('calculatePayroll handles zero or invalid working days without NaN', () => {
  const result = calculatePayroll({ basicSalary: 100000, workingDaysInMonth: 0, activeDaysInMonth: 0 });
  assert.equal(result.grossSalary, 0);
  assert.equal(Number.isFinite(result.dailyRate), true);
  assert.equal(Number.isFinite(result.netPay), true);
});


test('calculateLeaveBalances uses configured quotas, approved status, and calendar-year clipping', () => {
  const balances = calculateLeaveBalances({
    employeeId: 'emp_1',
    year: 2026,
    holidays: ['2026-01-01'],
    leaveTypes: [
      { id: 'annual_custom', name: 'Annual Leave', quotaDays: 14, isPaid: true },
      { id: 'personal_custom', name: 'Personal Leave', quotaDays: 4, isPaid: true },
      { id: 'leave_unpaid', name: 'Unpaid Leave', quotaDays: 999999, isPaid: false },
    ],
    leaveRequests: [
      { employeeId: 'emp_1', leaveTypeId: 'annual_custom', leaveTypeName: 'Annual Leave', status: 'approved', startDate: '2025-12-31', endDate: '2026-01-02', workingDays: 2 },
      { employeeId: 'emp_1', leaveTypeId: 'personal_custom', leaveTypeName: 'Personal Leave', status: 'pending', startDate: '2026-02-02', endDate: '2026-02-03', workingDays: 2 },
      { employeeId: 'emp_other', leaveTypeId: 'annual_custom', leaveTypeName: 'Annual Leave', status: 'approved', startDate: '2026-02-02', endDate: '2026-02-03', workingDays: 2 },
    ],
  });
  assert.equal(balances.annual.quota, 14);
  assert.equal(balances.annual.used, 1); // Jan 1 holiday is skipped; Jan 2 is a working day
  assert.equal(balances.annual.remaining, 13);
  assert.equal(balances.personal_leave.used, 0); // pending leave does not consume approved balance
  assert.equal(balances.unpaid.remaining, 'Unlimited');
});
