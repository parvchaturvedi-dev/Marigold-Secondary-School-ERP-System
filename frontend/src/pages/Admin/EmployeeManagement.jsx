import React, { useMemo, useState } from 'react';
import { BriefcaseBusiness, Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';

const EMPLOYEES_NAMESPACE = 'admin-employee-management-list';
const DESIGNATIONS_NAMESPACE = 'admin-employee-designations';

const EmployeeManagement = () => {
  const [employees, setEmployees, employeeState] = useMongoState(EMPLOYEES_NAMESPACE, []);
  const [designations, setDesignations, designationState] = useMongoState(DESIGNATIONS_NAMESPACE, []);
  const [search, setSearch] = useState('');
  const [designationDraft, setDesignationDraft] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) =>
      `${employee.name} ${employee.id} ${employee.designation} ${employee.email}`.toLowerCase().includes(term)
    );
  }, [employees, search]);

  const addDesignation = (event) => {
    event.preventDefault();
    const name = designationDraft.trim();
    if (!name) return;
    if (designations.some((designation) => designation.toLowerCase() === name.toLowerCase())) {
      window.alert('This designation already exists.');
      return;
    }
    setDesignations((current) => [...current, name].sort((a, b) => a.localeCompare(b)));
    setDesignationDraft('');
  };

  const removeDesignation = (name) => {
    if (employees.some((employee) => employee.designation === name)) {
      window.alert('This designation is assigned to an employee. Reassign them before removing it.');
      return;
    }
    if (window.confirm(`Remove the "${name}" designation?`)) {
      setDesignations((current) => current.filter((designation) => designation !== name));
    }
  };

  const saveEmployee = (event) => {
    event.preventDefault();
    const aadhar = String(editingEmployee.aadharNumber || '');
    if (!/^\d{12}$/.test(aadhar)) {
      window.alert('Aadhaar number must contain exactly 12 digits.');
      return;
    }
    setEmployees((current) =>
      current.map((employee) => employee.id === editingEmployee.id ? editingEmployee : employee)
    );
    setEditingEmployee(null);
  };

  const removeEmployee = (employee) => {
    if (!window.confirm(`Remove ${employee.name} (${employee.id}) and disable their account?`)) return;
    setEmployees((current) => current.filter((item) => item.id !== employee.id));
  };

  const updateEmployeeField = (event) => {
    const { name, value } = event.target;
    setEditingEmployee((current) => ({ ...current, [name]: value }));
  };

  return (
    <div className="space-y-6 text-slate-900">
      <section className="glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <BriefcaseBusiness className="w-5 h-5 text-indigo-500" /> Employee Management
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            View, edit and remove employee records, and manage selectable designations.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/60 px-3 py-2.5 md:w-72">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee"
            className="w-full bg-transparent text-xs font-bold outline-none"
          />
        </label>
      </section>

      {(employeeState.error || designationState.error) && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          {employeeState.error || designationState.error}
        </p>
      )}

      <section className="glass-card rounded-3xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-black">Designation Management</h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">Add the designations that appear in employee assignment.</p>
        </div>
        <form onSubmit={addDesignation} className="flex flex-col sm:flex-row gap-2">
          <input
            value={designationDraft}
            onChange={(event) => setDesignationDraft(event.target.value)}
            placeholder="Enter designation name"
            maxLength={60}
            required
            className="flex-1 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400"
          />
          <button className="btn-primary rounded-xl px-4 py-2.5 text-xs font-black flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Designation
          </button>
        </form>
        {designations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {designations.map((designation) => (
              <span key={designation} className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-800">
                {designation}
                <button type="button" aria-label={`Remove ${designation}`} onClick={() => removeDesignation(designation)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-semibold text-slate-500">No designations yet. Add one before assigning an employee.</p>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <article key={employee.id} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-[10px] text-indigo-700">{employee.id}</span>
                <h2 className="truncate text-sm font-black">{employee.name}</h2>
                <p className="text-xs font-bold text-slate-500">{employee.designation}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" aria-label={`Edit ${employee.name}`} onClick={() => setEditingEmployee({ ...employee })} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button type="button" aria-label={`Remove ${employee.name}`} onClick={() => removeEmployee(employee)} className="rounded-lg p-2 text-red-700 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1 text-[11px] font-semibold text-slate-600">
              <p className="truncate">{employee.email}</p>
              <p>{employee.mobile}</p>
              <p>Status: {employee.status || 'Active'}</p>
            </div>
          </article>
        ))}
        {!employeeState.isLoading && filteredEmployees.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs font-bold text-slate-500">
            No employee records found.
          </p>
        )}
      </section>

      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form onSubmit={saveEmployee} className="glass-strong max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Edit Employee · {editingEmployee.id}</h2>
              <button type="button" onClick={() => setEditingEmployee(null)} aria-label="Close edit form"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['name', 'Full Name', 'text'],
                ['email', 'Official Email', 'email'],
                ['mobile', 'Mobile Number', 'tel'],
                ['dob', 'Date of Birth', 'date'],
                ['aadharNumber', 'Aadhaar (12 digits)', 'text'],
                ['address', 'Residential Address', 'text'],
                ['dateOfJoining', 'Date of Joining', 'date'],
              ].map(([name, label, type]) => (
                <label key={name} className="space-y-1 text-[11px] font-bold text-slate-600">
                  <span>{label}</span>
                  <input required type={type} name={name} value={editingEmployee[name] || ''} onChange={updateEmployeeField} maxLength={name === 'aadharNumber' ? 12 : undefined} className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-400" />
                </label>
              ))}
              {editingEmployee.gender === 'Female' && editingEmployee.maritalStatus === 'Married' ? (
                <label className="space-y-1 text-[11px] font-bold text-slate-600">
                  <span>Husband’s Name</span>
                  <input required name="husbandName" value={editingEmployee.husbandName || ''} onChange={updateEmployeeField} className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-400" />
                </label>
              ) : (
                <label className="space-y-1 text-[11px] font-bold text-slate-600">
                  <span>Father’s Name</span>
                  <input required name="fatherName" value={editingEmployee.fatherName || ''} onChange={updateEmployeeField} className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-400" />
                </label>
              )}
              {[
                ['gender', 'Gender', ['Male', 'Female', 'Other']],
                ['maritalStatus', 'Marital Status', ['Single', 'Married', 'Divorced']],
                ['category', 'Social Category', ['General', 'OBC', 'SC', 'ST']],
                ['designation', 'Designation', designations],
              ].map(([name, label, options]) => (
                <label key={name} className="space-y-1 text-[11px] font-bold text-slate-600">
                  <span>{label}</span>
                  <select required name={name} value={editingEmployee[name] || ''} onChange={updateEmployeeField} className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-400">
                    <option value="">Select {label}</option>
                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <label className="space-y-1 text-[11px] font-bold text-slate-600 block">
              <span>Account Status</span>
              <select name="status" value={editingEmployee.status || 'Active'} onChange={updateEmployeeField} className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-xs">
                <option>Active</option><option>Inactive</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingEmployee(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
              <button type="submit" className="btn-primary rounded-xl px-5 py-2 text-xs font-black">Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
