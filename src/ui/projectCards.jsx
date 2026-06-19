import { useRef, useState } from "react";
import { projectResponsibleIds } from "../domain/projectHelpers.js";
import { Field, Icon, iStyle } from "./primitives.jsx";
import { Badge, delayLvl } from "./status.jsx";

const noop = () => {};
const defaultFormatDate = (value) => value || "-";
const defaultMapsUrl = () => "";
const defaultReadinessScore = () => 0;

const readImageAsDataUrl = (file, callback) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 360;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/webp", 0.82));
    };
    img.onerror = () => callback(String(reader.result || ""));
    img.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
};

const textClamp = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function LogoTile({ customer, customerName, canEdit = false, onClick = noop, size = 44 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={canEdit ? "Logo yükle" : "Müşteri logosu"}
      className="project-logo-tile"
      style={{ width: size, height: size, cursor: canEdit ? "pointer" : "default" }}
    >
      {customer.logoUrl ? (
        <img src={customer.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff", padding: 6 }} />
      ) : (
        <b style={{ fontSize: size > 42 ? 17 : 15, color: "var(--accent)" }}>{customerName.slice(0, 2).toUpperCase()}</b>
      )}
    </button>
  );
}

export function ProjectBusinessCard({
  project,
  activePMs,
  activeStakeholders,
  contacts,
  progress,
  doneT,
  totalT,
  currentMs,
  readiness,
  commissioningPercent,
  overdueC,
  criticalC,
  canEdit,
  onChange = noop,
  onOpenSetup = noop,
  formatDate = defaultFormatDate,
  mapsUrlForLocation = defaultMapsUrl,
  moduleOptions = [],
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileInput = useRef(null);
  const customer = project.customerProfile || {};
  const location = project.location || { city: "", district: "", address: "" };
  const modules = project.activeModules || [];
  const customerName = customer.name || project.customerName || project.name;
  const mapUrl = mapsUrlForLocation(location);
  const website = customer.website ? (customer.website.startsWith("http") ? customer.website : `https://${customer.website}`) : "";
  const responsibleLabel = project.uatAccepted ? "Customer Success" : "PM";
  const healthy = readiness >= Number(project.readinessThreshold || 80);

  const updateCustomer = (data) => onChange({ customerProfile: { ...customer, ...data } });
  const updateLocation = (key, value) => onChange({ location: { ...location, [key]: value } });
  const toggleModule = (module) =>
    onChange({ activeModules: modules.includes(module) ? modules.filter((item) => item !== module) : [...modules, module] });
  const uploadLogo = (file) => {
    readImageAsDataUrl(file, (logoUrl) => updateCustomer({ logoUrl }));
  };

  return (
    <div className="project-business-shell">
      <div className="project-business-card" onClick={() => setExpanded((value) => !value)} style={{ padding: "10px 12px" }}>
        <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 11, alignItems: "center" }}>
          <LogoTile
            customer={customer}
            customerName={customerName}
            canEdit={canEdit}
            onClick={(event) => {
              event.stopPropagation();
              if (canEdit) fileInput.current?.click();
            }}
          />
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(event) => uploadLogo(event.target.files?.[0])} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(19px,2.45vw,25px)", lineHeight: 1.08, letterSpacing: "-.03em", ...textClamp }}>
              {customerName}
            </h2>
            <div style={{ marginTop: 6, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: "var(--muted)", lineHeight: 1.35 }}>
              {activePMs.length > 0 && (
                <span style={{ ...textClamp, maxWidth: 280 }}>
                  {responsibleLabel}: <b style={{ color: "var(--text)" }}>{activePMs.map((person) => person.name).join(", ")}</b>
                </span>
              )}
              {website && (
                <a href={website} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} style={{ fontWeight: 850, maxWidth: 210, ...textClamp }}>
                  {customer.website}
                </a>
              )}
              {expanded && mapUrl && (
                <a href={mapUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} style={{ fontWeight: 850 }}>
                  Yol tarifi
                </a>
              )}
              {expanded && modules.slice(0, 5).map((module) => <span key={module}>{module}</span>)}
            </div>
            {expanded && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                {activeStakeholders.slice(0, 3).map((item) => (
                  <span key={item.id}>{item.role}: <b style={{ color: "var(--text)" }}>{item.person.name}</b></span>
                ))}
                <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
                <span>{doneT}/{totalT} görev</span>
                {currentMs && <span>Aktif: <b style={{ color: "var(--text)" }}>{currentMs.name}</b></span>}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 3, minWidth: 72, justifyItems: "end" }}>
            <b style={{ fontSize: 20, lineHeight: 1, color: "var(--accent)" }}>{progress}%</b>
            <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 850 }}>Tamamlama</span>
            {expanded && canEdit && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing((value) => !value);
                }}
                className="btn-base"
                style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--accent)", borderRadius: 9, padding: "5px 8px", fontSize: 9, fontWeight: 950, cursor: "pointer" }}
              >
                {editing ? "Kapat" : "Düzenle"}
              </button>
            )}
          </div>
        </div>
        {expanded && totalT > 0 && (
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
            <div className="project-progress-track" style={{ flex: 1 }}>
              <div className="project-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 900, color: "var(--accent)" }}>{progress}%</span>
          </div>
        )}
      </div>
      <button
        onClick={() => setExpanded((value) => !value)}
        title={expanded ? "Daralt" : "Detayları aç"}
        className="btn-base"
        style={{ display: "grid", placeItems: "center", width: 30, height: 20, margin: "-1px auto 0", border: "1px solid var(--glass-border)", borderTop: 0, borderRadius: "0 0 10px 10px", background: "rgb(255 255 255 / 72%)", color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 950, lineHeight: 1 }}
      >
        {expanded ? "⌃" : "⌄"}
      </button>
      {expanded && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 7 }}>
          <button onClick={onOpenSetup} className={`project-metric-pill ${healthy ? "is-good" : "is-danger"}`} style={{ cursor: "pointer" }}>
            Proje Sağlığı: %{readiness}
          </button>
          {commissioningPercent !== null && <span className="project-metric-pill is-good">Devreye Alma: %{commissioningPercent}</span>}
          {overdueC > 0 && <span className="project-metric-pill is-warn">Gecikmiş: {overdueC}</span>}
          {criticalC > 0 && <span className="project-metric-pill is-danger">Kritik: {criticalC}</span>}
          {contacts.slice(0, 3).map((contact) => (
            <span key={contact.id} className="project-metric-pill">{contact.name}{contact.title ? ` · ${contact.title}` : ""}</span>
          ))}
        </div>
      )}
      {expanded && editing && canEdit && (
        <div className="liquid-card" style={{ marginTop: 10, borderRadius: 16, padding: 13, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9 }}>
            <Field label="Müşteri Adı"><input style={iStyle} value={customer.name || ""} onChange={(event) => updateCustomer({ name: event.target.value })} placeholder="Firma adı" /></Field>
            <Field label="Web Adresi"><input style={iStyle} value={customer.website || ""} onChange={(event) => updateCustomer({ website: event.target.value })} placeholder="https://firma.com" /></Field>
            <Field label="Logo URL">
              <div style={{ display: "grid", gap: 6 }}>
                <input style={iStyle} value={(customer.logoUrl || "").startsWith("data:") ? "" : customer.logoUrl || ""} onChange={(event) => updateCustomer({ logoUrl: event.target.value })} placeholder="https://.../logo.png" />
                <button type="button" onClick={() => fileInput.current?.click()} className="btn-base" style={{ border: "1px solid var(--border)", background: "var(--accent-ink)", color: "var(--accent)", borderRadius: 9, padding: "7px 9px", fontSize: 10, fontWeight: 900, cursor: "pointer", textAlign: "left" }}>veya dosya yükle</button>
              </div>
            </Field>
            <Field label="Kart Rengi"><input type="color" style={{ ...iStyle, padding: 4, height: 42 }} value={customer.accentColor || project.color || "#0b8a94"} onChange={(event) => updateCustomer({ accentColor: event.target.value })} /></Field>
            <Field label="İl"><input style={iStyle} value={location.city || ""} onChange={(event) => updateLocation("city", event.target.value)} /></Field>
            <Field label="İlçe"><input style={iStyle} value={location.district || ""} onChange={(event) => updateLocation("district", event.target.value)} /></Field>
            <Field label="Adres"><input style={iStyle} value={location.address || ""} onChange={(event) => updateLocation("address", event.target.value)} placeholder="Açık adres" /></Field>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {moduleOptions.map((module) => {
              const active = modules.includes(module);
              return (
                <button key={module} onClick={() => toggleModule(module)} className="btn-base" style={{ border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-ink)" : "rgb(255 255 255 / 72%)", color: active ? "var(--accent)" : "var(--muted)", borderRadius: 999, padding: "7px 10px", fontSize: 10, fontWeight: 850, cursor: "pointer" }}>
                  {module}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectListCard({
  project,
  people,
  isAdmin,
  onOpen,
  onEdit,
  onReport,
  onDelete,
  readinessScoreForProject = defaultReadinessScore,
}) {
  const total = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.length, 0);
  const done = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.filter((task) => task.status === "Tamamlandı").length, 0);
  const progress = total ? Math.round((done / total) * 100) : 0;
  const overdue = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.filter((task) => delayLvl(task.dueDate, task.status)).length, 0);
  const critical = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.filter((task) => delayLvl(task.dueDate, task.status) === "critical").length, 0);
  const pms = projectResponsibleIds(project).map((id) => people.find((person) => person.id === id)).filter(Boolean);
  const customer = project.customerProfile || {};
  const customerName = customer.name || project.customerName || project.name;
  const readiness = readinessScoreForProject(project);
  const responsibleLabel = project.uatAccepted ? "CS" : "PM";
  const responsibleNames = pms.map((pm) => pm.name).join(", ");
  const healthOk = readiness >= Number(project.readinessThreshold || 80);

  return (
    <div className="project-list-card" onClick={onOpen}>
      <div className="project-list-card-header">
        <LogoTile customer={customer} customerName={customerName} size={40} />
        <span style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.18, color: "var(--text)", ...textClamp }}>{customerName}</h3>
          <span style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "var(--muted)", fontWeight: 750, ...textClamp }}>
            {responsibleNames ? `${responsibleLabel}: ${responsibleNames}` : project.name}
          </span>
        </span>
        <span style={{ display: "grid", justifyItems: "end", gap: 2 }}>
          <b style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, color: "var(--accent)" }}>{progress}%</b>
          <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800 }}>ilerleme</span>
        </span>
      </div>
      <div style={{ padding: "12px 15px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, ...textClamp }}>{project.name}</span>
          <Badge label={project.status} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <span className={`project-metric-pill ${healthOk ? "is-good" : "is-danger"}`} style={{ justifyContent: "center", minWidth: 0 }}>
            Sağlık %{readiness}
          </span>
          <span style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", minWidth: 0 }}>
            {project.uatAccepted && <span className="project-metric-pill">UAT</span>}
            {critical > 0 ? <span className="project-metric-pill is-danger">{critical} kritik</span> : overdue > 0 ? <span className="project-metric-pill is-warn">{overdue} gecikme</span> : null}
          </span>
        </div>
        <div className="project-progress-track">
          <div className="project-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 750 }}>{done}/{total} görev tamamlandı</div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 5 }}>
              {[
                ["edit", onEdit, "Düzenle"],
                ["download", onReport, "HTML rapor"],
                ["trash", onDelete, "Sil"],
              ].map(([icon, action, title]) => (
                <button key={icon} title={title} aria-label={title} onClick={(event) => { event.stopPropagation(); action(); }} className="project-icon-action">
                  <Icon name={icon} size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
