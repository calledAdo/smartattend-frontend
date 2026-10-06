import type { RosterStudent } from './data'

function parseRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && !field) quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(value => value.trim())) rows.push(row)
      row = []
    } else if (char === '"') throw new Error('Invalid quote in CSV file.')
    else field += char
  }
  if (quoted) throw new Error('A quoted CSV field was not closed.')
  row.push(field)
  if (row.some(value => value.trim())) rows.push(row)
  return rows
}

export function parseRosterCsv(input: string): RosterStudent[] {
  const rows = parseRows(input.replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new Error('The CSV needs a header and at least one student.')
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_-]/g, '')
  const headers = rows[0].map(normalize)
  const name = headers.findIndex(value => ['name', 'fullname', 'studentname'].includes(value))
  const matricNo = headers.findIndex(value => ['matricno', 'matricnumber', 'matriculationnumber'].includes(value))
  const email = headers.findIndex(value => ['email', 'studentemail', 'emailaddress'].includes(value))
  if ([name, matricNo, email].includes(-1)) throw new Error('CSV headers must include name, matricNo and email.')
  const seenEmails = new Set<string>()
  const seenMatric = new Set<string>()
  return rows.slice(1).map((row, index) => {
    if (row.length !== headers.length) throw new Error(`Row ${index + 2} has ${row.length} columns; expected ${headers.length}.`)
    const student = { name: row[name].trim(), matricNo: row[matricNo].trim(), email: row[email].trim().toLowerCase() }
    if (!student.name || !student.matricNo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) throw new Error(`Row ${index + 2} needs a name, matric number and valid email.`)
    if (seenEmails.has(student.email) || seenMatric.has(student.matricNo.toLowerCase())) throw new Error(`Row ${index + 2} duplicates an email or matric number.`)
    seenEmails.add(student.email)
    seenMatric.add(student.matricNo.toLowerCase())
    return student
  })
}
