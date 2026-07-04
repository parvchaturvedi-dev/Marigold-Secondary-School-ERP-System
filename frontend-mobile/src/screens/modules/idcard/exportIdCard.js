import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const NAVY = "#08285f";

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialsOf(profile) {
  return escapeHtml(String(profile.displayName || "ID").slice(0, 2).toUpperCase());
}

function renderFrontFields(profile) {
  return (profile.frontFields || [])
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<div class="line"><span class="lbl">${escapeHtml(label)}</span><span class="colon">:</span><span class="val">${escapeHtml(value)}</span></div>`,
    )
    .join("");
}

function renderBackCells(profile) {
  return (profile.backFields || [])
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<div class="cell"><div class="cellLbl">${escapeHtml(label)}</div><div class="cellVal">${escapeHtml(value)}</div></div>`,
    )
    .join("");
}

function renderPhoto(profile) {
  if (profile.photoDataUrl) {
    return `<img class="photoImg" src="${escapeHtml(profile.photoDataUrl)}" alt="photo" />`;
  }
  return `<span class="initials">${initialsOf(profile)}</span>`;
}

function cardHtml(profile) {
  return `
    <div class="pair">
      <div class="front">
        <div class="left">
          <div class="badge">MGPS</div>
          <div class="photo">${renderPhoto(profile)}</div>
        </div>
        <div class="main">
          <div class="school">MARIGOLD SECONDARY SCHOOL</div>
          <div class="tagline">LEARN - GROW - SUCCEED</div>
          <div class="session">SESSION: 2026-27</div>
          ${renderFrontFields(profile)}
          <div class="qr">QR</div>
        </div>
        <div class="footer">www.marigoldschoolbehror.com</div>
      </div>
      <div class="back">
        <div class="backHeader">
          <div class="backBadge">MGPS</div>
          <div class="backTitle">
            <div class="backSchool">MARIGOLD SECONDARY SCHOOL</div>
            <div class="backSub">${escapeHtml(profile.roleLabel || "")} Identity Details</div>
          </div>
          <div class="qr small">QR</div>
        </div>
        <div class="grid">${renderBackCells(profile)}</div>
        <div class="backNote">If found, please return this card to the school office. This card is ERP generated.</div>
      </div>
    </div>
  `;
}

function documentHtml(cardsHtml) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; padding: 18px; background: #fff; }
  .pair { page-break-inside: avoid; page-break-after: always; margin-bottom: 24px; }
  .pair:last-child { page-break-after: auto; }
  .front { position: relative; min-height: 300px; background: #fff; border: 1px solid #D7DCE7; border-radius: 22px; overflow: hidden; display: flex; }
  .left { width: 130px; background: ${NAVY}; display: flex; flex-direction: column; align-items: center; padding-top: 22px; gap: 24px; }
  .badge { color: #fff; font-weight: 900; font-size: 22px; letter-spacing: 2px; }
  .photo { width: 98px; height: 116px; border-radius: 10px; border: 3px solid #F4F8FF; background: #EAF2FB; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .photoImg { width: 100%; height: 100%; object-fit: cover; }
  .initials { color: ${NAVY}; font-weight: 900; font-size: 30px; }
  .main { flex: 1; padding: 18px; padding-bottom: 44px; position: relative; }
  .school { color: ${NAVY}; font-weight: 900; font-size: 22px; letter-spacing: 1px; }
  .tagline { color: #174c9d; font-weight: 900; font-size: 11px; letter-spacing: 3px; margin-top: 5px; margin-bottom: 10px; }
  .session { display: inline-block; background: ${NAVY}; color: #fff; padding: 5px 12px; border-radius: 12px; font-weight: 900; font-size: 11px; margin-bottom: 10px; }
  .line { display: flex; margin-bottom: 5px; align-items: flex-start; }
  .lbl { width: 120px; color: #111; font-weight: 900; font-size: 12px; }
  .colon { color: #111; font-weight: 900; margin-right: 6px; }
  .val { flex: 1; color: ${NAVY}; font-weight: 900; font-size: 13px; }
  .qr { width: 66px; height: 66px; border: 2px solid ${NAVY}; border-radius: 10px; background: #fff; display: flex; align-items: center; justify-content: center; color: ${NAVY}; font-weight: 900; font-size: 12px; margin-left: auto; margin-top: 8px; }
  .qr.small { width: 60px; height: 60px; margin: 0; }
  .footer { position: absolute; left: 0; right: 0; bottom: 0; background: ${NAVY}; color: #fff; text-align: center; padding: 9px 0; font-weight: 900; font-size: 11px; letter-spacing: 1px; }
  .back { position: relative; min-height: 300px; background: #fff; border: 1px solid #D7DCE7; border-radius: 22px; padding: 18px; padding-bottom: 44px; overflow: hidden; margin-top: 16px; }
  .backHeader { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #E7ECF5; padding-bottom: 12px; }
  .backBadge { color: ${NAVY}; font-weight: 900; font-size: 18px; letter-spacing: 1px; }
  .backTitle { flex: 1; }
  .backSchool { color: ${NAVY}; font-weight: 900; font-size: 16px; letter-spacing: 1px; }
  .backSub { color: #174c9d; font-weight: 900; font-size: 10px; margin-top: 2px; }
  .grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .cell { width: 47%; border-bottom: 1px solid #EDF1F7; padding-bottom: 5px; }
  .cellLbl { color: #5B6472; font-size: 9px; font-weight: 900; }
  .cellVal { color: #111827; font-size: 12px; font-weight: 900; margin-top: 2px; }
  .backNote { position: absolute; left: 0; right: 0; bottom: 0; background: ${NAVY}; color: #fff; text-align: center; padding: 9px; font-weight: 800; font-size: 10px; }
</style>
</head>
<body>
${cardsHtml}
</body>
</html>`;
}

async function printAndShare(html, dialogTitle) {
  let uri;
  try {
    const result = await Print.printToFileAsync({ html });
    uri = result.uri;
  } catch (error) {
    throw new Error(`Could not generate the ID card PDF: ${error.message || error}`);
  }

  if (!uri) {
    throw new Error("Could not generate the ID card PDF: no file was produced.");
  }

  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error("Sharing is not available on this device.");
    }
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle,
      UTI: "com.adobe.pdf",
    });
  } catch (error) {
    throw new Error(`Could not share the ID card PDF: ${error.message || error}`);
  }

  return uri;
}

export async function exportIdCardPdf(profile) {
  if (!profile) {
    throw new Error("No ID card data was provided to export.");
  }
  const html = documentHtml(cardHtml(profile));
  return printAndShare(html, `${profile.displayName || "ID Card"} - ID Card`);
}

export async function exportManyIdCards(profiles) {
  const list = (profiles || []).filter(Boolean);
  if (!list.length) {
    throw new Error("There are no ID cards to export.");
  }
  const html = documentHtml(list.map(cardHtml).join("\n"));
  return printAndShare(html, `Marigold ID Cards (${list.length})`);
}
