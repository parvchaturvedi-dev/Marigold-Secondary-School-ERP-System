import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import schoolLogo from '../../assets/logo.png';

export const SCHOOL_PROFILE = {
  name: 'MARIGOLD SECONDARY SCHOOL',
  shortName: 'MGPS',
  tagline: 'LEARN - GROW - SUCCEED',
  website: 'www.marigoldschoolbehror.com',
  session: '2026-27',
};

const pick = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';

const titleCaseRole = (role = '') => String(role || '').replace(/^\w/, (char) => char.toUpperCase());

const fieldValue = (fields = [], label = '') =>
  fields.find(([fieldLabel]) => fieldLabel === label)?.[1] || '';

export const buildQrPayload = (record = {}) => {
  if (record.type === 'student') {
    return [
      `NAME: ${fieldValue(record.frontFields, 'NAME')}`,
      `ADM NO.: ${fieldValue(record.frontFields, 'ADM NO.')}`,
      `FATHER NAME: ${fieldValue(record.frontFields, 'FATHER NAME')}`,
      `MOTHER NAME: ${fieldValue(record.frontFields, 'MOTHER NAME')}`,
      `MOBILE NUMBER: ${fieldValue(record.frontFields, 'MOBILE NUMBER')}`,
    ].filter((line) => !line.endsWith(': ')).join('\n');
  }

  return [
    `NAME: ${fieldValue(record.frontFields, 'NAME')}`,
    `EMP ID: ${fieldValue(record.frontFields, 'EMP ID')}`,
    `ROLE: ${fieldValue(record.frontFields, 'ROLE')}`,
    `MOBILE NUMBER: ${fieldValue(record.frontFields, 'MOBILE NUMBER')}`,
    `EMAIL: ${fieldValue(record.frontFields, 'EMAIL')}`,
  ].filter((line) => !line.endsWith(': ')).join('\n');
};

export const normalizeStudentCard = (student = {}, index = 0) => {
  const raw = student.rawProfile || {};
  const id = pick(student.admissionNumber, student.id, raw.admissionNumber, `STD-${index + 1}`);

  return {
    type: 'student',
    id,
    displayName: pick(student.displayName, student.name, raw.studentName, `Student ${index + 1}`),
    roleLabel: 'Student',
    primaryLine: [pick(student.className, student.class, raw.targetClass), pick(student.section, raw.section)].filter(Boolean).join('-'),
    photoDataUrl: pick(student.photoDataUrl, raw.photoDataUrl),
    frontFields: [
      ['NAME', pick(student.displayName, student.name, raw.studentName)],
      ['ADM NO.', id],
      ['FATHER NAME', pick(student.fatherName, raw.fatherName)],
      ['MOTHER NAME', pick(student.motherName, raw.motherName)],
      ['MOBILE NUMBER', pick(student.guardianPhone, student.mobile, raw.guardianMobile, raw.mobileNo)],
      ['GENDER', pick(student.gender, raw.gender)],
      ['CATEGORY', pick(student.category, raw.category)],
    ],
    backFields: [
      ['Class :', pick(student.className, student.class, raw.targetClass)],
      ['Section :', pick(student.section, raw.section)],
      ['Roll No :', pick(student.rollNo, raw.rollNo)],
      ['DOB :', pick(student.dob, raw.dob)],
      ['Blood Group :', pick(student.bloodGroup, raw.bloodGroup)],
      ['Religion :', pick(student.religion, raw.religion)],
      ['Student Aadhaar :', pick(student.studentAadhar, raw.studentAadhar)],
      ['PEN Number :', pick(student.penNumber, raw.penNumber)],
      ['Admission Date :', pick(student.dateOfAdmission, raw.dateOfAdmission)],
      ['Last School :', pick(student.lastSchoolName, raw.lastSchoolName)],
      ['Email :', pick(student.guardianEmail, student.email, raw.email)],
      ['Temporary Address :', pick(raw.tempAddress, student.tempAddress)],
      ['Permanent Address :', pick(raw.permAddress, student.address)],
    ],
  };
};

export const normalizeStaffCard = (person = {}, role = 'staff', index = 0) => {
  const profile = person.profile || {};
  const source = profile.teacherProfile || profile.clerkProfile || person;
  const id = pick(person.username, source.id, source.empId, `${role.toUpperCase()}-${index + 1}`);
  const designation = pick(source.designation, source.role, role === 'admin' ? 'Administrator' : titleCaseRole(role));

  return {
    type: role,
    id,
    displayName: pick(person.displayName, source.displayName, source.name, id),
    roleLabel: titleCaseRole(role),
    primaryLine: designation,
    photoDataUrl: pick(profile.photoDataUrl, source.photoDataUrl),
    frontFields: [
      ['NAME', pick(person.displayName, source.displayName, source.name, id)],
      ['EMP ID', id],
      ['ROLE', designation],
      ['DEPARTMENT', pick(source.department, role === 'admin' ? 'Administration' : 'Office')],
      ['MOBILE NUMBER', pick(profile.mobile, source.mobile, source.phone)],
      ['EMAIL', pick(profile.email, source.email)],
      ['GENDER', pick(source.gender)],
    ],
    backFields: [
      ['Username :', id],
      ['Designation :', designation],
      ['Joining Date :', pick(source.joiningDate, source.dateOfJoining)],
      ['DOB :', pick(source.dob)],
      ['Blood Group :', pick(source.bloodGroup)],
      ['Aadhaar :', pick(source.aadharNumber, source.aadhaar, source.aadhar)],
      ['Emergency Contact :', pick(source.emergencyContact, source.mobile, source.phone)],
      ['Allotted Classes :', Array.isArray(profile.allottedClasses) ? profile.allottedClasses.join(', ') : pick(source.assignedClassTeacherFor)],
      ['Status :', pick(person.isActive === false ? 'Inactive' : 'Active', source.status)],
    ],
  };
};

const filteredFields = (fields = []) => fields.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');

export const QrCodeImage = ({ value = '', label = 'QR code' }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(value || 'MGPS ERP ID', {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 7,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (mounted) setDataUrl(url);
      })
      .catch(() => {
        if (mounted) setDataUrl('');
      });

    return () => {
      mounted = false;
    };
  }, [value]);

  return (
    <div className="id-card-qr-box">
      {dataUrl ? (
        <img src={dataUrl} alt={label} />
      ) : (
        <span className="text-[9px] font-black text-[#08285f]">QR</span>
      )}
    </div>
  );
};

export const ResponsiveIdCardPair = ({ record }) => {
  const shellRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    const updateScale = () => {
      const width = shell.getBoundingClientRect().width;
      setScale(Math.min(1, Math.max(0.35, width / 760)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(shell);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  return (
    <div ref={shellRef} className="id-card-responsive-shell">
      <div className="id-card-responsive-stage" style={{ height: `${(441.86 * 2 + 18) * scale}px` }}>
        <div className="id-card-responsive-transform" style={{ transform: `scale(${scale})` }}>
          <IdCardPair record={record} />
        </div>
      </div>
    </div>
  );
};

export const IdCardPair = ({ record, compact = false, exportMode = false }) => {
  const frontFields = filteredFields(record?.frontFields || []);
  const backFields = filteredFields(record?.backFields || []);
  const qrPayload = buildQrPayload(record);

  return (
    <div className={`id-card-pair ${compact ? 'scale-[0.86] origin-top' : ''} ${exportMode ? 'id-card-export' : ''}`}>
      <article className="id-card-face id-card-front">
        <div className="id-card-left">
          <img src={schoolLogo} alt={SCHOOL_PROFILE.name} className="id-card-logo" />
          <div className="id-card-photo">
            {record.photoDataUrl ? (
              <img src={record.photoDataUrl} alt={record.displayName} />
            ) : (
              <span>{String(record.displayName || 'ID').slice(0, 2).toUpperCase()}</span>
            )}
          </div>
        </div>
        <div className="id-card-main">
          <div className="id-card-school">
            <h3>{SCHOOL_PROFILE.name}</h3>
            <p>{SCHOOL_PROFILE.tagline}</p>
          </div>
          <span className="id-card-session">SESSION: {SCHOOL_PROFILE.session}</span>
          <div className="id-card-lines">
            {frontFields.map(([label, value]) => (
              <div key={label} className="id-card-line">
                <span>{label}</span>
                <em>:</em>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="id-card-qr">
            <QrCodeImage value={qrPayload} label={`${record.displayName} QR code`} />
          </div>
        </div>
        <div className="id-card-footer">{SCHOOL_PROFILE.website}</div>
      </article>

      <article className="id-card-face id-card-back">
        <div className="id-card-back-header">
          <img src={schoolLogo} alt="" />
          <div>
            <h3>{SCHOOL_PROFILE.name}</h3>
            <p>{record.roleLabel} Identity Details</p>
          </div>
          <QrCodeImage value={qrPayload} label={`${record.displayName} QR code`} />
        </div>
        <div className="id-card-back-grid">
          {backFields.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="id-card-back-note">
          If found, please return this card to the school office. This card is ERP generated and does not require principal signature.
        </div>
      </article>
    </div>
  );
};

const waitForImages = async (container) => {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    })
  );
};

const renderRecordForExport = async (record) => {
  const host = document.createElement('div');
  host.className = 'id-card-pdf-host';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(
      <>
        <IdCardStyles />
        <IdCardPair record={record} exportMode />
      </>
    );

    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await waitForImages(host);
    await new Promise((resolve) => window.setTimeout(resolve, 80));

    const faces = Array.from(host.querySelectorAll('.id-card-face'));
    const canvases = [];
    for (const face of faces) {
      canvases.push(
        await html2canvas(face, {
          backgroundColor: '#ffffff',
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
        })
      );
    }

    return canvases;
  } finally {
    root.unmount();
    host.remove();
  }
};

export const exportIdCardsPdf = async (records = [], fileName = 'mgps-id-cards.pdf') => {
  if (!records.length) return;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let index = 0; index < records.length; index += 1) {
    const [frontCanvas, backCanvas] = await renderRecordForExport(records[index]);
    if (index > 0) doc.addPage();

    const cardWidth = 182;
    const cardHeight = cardWidth / 1.72;
    const x = (210 - cardWidth) / 2;
    doc.addImage(frontCanvas.toDataURL('image/png'), 'PNG', x, 14, cardWidth, cardHeight);
    doc.addImage(backCanvas.toDataURL('image/png'), 'PNG', x, 126, cardWidth, cardHeight);
  }

  doc.save(fileName);
};

export const IdCardStyles = () => (
  <style>{`
    .id-card-pair { display: grid; width: 760px; gap: 18px; justify-items: center; }
    .id-card-responsive-shell { width: 100%; max-width: 100%; overflow: hidden; }
    .id-card-responsive-stage { position: relative; width: 100%; min-height: 320px; }
    .id-card-responsive-transform { width: 760px; transform-origin: top left; }
    .id-card-export { width: 760px; gap: 24px; }
    .id-card-pdf-host { position: fixed; left: -10000px; top: 0; width: 820px; background: white; padding: 20px; z-index: -1; pointer-events: none; }
    .id-card-face { position: relative; width: 760px; aspect-ratio: 1.72 / 1; overflow: hidden; border-radius: 22px; background: #fff; border: 1px solid #d7dce7; box-shadow: 0 18px 36px rgba(0,0,0,.12); color: #091d42; }
    .id-card-export .id-card-face { width: 760px; }
    .id-card-front { display: grid; grid-template-columns: 180px 1fr; }
    .id-card-left { background: linear-gradient(165deg, #08285f 0%, #08285f 78%, #0c82dc 79%); padding: 26px 18px 44px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
    .id-card-logo { width: 100px; height: 100px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,.22)); }
    .id-card-photo { width: 136px; height: 154px; border-radius: 12px; border: 4px solid #f4f8ff; background: #eaf2fb; display: grid; place-items: center; overflow: hidden; color: #08285f; font: 900 38px/1 Helvetica, Arial, sans-serif; }
    .id-card-photo img { width: 100%; height: 100%; object-fit: cover; }
    .id-card-main { position: relative; padding: 24px 28px 42px; }
    .id-card-school h3 { font-size: clamp(24px, 5vw, 42px); line-height: 1; letter-spacing: .16em; font-weight: 900; color: #08285f; margin: 0; }
    .id-card-school p { font-size: 13px; letter-spacing: .34em; font-weight: 900; margin: 8px 0 14px; color: #174c9d; }
    .id-card-session { position: absolute; right: 24px; top: 28px; background: #08285f; color: white; border-radius: 999px; padding: 10px 18px; font-size: 13px; font-weight: 900; letter-spacing: .08em; }
    .id-card-lines { width: 68%; display: grid; gap: 5px; }
    .id-card-line { display: grid; grid-template-columns: 142px 10px minmax(0, 1fr); gap: 6px; align-items: start; font-size: 14px; }
    .id-card-line span { font-weight: 900; color: #111; white-space: nowrap; }
    .id-card-line em { color: #111; font-style: normal; font-weight: 900; text-align: center; }
    .id-card-line strong { color: #08285f; font-size: 16px; overflow-wrap: anywhere; }
    .id-card-qr { position: absolute; right: 30px; top: 168px; }
    .id-card-qr-box { width: 84px; height: 84px; display: grid; place-items: center; border: 2px solid #08285f; border-radius: 12px; background: white; padding: 5px; }
    .id-card-qr-box img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
    .id-card-footer { position: absolute; left: 0; right: 0; bottom: 0; height: 34px; display: grid; place-items: center; background: linear-gradient(90deg, #08285f, #0a64b7); color: white; font-weight: 900; letter-spacing: .2em; }
    .id-card-back { padding: 22px 26px 46px; }
    .id-card-back-header { display: grid; grid-template-columns: 64px 1fr 94px; gap: 14px; align-items: center; border-bottom: 2px solid #e7ecf5; padding-bottom: 14px; }
    .id-card-back-header img { width: 58px; height: 58px; object-fit: contain; }
    .id-card-back-header h3 { margin: 0; color: #08285f; font-size: 22px; letter-spacing: .08em; font-weight: 900; }
    .id-card-back-header p { margin: 4px 0 0; font-size: 11px; font-weight: 900; color: #174c9d; text-transform: uppercase; letter-spacing: .16em; }
    .id-card-back-grid { margin-top: 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
    .id-card-back-grid div { min-width: 0; border-bottom: 1px solid #edf1f7; padding-bottom: 5px; }
    .id-card-back-grid span { display: block; color: #5b6472; font-size: 9px; text-transform: uppercase; font-weight: 900; }
    .id-card-back-grid strong { display: block; color: #111827; font-size: 12px; font-weight: 900; overflow-wrap: anywhere; }
    .id-card-back-note { position: absolute; left: 0; right: 0; bottom: 0; background: #08285f; color: white; padding: 10px 20px; font-size: 10px; font-weight: 800; text-align: center; }
    @media print {
      body * { visibility: hidden !important; }
      .id-print-area, .id-print-area * { visibility: visible !important; }
      .id-print-area { position: absolute; inset: 0; background: white; padding: 10mm; }
      .id-card-pair { break-after: page; page-break-after: always; gap: 10mm; }
      .id-card-face { box-shadow: none; width: 170mm; }
      .no-print { display: none !important; }
    }
  `}</style>
);
