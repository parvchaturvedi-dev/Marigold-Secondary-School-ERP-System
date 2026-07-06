// Curated "how-to" knowledge base for the MGPS ERP Admin portal.
//
// This is the SINGLE SOURCE OF TRUTH the assistant uses to explain how to do
// things in the portal. Every entry below was verified against the actual Admin
// page code (real sidebar names, page headers, tab names, button and field
// labels). The assistant is instructed to answer how-to questions ONLY from this
// guide and to NOT invent steps for workflows not listed here — instead it should
// point the user to the right page. Keep this accurate; extend it as workflows
// are confirmed.

export const PORTAL_GUIDE = `
# MGPS ERP — ADMIN PORTAL HOW-TO GUIDE
(The Admin left sidebar is the main navigation. Feature names below match the sidebar / page headers exactly. All button and field names in "quotes" are the real on-screen labels.)

## STUDENTS
### Enroll / admit a NEW student  (Sidebar → "Student Assigning", header "Student Admission Desk & Assigning")
- Fill the form sections: "Personal Details", "Religion & Category", "Admission Details", "Parent Details", "Required Documents Vault".
- Required (*) fields include: "Student Full Name", "Mobile Number", "Gender", "Date of Birth (DOB)", "Temporary Address", "Permanent Address" (or tick "Same as Temporary"), "Category Bracket", "Religion", "Student Aadhaar ID", "Admission Number (Unique ID)", "Allocate Core Class", "Date of Admission", "Father's Name", "Mother's Name", "Father Aadhaar ID", "Mother Aadhaar ID".
- Use the "With Parents" / "With Guardian" toggle; if "With Guardian", also fill "Guardian Name", "Guardian Mobile", "Guardian Aadhaar ID".
- Upload each required doc under "Required Documents Vault", then click "Submit & Onboard Student". (The Admission Number must be unique.)

### Add MANY students at once  (Sidebar → "Student Management", header "Student Management Console")
- Click a class card to open it → click "Sample Excel" to download the template → fill it → click "Add Students in Bulk" and pick the .xlsx/.xls file. (Rows need Admission Number + Name + Class; existing admission numbers are partial updates.)
- Roll numbers: "Auto Roll Numbers (A→Z)" (current class) or "Auto Roll Numbers — All Classes".
- Find a student: "Search Name or Admission Number..." + "All Genders"/"All Categories" filters + "Sort A-Z". Open one via "View Workspace Profile".

### View / edit ONE student  (Student Management → "View Workspace Profile", header "Student Workspace Folder" = Student Profile)
- Tabs: "Academic Analytics", "Personal Matrix Records", "Examinations", "Document Vault", "Finance" (admin only).
- Edit details: "Personal Matrix Records" tab → "Edit Details" → change fields → "Save".
- Documents: "Document Vault" tab → upload icon on a row (max 2 MB; jpg/png/webp/pdf) → "Save Documents"; "Add Slot" for an extra doc; "Update Photo" for the ID photo.

### Link siblings  (Sidebar → "Sibling Assigning", header "Sibling Cross-Mapping & Lifecycle Matrix")
- Pick Student Node A (class → kid) and Student Node B (class → sibling) → "Bind Accounts Credentials Array" (unifies them under one family login).
- Per member: "Mark Passout" / "Restore Active".

## FEES & FINANCE
### Collect / commit a fee payment  (Sidebar → "Finance", header "Institutional Finance Ledger")
- Dashboard shows "Total Demand", "Total Collected", "Total Pending", "Total Students" and "Classwise Accounts Index".
- Steps: click a class card in "Classwise Accounts Index" → on a student row click "View Ledger" → choose individual or family, enter the amount in the "Rs." field and submit → a receipt is built and it routes to "Fees Receipt".
- FASTEST WAY: just ask me — e.g. "collect 5000 from admission MGPS-101". I look up the student, prepare it, and you tap Confirm; nothing is recorded without confirmation.
- Assign a fee: open the student's ledger → "Assign Fee" → pick class, amount, optional note.
- Reminders: "Via Email", "WhatsApp", "App: Remind All". Payments can be edited/deleted in "Payment History".

### Family fee ledger  (Student Ledger, header "Secure Family Ledger Console", opened per student)
- Assign/edit a class fee: "Assign / Edit Class Fee" → pick student → pick class → enter "Class fee" (Rs.) → optional note → "Save Fee".
- Collect: "Secure Direct Collection Matrix" → "Family Distribution" or "Individual Payment" → enter amount → "Commit Entry And Receipt" (waterfalls across unpaid classes, lowest class first).

### Class fee list  ("Class Finance List" / "<Class> Ledger Feed")
- Read-only per-class table (Adm. Number, Student Name, Father's Name, Total/Paid/Pending Fees). Search + "Sort Due:" toggle; "View Ledger" opens a student's ledger.

### Fee receipt  (Sidebar → "Fees Receipt", header "FEES RECEIPT")
- Shows the last generated receipt. Buttons: "Local Print", "WhatsApp Slip", "Email Broadcast" (email needs a guardian email). "BACK TO LEDGER" returns to Finance.

### Fee structure / class order  (Sidebar → "Class Preferences", header "Class Preferences & Hierarchy")
- Add a class to the promotion order: type "Class Title Name" → "Insert Into Sequence". Reorder with up/down arrows ("Move Up (Smaller Class)" / "Move Down (Higher Class)"); trash to remove. Top = lowest grade. (This hierarchy is required before class promotion.)

### Staff salaries  (Sidebar → "Payroll", header "Staff Payroll")
- Tabs "Teachers" / "Clerks". Set salary: "Set / Update Salary" → "Monthly Salary Amount" + "Effective From" → "Save Salary".
- Pay salary: "Pay Salary" → "Settle Outstanding (oldest first)" or "Pay Specific Month" → "Amount" + "Mode" (Bank Transfer/Cash/Cheque/UPI) + optional "Note" → "Confirm Payment" → a "Salary Payment Slip" appears ("Print" works).

## CLASSES & SUBJECTS
### Classes  (Sidebar → "Class Management", header "Class Management")
- View all class cards (Class Teacher, "Strength: N Students"). Click a card for detail.
- Promote to next session: "Move to Next Journey" → confirm. (Requires the hierarchy set in "Class Preferences".) Non-repeaters move up; last class graduates (if fully paid) or goes to alumni pending (if dues).

### Subjects  (Sidebar → "Subject Management", header "Curriculum & Subject Routing Terminal")
- Create a subject: "Master Subject Definition Registry" → "Subject Name" + "System Code Identification" → "Save Subject Definition".
- Map a subject to a class: "Classroom Curriculum Mapping Router" → "Target Classroom Node" + "Select Subject Asset to Allocate" → "Link Node". Unlink via the "X" on a subject tag.

## STAFF & USERS
### Add a teacher  (Sidebar → "Teacher Assignment", header "Teacher Allocation & Workspace Onboarding")
- Fill "1. Core Identity & Biographical Demographics Matrix" (Teacher Full Name, Official Email Address, Primary Mobile Connection, DOB, Gender Allocation, Marital Status Flag, Social Category Stream, Aadhaar Identity Code Block, Father's/Husband's Name, Address).
- "2. Prior Employment & Tenure History": "Add Experience Track". "3. Academic Room Allocation & Subject Assignment Map": "Add Room Route" (pick "Target Class Bracket" then "Assigned Subject Domain").
- Set "Official Date of Joining (DOJ)" and "Is Designated As Class Teacher?" (if Yes, "Select Autonomous Grade Charge Slot") → attach docs → "Authorize Asset & Deploy Teacher". (Aadhaar must be 12 digits; a Teacher ID like TCH-2026-XXX is generated.)

### Manage / edit a teacher  (Sidebar → "Teacher Management", header "Teacher Management Directory")
- Find the card via "Search Name or Teacher ID..." → card's three-dot (⋮) menu → "Edit Master" → update the "Comprehensive Faculty File Synchronizer" blocks → "Update Database". Remove via the ⋮ menu (admin only).

### Clerks  (Sidebar → "Clerk Management", header "Clerical Staff Dashboard")
- Add: "Add Clerk Staff" → fill "Clerk Full Name", "Official Email Address", "Mobile Number", "Aadhaar Number" → optional docs → "Onboard Clerk Staff". Per card ⋮ → "View Profile" / "Edit Details" / "Remove".

### Admin logins  (Sidebar → "Admin Management")
- "Add Admin" form → "Admin ID", "Display Name", "Email", "Mobile", "Designation", "Initial Password" (min 6), "Active account" → "Create Admin". Reveal a password via eye icon → OTP → "Reveal".

### All user logins  (Sidebar → "Users Management")
- Filter by role tabs ("All Users/Admin/Clerk/Teacher/Student") + search → row pencil (Edit) → change details or "New Password (optional)" (needs "Send OTP" + "Password OTP") → "Save Changes".
- Also: reveal password, "Send Credentials via Email", "Send Credentials to All". Synced non-admin users can only be activated/password-changed, not deleted.

## ATTENDANCE  (Sidebar → "Attendance", header "Admin Attendance Control Center")
- Mark/override student attendance: "Global Override Action" → pick class + date → toggle "A" (absent) / "P" (present) per row → "Save".
- Config: "Geofencing & Security Configurator" (address search, Latitude/Longitude/Radius, "Authorized WiFi BSSID", "Enforce Reception QR" → "Save Global Configuration"); "Time Rules" ("Present until"/"Late/Half-day until"/"Close after"); "Staff Attendance Record" ("From"/"To" + "Load").

## EXAMINATIONS  (Sidebar → "Examinations", header "Examination Desk" — a top "School Examination" / "Board Examination" toggle + tabs)
- "Exam Creation" tab: create an exam — "Add Examination" → "Name" + "Academic Year" → "Add Examination". Mark board classes in "Board Exam Classes".
- "Paper Creation" tab: pick "Examination"/"Class"/"Subject"/"Type" → "Create" → edit in the Word-style editor → "Save Draft" or "Send To Teacher".
- "Paper Analysis" tab: approval cycle — "Preview", then "Approve" / "Reject" (reject needs a comment); "Rework" reopens a paper.
- "Paper Selected" tab: pick exam → class → "Print Papers".
- "Marks Management" tab: ENTER MARKS — choose "Examination"/"Class"/"Subject", set "Max Marks", type each student's "Marks" (Grade auto-fills) + "Remark" → "Save Marks". Admin extras: "Enable Teacher Edit", "Print Report Cards", "WhatsApp", "Gmail".
- "Report Card Management" tab: admit cards — pick class + exam, fill per-subject "Date"/"Start"/"End" → "Save Schedule" → "Generate Admit Cards" / "Print All".
- "Board Examination" desk: upload board results as PDF — "Board Results" → select "Class" → "Exam Title" → "Result PDF (max 10MB)" → "Publish".

## ASSIGNMENTS  (Sidebar → "Assignment", header "Assignment Control Room")
- Issue: "Issue Assignment" → "Compose Assignment" → fill "Subject", "Title", "Description", "Checking Date" → tick "Target Classes" → optional attachment/"Capture Photo" → "Broadcast".
- Update via "Update"; extend deadline via "Extend Checking Date" → "New Checking Date" → "Confirm Extension". (Assignments can't be deleted after upload.)

## TIMETABLE  (Sidebar → "Timetable", header "Timetable")
- In "Timetable Builder" set "Timetable name" + mode ("Default" or "Date range override") → "Row" adds a period, "Column" adds a class → fill each cell's "Subject"/"Teacher"/"Room" and period times (e.g. "08:30 - 09:10") → "Save". "Date Override" makes a dated special timetable.

## COMMUNICATION
### Send a notice  (Sidebar → "Notices", header "Official Campus Notice Board")
- "Add Notice" → "Draft Targeted Circular Broadcast" → "Notice Title/Headline" → "Notice Department Stream Category" (General / Accounts / Examinations / Sports) → "Target Audience Scope Routing" (class tiles or "Select All Classes") → "Detailed Description Circular Content" → "Publish Broadcast".
- FASTEST WAY: ask me — e.g. "send a notice about the annual sports day"; I prepare it and you confirm. Delete via a card's trash ("Revoke Notice").

### Events  (Sidebar → "Events", header "Campus Events & Participation Hub")
- "Schedule New Event" → "Event Title" + "Description" → "Single Day"/"Multiple Days" dates → optional image → optional "Enable Student Participation?" → "Publish Event". Open a card for "Edit Event"/"Remove Event" and participant "Export Class"/"Export All Classes PDF".

### Meetings (video)  (Sidebar → "Meetings", header "Jitsi Video Meetings")
- "Create Meeting" → "Title" + "Description" → "Audience" (Selected Classes / Staff Meeting / Entire School) → "Class Invites" if class-scoped → "Date" + "Time" → "Start Jitsi Meeting". Join via "Enter Meeting".

### Academic calendar  (Sidebar → "Academic Calender", header "Academic Calendar Management")
- "Add Calendar" (or the drop area) → choose a PDF (PDF only). "Replace Calendar" / "Remove Calendar" / "Preview Calendar" manage it; it syncs to Clerk/Teacher/Student portals.

## REQUESTS & DOCUMENTS
### Applications inbox  (Sidebar → "Application", header "Admin Application Inbox")
- Tabs: "All / Students / Teachers / Clerks / Class Requests / Safety" → open an item → type "Admin Reply" → "Approve Request" / "Reject Request" (for requests) or "Send Reply" (for applications). Replies editable for 5 minutes.

### Leave requests  (Sidebar → "Leave Requests", header "Leave Approval Desk")
- Filter tabs "All/Teachers/Clerks/Students" + search → on an open request card click green "Approve" or red "X" (Reject).

### Required-documents config  (Sidebar → "Documents Management", header "Document Configuration Control")
- Click a role card (Admin/Clerk/Teacher/Student Checklists) → "Document Label Name" → "Add Required Record Field". Allowed: JPG/JPEG/PNG/WEBP/PDF, max 2 MB.

### ID cards  (Sidebar → "Id Card", header "ID Card Generation")
- Pick a role tab (Students/Teachers/Clerks/Admins) → optional class + search → select a person to preview → "Export Selected PDF" (one) or "Generate All Visible" (all).

### Vault  (Sidebar → "Vault", title "Documents Vault", admin-only, AES-encrypted)
- "Unlock Vault" with a passphrase (min 8 chars) → "Unlock" → then "Create Note" → "Save Encrypted Note", or "Upload File" → "Select PDF or Image" (max 2 MB). Limits: 5 PDFs, 5 images, 20 notes.

## SETTINGS  (Sidebar → "Settings", header "Settings & Preferences")
- Change password: "3. Change Password" → "Current Password" + "New Password" + "Confirm New Password" → "Update Password".
- Toggles: "Two-Factor Authentication (2FA)", "Maintenance Mode", "Email Alerts for Leave Requests".
- Factory reset: "5. Danger Zone" → "Factory Reset" → pick scope (Everything / Students / Teachers / Clerks) → type "DELETE" → "Confirm Factory Reset". (Destructive — wipes data.)

## IMPORTANT FOR THE ASSISTANT
- Use ONLY the steps above for "how do I…" questions. If a workflow is not described here,
  say you are not 100% sure of the exact steps and point the user to the most relevant sidebar
  page — do NOT invent buttons, fields, or steps.
`;

export default PORTAL_GUIDE;
