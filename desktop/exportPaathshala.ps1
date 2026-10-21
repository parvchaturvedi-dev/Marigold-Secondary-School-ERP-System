$ErrorActionPreference = 'Stop'

$stagingDirectory = Join-Path $env:LOCALAPPDATA 'PaathshalaERP\staging-source'
$outputPath = Join-Path $stagingDirectory 'paathshala-import-bundle.json'
$connectionString = 'Data Source=(localdb)\PaathshalaStage;Initial Catalog=PaathshalaStaging;Integrated Security=True;Connect Timeout=10;Application Name=MGPS Paathshala Read-Only Export'
$allowedTables = @(
  'promotion', 'Dpromotion',
  'MarksEntry', 'Other_MarksEntry', 'Supplementry_MarksEntry', 'CC_MarksEntry',
  'cc_Marks_ExamWise', 'A_Report_card', 'Result', 'Marksheet', 'CBSE_12Marksheet',
  'CC_deradun_Marksheet', 'CC_deradun_Marksheet_Grade', 'CC_Marksheet',
  'C11', 'C3', 'C6', 'C9', 'SB_Grade', 'Co_Scholastic',
  'AttenLog', 'AttenTermWise', 'dAttendance', 'mAttendance', 'Yearly_Attendance',
  'FeesEntry', 'sfees', 'FeesInvoice', 'CheckFeesEntry', 'Cancel_Receipt',
  'OtherFees', 'Discount', 'ConRegistration', 'RoomRegistration', 'Pocketmoney',
  'Pocketmoney_Entry', 'challan', 'Invoice_Fake', 'Check',
  'sSubject', 'sDueSubject', 'EXM_STUDENT', 'EXM_Subject', 'ClassExam', 'ExamSchedule',
  'DocSubmited', 'ClassDocument',
  'tccc', 'tcDetail', 'Rusticate', 'NoDues', 'OtherActivity', 'StudentComplaint'
)
$studentIdNames = @('Sid', 'SID', 'SId', 'Stuid', 'student', 'StudentId', 'StudentID')
$invariant = [System.Globalization.CultureInfo]::InvariantCulture
$connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)

function Invoke-Query {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [hashtable]$Parameters = @{}
  )

  $command = $connection.CreateCommand()
  $command.CommandText = $Sql
  $command.CommandTimeout = 120
  foreach ($name in $Parameters.Keys) {
    [void]$command.Parameters.AddWithValue($name, $Parameters[$name])
  }
  $table = New-Object System.Data.DataTable
  $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
  [void]$adapter.Fill($table)
  $adapter.Dispose()
  $command.Dispose()
  return ,$table
}

function Convert-Row {
  param([System.Data.DataRow]$Row)

  $record = [ordered]@{}
  foreach ($column in $Row.Table.Columns) {
    $value = $Row[$column]
    if ($value -is [System.DBNull]) {
      $record[$column.ColumnName] = $null
    } elseif ($value -is [datetime]) {
      $record[$column.ColumnName] = $value.ToString('yyyy-MM-ddTHH:mm:ss.fff', $invariant)
    } else {
      $record[$column.ColumnName] = $value
    }
  }
  return $record
}

function Convert-TableRows {
  param([System.Data.DataTable]$Table)

  $rows = [System.Collections.Generic.List[object]]::new()
  foreach ($row in $Table.Rows) {
    $rows.Add((Convert-Row $row))
  }
  return ,$rows.ToArray()
}

function Get-ColumnName {
  param(
    [string[]]$Columns,
    [string[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    $match = $Columns | Where-Object { $_ -ieq $candidate } | Select-Object -First 1
    if ($match) { return $match }
  }
  return $null
}

if (-not (Test-Path -LiteralPath $stagingDirectory -PathType Container)) {
  throw "The Paathshala staging folder was not found: $stagingDirectory"
}
if (Test-Path -LiteralPath $outputPath) {
  throw "The import bundle already exists and will not be overwritten: $outputPath"
}

try {
  $connection.Open()

  $schema = Invoke-Query @'
SELECT t.name AS table_name, c.name AS column_name
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.is_ms_shipped = 0
ORDER BY t.name, c.column_id
'@
  $tableColumns = @{}
  foreach ($row in $schema.Rows) {
    $tableName = [string]$row.table_name
    if (-not $tableColumns.ContainsKey($tableName)) {
      $tableColumns[$tableName] = [System.Collections.Generic.List[string]]::new()
    }
    $tableColumns[$tableName].Add([string]$row.column_name)
  }

  $sessionRows = Invoke-Query 'SELECT id, SessionYear, StartDate, EndDate FROM dbo.[Session] ORDER BY id'
  if ($sessionRows.Rows.Count -eq 0) {
    throw 'The staged Paathshala database has no session records.'
  }

  $writer = New-Object System.IO.StreamWriter($outputPath, $false, [System.Text.UTF8Encoding]::new($false))
  try {
    $writer.Write('{"format":"mgps-paathshala-session-import","version":1,"sessions":[')
    $sessionIndex = 0

    foreach ($sourceSession in $sessionRows.Rows) {
      $sessionId = [int]$sourceSession.id
      $sourceYear = if ($sourceSession.SessionYear -is [System.DBNull]) {
        ''
      } else {
        ([string]$sourceSession.SessionYear).Trim()
      }
      $archiveLabel = if ($sourceYear) { $sourceYear } else { "Unlabelled" }
      $archiveName = "Paathshala $archiveLabel (ID $sessionId)"
      if ($archiveName.Length -gt 32) {
        throw "Generated archive name is too long: $archiveName"
      }

      $tables = [ordered]@{}
      $studentIds = [System.Collections.Generic.HashSet[int]]::new()

      foreach ($tableName in $allowedTables) {
        if (-not $tableColumns.ContainsKey($tableName)) { continue }
        $columns = $tableColumns[$tableName].ToArray()
        $sessionColumn = Get-ColumnName $columns @('SessionId', 'Sessionid', 'sessionid')
        if (-not $sessionColumn) { continue }

        $quotedTable = '[dbo].[' + $tableName.Replace(']', ']]') + ']'
        $quotedColumn = '[' + $sessionColumn.Replace(']', ']]') + ']'
        $rowsTable = Invoke-Query "SELECT * FROM $quotedTable WHERE $quotedColumn = @sessionId" @{
          '@sessionId' = $sessionId
        }
        if ($rowsTable.Rows.Count -eq 0) {
          $rowsTable.Dispose()
          continue
        }

        $rows = Convert-TableRows $rowsTable
        $tables[$tableName] = $rows
        $studentColumn = Get-ColumnName $columns $studentIdNames
        if ($studentColumn) {
          foreach ($row in $rowsTable.Rows) {
            $value = $row[$studentColumn]
            if ($value -isnot [System.DBNull]) {
              $studentId = 0
              if ([int]::TryParse([string]$value, [ref]$studentId)) {
                [void]$studentIds.Add($studentId)
              }
            }
          }
        }
        $rowsTable.Dispose()
      }

      if ($tableColumns.ContainsKey('C_SAdmission') -and $sourceYear) {
        $legacyColumns = $tableColumns['C_SAdmission'].ToArray()
        $currentSessionColumn = Get-ColumnName $legacyColumns @('Session')
        $pastSessionColumn = Get-ColumnName $legacyColumns @('Past Session')
        if ($currentSessionColumn -or $pastSessionColumn) {
          $conditions = @()
          if ($currentSessionColumn) { $conditions += '[' + $currentSessionColumn.Replace(']', ']]') + '] = @sourceYear' }
          if ($pastSessionColumn) { $conditions += '[' + $pastSessionColumn.Replace(']', ']]') + '] = @sourceYear' }
          $legacyRows = Invoke-Query (
            'SELECT * FROM [dbo].[C_SAdmission] WHERE ' + ($conditions -join ' OR ')
          ) @{ '@sourceYear' = $sourceYear }
          if ($legacyRows.Rows.Count -gt 0) {
            $tables['C_SAdmission'] = Convert-TableRows $legacyRows
          }
          $legacyRows.Dispose()
        }
      }

      if ($studentIds.Count -gt 0) {
        $idList = ($studentIds | Sort-Object) -join ','
        $admissionRows = Invoke-Query "SELECT * FROM dbo.[SAdmission] WHERE SID IN ($idList)"
        if ($admissionRows.Rows.Count -gt 0) {
          $tables['SAdmission'] = Convert-TableRows $admissionRows
        }
        $admissionRows.Dispose()

        if ($tableColumns.ContainsKey('SPrevRecord')) {
          $priorColumns = $tableColumns['SPrevRecord'].ToArray()
          $priorStudentColumn = Get-ColumnName $priorColumns $studentIdNames
          if ($priorStudentColumn) {
            $quotedPriorColumn = '[' + $priorStudentColumn.Replace(']', ']]') + ']'
            $priorRows = Invoke-Query "SELECT * FROM dbo.[SPrevRecord] WHERE $quotedPriorColumn IN ($idList)"
            if ($priorRows.Rows.Count -gt 0) {
              $tables['SPrevRecord'] = Convert-TableRows $priorRows
            }
            $priorRows.Dispose()
          }
        }
      }

      $recordCount = 0
      foreach ($rows in $tables.Values) { $recordCount += $rows.Count }
      $sessionInfo = [ordered]@{
        name = $archiveName
        recordCount = $recordCount
        payload = @{
          collections = @{
            'paathshala-history' = @{
              sourceSessionId = $sessionId
              sourceSessionYear = $sourceYear
              startDate = if ($sourceSession.StartDate -is [System.DBNull]) { $null } else { ([datetime]$sourceSession.StartDate).ToString('yyyy-MM-dd', $invariant) }
              endDate = if ($sourceSession.EndDate -is [System.DBNull]) { $null } else { ([datetime]$sourceSession.EndDate).ToString('yyyy-MM-dd', $invariant) }
              recordCount = $recordCount
              tables = $tables
            }
          }
        }
      }

      $json = ConvertTo-Json -InputObject $sessionInfo -Depth 50 -Compress
      if ($sessionIndex -gt 0) { $writer.Write(',') }
      $writer.Write($json)
      $sessionIndex++
      Write-Output ("Prepared {0}: {1:N0} records" -f $archiveName, $recordCount)
    }
    $writer.Write(']}')
  } finally {
    $writer.Dispose()
  }

  Write-Output ("Bundle written to {0} ({1:N1} MiB)" -f $outputPath, ((Get-Item -LiteralPath $outputPath).Length / 1MB))
} finally {
  $connection.Dispose()
}
