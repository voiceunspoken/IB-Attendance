'use server'

import { prisma } from '../lib/prisma'

export async function getTodayAttendance() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [users, punchLogs, wfhRequests, leaveRequests] = await Promise.all([
    prisma.user.findMany({
      where: { disabled: false, code: { not: null } },
      select: {
        id: true, code: true, name: true, employeeType: true,
        department: { select: { name: true } },
        designation: { select: { name: true } },
      }
    }),
    prisma.punchLog.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      select: { userId: true, punchIn: true, punchOut: true, workLocation: true }
    }),
    prisma.wfhRequest.findMany({
      where: { status: 'approved', date: { gte: today, lt: tomorrow } },
      select: { userId: true, workType: true }
    }),
    prisma.leaveRequest.findMany({
      where: { status: 'approved', fromDate: { lte: tomorrow }, toDate: { gte: today } },
      select: { userId: true, leaveType: true }
    })
  ])

  const punchMap = Object.fromEntries(punchLogs.map(p => [p.userId, p]))
  const wfhMap = Object.fromEntries(wfhRequests.map(w => [w.userId, w]))
  const leaveMap = Object.fromEntries(leaveRequests.map(l => [l.userId, l]))

  const STATUS_ORDER = { working: 0, completed: 1, not_clocked: 2, leave: 3 }

  const hybrid = []
  const regularWfh = []

  for (const user of users) {
    const punch = punchMap[user.id]
    const wfh = wfhMap[user.id]
    const leave = leaveMap[user.id]
    const isHybrid = user.employeeType === 'hybrid'

    let status
    let workLocation = null
    let punchIn = null
    let punchOut = null

    if (leave) {
      status = 'leave'
    } else if (punch?.punchIn && !punch?.punchOut) {
      status = 'working'
      workLocation = punch.workLocation
      punchIn = punch.punchIn
    } else if (punch?.punchIn && punch?.punchOut) {
      status = 'completed'
      workLocation = punch.workLocation
      punchIn = punch.punchIn
      punchOut = punch.punchOut
    } else {
      status = 'not_clocked'
      if (wfh) workLocation = wfh.workType
    }

    const entry = {
      code: user.code,
      name: user.name,
      employeeType: user.employeeType,
      department: user.department?.name || '',
      designation: user.designation?.name || '',
      status,
      workLocation,
      punchIn: punchIn?.toISOString() || null,
      punchOut: punchOut?.toISOString() || null,
      leaveType: leave?.leaveType || null,
      sortKey: STATUS_ORDER[status],
    }

    if (isHybrid) {
      hybrid.push(entry)
    } else if (wfh && ['wfh', 'wos'].includes(wfh.workType)) {
      regularWfh.push(entry)
    }
  }

  hybrid.sort((a, b) => a.sortKey - b.sortKey)
  regularWfh.sort((a, b) => a.sortKey - b.sortKey)

  return { hybrid, regularWfh }
}
