import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type AttendanceRow = {
  id: string
  date: string
  morningShift: boolean
  morningStart: string
  morningEnd: string
  afternoonShift: boolean
  afternoonStart: string
  afternoonEnd: string
  overtime: string
  totalHours: number
}

type TabType = 'attendance' | 'summary' | 'salary'

type LoginForm = {
  username: string
  password: string
}

const STORAGE_KEYS = {
  auth: 'attendance-auth',
  data: 'attendance-data',
  baseSalary: 'attendance-base-salary',
}

const DEFAULT_LOGIN: LoginForm = {
  username: 'admin',
  password: '123456',
}

const DEFAULT_BASE_SALARY = 35000

const timeToMinutes = (value: string) => {
  if (!value) return 0
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

const calculateShiftHours = (start: string, end: string) => {
  if (!start || !end) return 0
  const duration = Math.max(timeToMinutes(end) - timeToMinutes(start), 0)
  return Number((duration / 60).toFixed(2))
}

const normalizeMinutesToHours = (minutes: number) => {
  return Number((minutes / 60).toFixed(2))
}

const calculateDailyHours = (row: AttendanceRow) => {
  const morningHours = row.morningShift ? calculateShiftHours(row.morningStart, row.morningEnd) : 0
  const afternoonHours = row.afternoonShift ? calculateShiftHours(row.afternoonStart, row.afternoonEnd) : 0
  const overtimeMinutes = Number.parseFloat(row.overtime || '0') || 0
  const overtimeHours = normalizeMinutesToHours(overtimeMinutes)
  return Number((morningHours + afternoonHours + overtimeHours).toFixed(2))
}

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMonthInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const isFutureDate = (value: string) => {
  if (!value) return false
  const today = new Date()
  const todayValue = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const selectedValue = new Date(`${value}T00:00:00`).getTime()
  return selectedValue > todayValue
}

const emptyForm = (): AttendanceRow => ({
  id: '',
  date: formatDateInput(new Date()),
  morningShift: true,
  morningStart: '07:45',
  morningEnd: '11:45',
  afternoonShift: true,
  afternoonStart: '13:45',
  afternoonEnd: '17:45',
  overtime: '0',
  totalHours: 0,
})

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('attendance')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => formatMonthInput(new Date()))
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem(STORAGE_KEYS.auth)
    return saved ? saved === 'true' : false
  })
  const [loginForm, setLoginForm] = useState<LoginForm>(DEFAULT_LOGIN)
  const [loginError, setLoginError] = useState('')
  const [dateError, setDateError] = useState('')
  const [form, setForm] = useState<AttendanceRow>(emptyForm())
  const [baseSalary, setBaseSalary] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_BASE_SALARY
    const saved = Number(window.localStorage.getItem(STORAGE_KEYS.baseSalary))
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_BASE_SALARY
  })
  const [entries, setEntries] = useState<AttendanceRow[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = window.localStorage.getItem(STORAGE_KEYS.data)
    if (!saved) return []

    try {
      const parsed = JSON.parse(saved) as AttendanceRow[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(entries))
    }
  }, [entries])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.auth, String(isLoggedIn))
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.baseSalary, String(baseSalary))
    }
  }, [baseSalary])

  const currentMonthEntries = useMemo(() => {
    return entries.filter((entry) => entry.date.startsWith(selectedMonth))
  }, [entries, selectedMonth])

  const monthSummary = useMemo(() => {
    const workedDays = currentMonthEntries.filter((entry) => entry.totalHours > 0).length
    const totalHours = currentMonthEntries.reduce((sum, entry) => sum + entry.totalHours, 0)
    const salary = totalHours * baseSalary + (workedDays >= 27 ? 700000 : 0)

    return {
      totalDays: currentMonthEntries.length,
      workedDays,
      totalHours,
      salary,
    }
  }, [baseSalary, currentMonthEntries])

  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    if (!year || !month) return []

    const firstDay = new Date(year, month - 1, 1)
    const offset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month, 0).getDate()
    const totalCells = Math.ceil((daysInMonth + offset) / 7) * 7
    const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]))

    return Array.from({ length: totalCells }, (_, index) => {
      const currentDay = index - offset + 1
      const date = new Date(year, month - 1, currentDay)
      const dateKey = formatDateInput(date)

      return {
        dateKey,
        dayNumber: date.getDate(),
        inMonth: date.getMonth() === month - 1,
        entry: entriesByDate.get(dateKey),
      }
    })
  }, [entries, selectedMonth])

  const exportToExcel = () => {
    const rows = [
      ['Ngày', 'Ca sáng', 'Bắt đầu sáng', 'Kết thúc sáng', 'Ca chiều', 'Bắt đầu chiều', 'Kết thúc chiều', 'Tăng ca', 'Tổng giờ'],
      ...entries
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => [
          entry.date,
          entry.morningShift ? 'Có' : 'Không',
          entry.morningShift ? entry.morningStart : '--:--',
          entry.morningShift ? entry.morningEnd : '--:--',
          entry.afternoonShift ? 'Có' : 'Không',
          entry.afternoonShift ? entry.afternoonStart : '--:--',
          entry.afternoonShift ? entry.afternoonEnd : '--:--',
          entry.overtime || '0',
          entry.totalHours.toFixed(2),
        ]),
    ]

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n')

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bang-cham-cong-${selectedMonth}.xls`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (
      loginForm.username.trim() === DEFAULT_LOGIN.username &&
      loginForm.password.trim() === DEFAULT_LOGIN.password
    ) {
      setIsLoggedIn(true)
      setLoginError('')
      return
    }

    setLoginError('Sai tài khoản hoặc mật khẩu. Vui lòng dùng admin / 123456')
  }

  const handleFormChange = <K extends keyof AttendanceRow>(field: K, value: AttendanceRow[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      const relevantFields = [
        'morningShift',
        'morningStart',
        'morningEnd',
        'afternoonShift',
        'afternoonStart',
        'afternoonEnd',
        'overtime',
      ]

      if (relevantFields.includes(field)) {
        return { ...next, totalHours: calculateDailyHours(next) }
      }

      return next
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.date) {
      setDateError('Vui lòng chọn ngày chấm công.')
      return
    }

    if (isFutureDate(form.date)) {
      setDateError('Ngày chấm công không hợp lệ. Vui lòng chọn ngày hiện tại hoặc quá khứ.')
      return
    }

    setDateError('')

    const normalizedEntry: AttendanceRow = {
      ...form,
      id: form.id || `entry-${form.date}`,
      totalHours: calculateDailyHours(form),
    }

    setEntries((current) => {
      const filtered = current.filter((entry) => entry.date !== form.date)
      return [...filtered, normalizedEntry].sort((a, b) => a.date.localeCompare(b.date))
    })

    setForm(emptyForm())
  }

  const handleDelete = (date: string) => {
    setEntries((current) => current.filter((entry) => entry.date !== date))
  }

  return (
    <>
      {!isLoggedIn ? (
        <div className="login-screen">
          <div className="login-card">
            <p className="login-tag">HỆ THỐNG QUẢN LÝ CHẤM CÔNG</p>
            <h1>Đăng nhập</h1>
            <form onSubmit={handleLogin} className="login-form">
              <label>
                <span>Tài khoản</span>
                <input
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="admin"
                />
              </label>
              <label>
                <span>Mật khẩu</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="123456"
                />
              </label>

              {loginError && <p className="login-error">{loginError}</p>}

              <button type="submit" className="primary-button">
                Đăng nhập
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="app-root">
          <div className="app-shell">
            <header className="topbar">
              <div>
                <p className="eyebrow">Quản lý nhân sự</p>
                <h2>Chấm công cá nhân</h2>
              </div>
              <button className="logout-button" type="button" onClick={() => setIsLoggedIn(false)}>
                Đăng xuất
              </button>
            </header>

            <nav className="tab-nav" aria-label="Menu quản lý chấm công">
              <button
                type="button"
                className={activeTab === 'attendance' ? 'tab-button active' : 'tab-button'}
                onClick={() => setActiveTab('attendance')}
              >
                Bảng chấm công
              </button>
              <button
                type="button"
                className={activeTab === 'summary' ? 'tab-button active' : 'tab-button'}
                onClick={() => setActiveTab('summary')}
              >
                Tổng hợp
              </button>
              <button
                type="button"
                className={activeTab === 'salary' ? 'tab-button active' : 'tab-button'}
                onClick={() => setActiveTab('salary')}
              >
                Lương
              </button>
            </nav>

            {activeTab === 'attendance' && (
              <>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Nhập dữ liệu</p>
                      <h3>Thêm ngày làm việc</h3>
                    </div>

                    <div className="panel-actions">
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(event) => setSelectedMonth(event.target.value)}
                        className="month-picker"
                      />
                      <button type="button" className="primary-button export-button" onClick={exportToExcel}>
                        Xuất Excel
                      </button>
                    </div>
                  </div>

                  <form className="entry-form" onSubmit={handleSubmit}>
                    <label>
                      <span>Ngày</span>
                      <input
                        type="date"
                        value={form.date}
                        max={formatDateInput(new Date())}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          if (nextValue && isFutureDate(nextValue)) {
                            setDateError('Ngày chấm công không hợp lệ. Chỉ được chọn ngày hiện tại hoặc quá khứ.')
                            return
                          }
                          setDateError('')
                          handleFormChange('date', nextValue)
                        }}
                      />
                    </label>

                    {dateError && <p className="field-error">{dateError}</p>}

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.morningShift}
                        onChange={(event) => handleFormChange('morningShift', event.target.checked)}
                      />
                      <span>Ca sáng</span>
                    </label>

                    <label>
                      <span>Bắt đầu ca sáng</span>
                      <input
                        type="time"
                        value={form.morningStart}
                        onChange={(event) => handleFormChange('morningStart', event.target.value)}
                      />
                    </label>

                    <label>
                      <span>Kết thúc ca sáng</span>
                      <input
                        type="time"
                        value={form.morningEnd}
                        onChange={(event) => handleFormChange('morningEnd', event.target.value)}
                      />
                    </label>

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.afternoonShift}
                        onChange={(event) => handleFormChange('afternoonShift', event.target.checked)}
                      />
                      <span>Ca chiều</span>
                    </label>

                    <label>
                      <span>Bắt đầu ca chiều</span>
                      <input
                        type="time"
                        value={form.afternoonStart}
                        onChange={(event) => handleFormChange('afternoonStart', event.target.value)}
                      />
                    </label>

                    <label>
                      <span>Kết thúc ca chiều</span>
                      <input
                        type="time"
                        value={form.afternoonEnd}
                        onChange={(event) => handleFormChange('afternoonEnd', event.target.value)}
                      />
                    </label>

                    <label>
                      <span>Tăng ca (giờ)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.overtime}
                        onChange={(event) => handleFormChange('overtime', event.target.value)}
                      />
                    </label>

                    <label>
                      <span>Tổng thời gian làm</span>
                      <input type="text" value={`${form.totalHours} giờ`} readOnly />
                    </label>

                    <button type="submit" className="primary-button wide-button">
                      Lưu ngày làm
                    </button>
                  </form>
                </section>

                <section className="panel calendar-panel">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Lịch chấm công</p>
                      <h3>Theo từng ngày</h3>
                    </div>
                  </div>

                  <div className="calendar-weekdays" aria-hidden="true">
                    <span>T2</span>
                    <span>T3</span>
                    <span>T4</span>
                    <span>T5</span>
                    <span>T6</span>
                    <span>T7</span>
                    <span>CN</span>
                  </div>

                  <div className="calendar-grid">
                    {calendarDays.map((day) => (
                      <div
                        key={day.dateKey}
                        className={`calendar-day ${day.inMonth ? '' : 'calendar-day-outside'} ${day.entry ? 'calendar-day-has-entry' : ''}`}
                      >
                        <span className="calendar-date">{day.dayNumber}</span>
                        {day.entry ? (
                          <>
                            <span className="calendar-meta">{day.entry.totalHours.toFixed(2)} giờ</span>
                            <span className="calendar-note">{day.entry.morningShift || day.entry.afternoonShift ? 'Có làm' : 'Nghỉ'}</span>
                          </>
                        ) : (
                          <>
                            <span className="calendar-meta">Nghỉ</span>
                            <span className="calendar-note">Chưa có dữ liệu</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Bảng công</p>
                      <h3>Danh sách chấm công</h3>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Ca sáng</th>
                          <th>Bắt đầu sáng</th>
                          <th>Kết thúc sáng</th>
                          <th>Ca chiều</th>
                          <th>Bắt đầu chiều</th>
                          <th>Kết thúc chiều</th>
                          <th>Tăng ca</th>
                          <th>Tổng giờ</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="empty-state">
                              Chưa có dữ liệu chấm công.
                            </td>
                          </tr>
                        ) : (
                          entries.map((entry) => (
                            <tr key={entry.id || entry.date}>
                              <td>{entry.date}</td>
                              <td>{entry.morningShift ? 'Có' : 'Không'}</td>
                              <td>{entry.morningShift ? entry.morningStart : '--:--'}</td>
                              <td>{entry.morningShift ? entry.morningEnd : '--:--'}</td>
                              <td>{entry.afternoonShift ? 'Có' : 'Không'}</td>
                              <td>{entry.afternoonShift ? entry.afternoonStart : '--:--'}</td>
                              <td>{entry.afternoonShift ? entry.afternoonEnd : '--:--'}</td>
                              <td>{entry.overtime || '0'} giờ</td>
                              <td>{entry.totalHours} giờ</td>
                              <td>
                                <button
                                  type="button"
                                  className="delete-button"
                                  onClick={() => handleDelete(entry.date)}
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'summary' && (
              <section className="panel summary-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Tổng hợp</p>
                    <h3>Thống kê chấm công theo tháng</h3>
                  </div>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="month-picker"
                  />
                </div>

                <div className="summary-grid">
                  <div className="summary-card accent">
                    <span>Total công trong tháng</span>
                    <strong>{monthSummary.workedDays} ngày</strong>
                  </div>
                  <div className="summary-card">
                    <span>Tổng giờ làm</span>
                    <strong>{monthSummary.totalHours.toFixed(2)} giờ</strong>
                  </div>
                  <div className="summary-card">
                    <span>Số ngày đã lưu</span>
                    <strong>{monthSummary.totalDays} ngày</strong>
                  </div>
                  <div className="summary-card">
                    <span>Trạng thái</span>
                    <strong>{monthSummary.workedDays >= 27 ? 'Đạt 27 công' : 'Chưa đạt 27 công'}</strong>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'salary' && (
              <section className="panel salary-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Bảng lương</p>
                    <h3>Chi tiết thanh toán</h3>
                  </div>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="month-picker"
                  />
                </div>

                <div className="salary-box">
                  <label className="salary-input-row">
                    <span>Lương cơ bản của bạn</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={baseSalary}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        setBaseSalary(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0)
                      }}
                    />
                    <small>đ / giờ</small>
                  </label>

                  <div className="salary-row">
                    <span>Lương cơ bản</span>
                    <strong>{baseSalary.toLocaleString('vi-VN')}đ / giờ</strong>
                  </div>
                  <div className="salary-row">
                    <span>Tháng đang tính</span>
                    <strong>{selectedMonth}</strong>
                  </div>
                  <div className="salary-row">
                    <span>Tổng giờ làm</span>
                    <strong>{monthSummary.totalHours.toFixed(2)} giờ</strong>
                  </div>
                  <div className="salary-row">
                    <span>Tiền lương theo giờ</span>
                    <strong>{(monthSummary.totalHours * baseSalary).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div className="salary-row highlight">
                    <span>Thưởng trên 27 công</span>
                    <strong>{monthSummary.workedDays >= 27 ? '700.000đ' : '0đ'}</strong>
                  </div>
                  <div className="salary-row total">
                    <span>Tổng nhận</span>
                    <strong>{monthSummary.salary.toLocaleString('vi-VN')}đ</strong>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default App
