import React, { useState } from 'react';
import { BriefcaseBusiness, FileText, Upload, UserPlus } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { apiFetch } from '../../components/common/api';

const EMPLOYEES_NAMESPACE = 'admin-employee-management-list';
const DESIGNATIONS_NAMESPACE = 'admin-employee-designations';
const DOCUMENT_REQUIREMENTS_NAMESPACE = 'admin-document-requirements';

const emptyForm = {
  name: '', email: '', mobile: '', dob: '', gender: '', maritalStatus: '', category: '',
  aadharNumber: '', fatherName: '', husbandName: '', address: '', dateOfJoining: '', designation: '',
};

const EmployeeAssignment = () => {
  const [employees, , employeeState] = useMongoState(EMPLOYEES_NAMESPACE, []);
  const [designations, , designationState] = useMongoState(DESIGNATIONS_NAMESPACE, []);
  const [roleDocuments, , documentState] = useMongoState(DOCUMENT_REQUIREMENTS_NAMESPACE, { Employee: [] });
  const [form, setForm] = useState(emptyForm);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [notice, setNotice] = useState('');
  const employeeDocuments = Array.isArray(roleDocuments?.Employee) ? roleDocuments.Employee : [];

  const setField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const setDocumentFile = (documentName, file) => {
    setUploadedFiles((current) => ({
      ...current,
      [documentName]: file?.name || '',
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!/^\d{12}$/.test(form.aadharNumber)) {
      setNotice('Aadhaar number must contain exactly 12 digits.');
      return;
    }
    if (!designations.includes(form.designation)) {
      setNotice('Select a valid designation. Add it from Employee Management first.');
      return;
    }

    const existingIds = new Set(employees.map((employee) => employee.id));
    const year = new Date().getFullYear();
    let id;
    do {
      id = `EMP-${year}-${String(100000 + Math.floor(Math.random() * 900000))}`;
    } while (existingIds.has(id));

    const record = {
      ...form,
      id,
      documentsAttached: Object.values(uploadedFiles).filter(Boolean),
      documents: Object.entries(uploadedFiles)
        .filter(([, file]) => file)
        .map(([name, file]) => ({
          name,
          file,
          status: 'Pending',
          uploadedAt: new Date().toISOString(),
        })),
      status: 'Active',
      createdAt: new Date().toISOString(),
    };
    const nextEmployees = [record, ...employees];
    apiFetch(`/module-state/${encodeURIComponent(EMPLOYEES_NAMESPACE)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: nextEmployees }),
    }).then((payload) => {
      window.dispatchEvent(new CustomEvent(`mgps-erp-module-state:${EMPLOYEES_NAMESPACE}`, {
        detail: payload?.value ?? nextEmployees,
      }));
      setNotice(`Employee created. Login ID: ${id} · Initial password: ${id}@MGPS`);
      setForm(emptyForm);
      setUploadedFiles({});
    }).catch((saveError) => setNotice(`Could not save employee: ${saveError.message}`));
  };

  const isHusbandActive = form.gender === 'Female' && form.maritalStatus === 'Married';

  return (
    <div className="space-y-6 text-slate-900">
      <header className="glass-card rounded-3xl p-6">
        <h1 className="text-xl font-black flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-500" /> Employee Assignment Management
        </h1>
        <p className="mt-1 text-xs font-semibold text-slate-500">Create an employee record with configured document requirements and a saved designation.</p>
      </header>

      {(employeeState.error || designationState.error || documentState.error) && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          {employeeState.error || designationState.error || documentState.error}
        </p>
      )}
      {!designations.length && !designationState.isLoading && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
          Add a designation in Employee Management before assigning an employee.
        </p>
      )}
      {notice && <p role="status" className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-bold text-indigo-800">{notice}</p>}

      <form onSubmit={submit} className="space-y-5">
        <section className="glass-card space-y-4 rounded-3xl p-6">
          <h2 className="border-b border-slate-100 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">1. Core Identity & Biographical Details</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Employee Full Name" name="name" value={form.name} onChange={setField} required />
            <Field label="Official Email Address" name="email" type="email" value={form.email} onChange={setField} required />
            <Field label="Primary Mobile Number" name="mobile" type="tel" value={form.mobile} onChange={setField} required />
            <Field label="Date of Birth" name="dob" type="date" value={form.dob} onChange={setField} required />
            <SelectField label="Gender" name="gender" value={form.gender} onChange={setField} options={['Male', 'Female', 'Other']} />
            <SelectField label="Marital Status" name="maritalStatus" value={form.maritalStatus} onChange={setField} options={['Single', 'Married', 'Divorced']} />
            <SelectField label="Social Category" name="category" value={form.category} onChange={setField} options={['General', 'OBC', 'SC', 'ST']} />
            <Field label="Aadhaar (12 digits)" name="aadharNumber" value={form.aadharNumber} onChange={setField} required maxLength={12} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!isHusbandActive && <Field label="Father's Full Name" name="fatherName" value={form.fatherName} onChange={setField} required />}
            {isHusbandActive && <Field label="Husband's Full Name" name="husbandName" value={form.husbandName} onChange={setField} required />}
          </div>
          <Field label="Residential Address" name="address" value={form.address} onChange={setField} required />
        </section>

        <section className="glass-card grid grid-cols-1 gap-4 rounded-3xl p-6 md:grid-cols-3">
          <Field label="Official Date of Joining" name="dateOfJoining" type="date" value={form.dateOfJoining} onChange={setField} required />
          <label className="space-y-1 text-[11px] font-bold text-slate-600">
            <span>Designation</span>
            <select name="designation" value={form.designation} onChange={setField} required className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-3 text-xs text-slate-900 outline-none focus:border-indigo-400">
              <option value="">-- Select Designation --</option>
              {designations.map((designation) => <option key={designation} value={designation}>{designation}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2 rounded-xl bg-indigo-50/70 p-3 text-[11px] font-semibold text-indigo-800">
            <BriefcaseBusiness className="h-4 w-4 shrink-0" /> The employee account is provisioned after this record is saved.
          </div>
        </section>

        <section className="glass-card space-y-4 rounded-3xl p-6">
          <h2 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <FileText className="h-4 w-4 text-indigo-500" /> Required Documents Vault
          </h2>
          {employeeDocuments.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {employeeDocuments.map((documentName, index) => (
                <div key={`${documentName}-${index}`} className="glass-soft flex flex-col justify-between gap-3 rounded-2xl p-4 text-xs font-semibold">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Field Check #{index + 1}</span>
                    <label className="mt-0.5 block font-black text-slate-900">
                      {documentName} <span className="text-red-500">*</span>
                    </label>
                  </div>
                  <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white/60 p-3 transition-all hover:border-indigo-400">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(event) => setDocumentFile(documentName, event.target.files?.[0])}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <Upload className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="max-w-full truncate text-[11px] font-medium text-slate-500">
                      {uploadedFiles[documentName] || 'Upload File (.PDF, .JPG)'}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs font-semibold text-slate-500">
              No employee documents configured. Add requirements from Documents Management.
            </p>
          )}
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={!designations.length || employeeState.isLoading} className="btn-primary rounded-full px-7 py-3 text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
            Add Employee
          </button>
        </div>
      </form>
    </div>
  );
};

function Field({ label, name, value, onChange, type = 'text', ...props }) {
  return (
    <label className="space-y-1 text-[11px] font-bold text-slate-600">
      <span>{label}</span>
      <input type={type} name={name} value={value} onChange={onChange} className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-3 text-xs text-slate-900 outline-none focus:border-indigo-400" {...props} />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <label className="space-y-1 text-[11px] font-bold text-slate-600">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange} required className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-3 text-xs text-slate-900 outline-none focus:border-indigo-400">
        <option value="">-- Select {label} --</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default EmployeeAssignment;
