import { useRef, useState } from "react";
import { projectResponsibleIds, projectStakeholders } from "../domain/projectHelpers.js";
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
  const accent = customer.accentColor || project.color || "#4A6CF7";
  const mapUrl = mapsUrlForLocation(location);
  const website = customer.website ? (customer.website.startsWith("http") ? customer.website : `https://${customer.website}`) : "";
  const responsibleLabel = project.uatAccepted ? "Customer Success" : "PM";

  const updateCustomer = (data) => onChange({ customerProfile: { ...customer, ...data } });
  const updateLocation = (key, value) => onChange({ location: { ...location, [key]: value } });
  const toggleModule = (module) =>
    onChange({ activeModules: modules.includes(module) ? modules.filter((item) => item !== module) : [...modules, module] });
  const uploadLogo = (file) => {
    readImageAsDataUrl(file, (logoUrl) => updateCustomer({ logoUrl }));
  };

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "8px clamp(10px,2vw,18px) 8px" }}>
      <div
        onClick={() => setExpanded((value) => !value)}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          background: `linear-gradient(135deg,#0F172A 0%,${accent} 58%,#111827 100%)`,
          color: "#fff",
          padding: "9px 12px",
          boxShadow: `0 10px 24px ${accent}24`,
          cursor: "pointer",
        }}
      >
        <div style={{ position: "absolute", right: -45, top: -75, width: 145, height: 145, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canEdit) fileInput.current?.click();
            }}
            title={canEdit ? "Logo yükle" : "Müşteri logosu"}
            style={{
              width: 44,
              height: 44,
              border: 0,
              borderRadius: 13,
              background: "rgba(255,255,255,.18)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              cursor: canEdit ? "pointer" : "default",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.24)",
            }}
          >
            {customer.logoUrl ? (
              <img src={customer.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff", padding: 6 }} />
            ) : (
              <b style={{ fontSize: 26, color: "#fff" }}>{customerName.slice(0, 2).toUpperCase()}</b>
            )}
          </button>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(event) => uploadLogo(event.target.files?.[0])} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(19px,2.45vw,25px)", lineHeight: 1.08, letterSpacing: "-.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fff", fontWeight: 950, textShadow: "0 2px 12px rgba(0,0,0,.75)" }}>
              {customerName}
            </h2>
            <div style={{ marginTop: 5, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 10, color: "rgba(255,255,255,.82)", lineHeight: 1.35 }}>
              {activePMs.length > 0 && <span>{responsibleLabel}: <b style={{ color: "#fff" }}>{activePMs.map((person) => person.name).join(", ")}</b></span>}
              {website && <a href={website} target="_blank" rel="noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: 850, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.website}</a>}
              {expanded && mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: 850 }}>Yol tarifi</a>}
              {expanded && modules.slice(0, 5).map((module) => <span key={module}>{module}</span>)}
            </div>
            {expanded && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "rgba(255,255,255,.78)" }}>
                {activeStakeholders.slice(0, 3).map((item) => <span key={item.id}>{item.role}: <b style={{ color: "#fff" }}>{item.person.name}</b></span>)}
                <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
                <span>{doneT}/{totalT} görev</span>
                {currentMs && <span>Aktif: <b style={{ color: "#fff" }}>{currentMs.name}</b></span>}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 2, minWidth: 70, justifyItems: "end" }}>
            <b style={{ fontSize: 18, lineHeight: 1 }}>{progress}%</b>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,.75)", fontWeight: 850 }}>Tamamlama</span>
            {expanded && canEdit && (
              <button onClick={(event) => { event.stopPropagation(); setEditing((value) => !value); }} style={{ border: 0, background: "#fff", color: accent, borderRadius: 9, padding: "5px 8px", fontSize: 9, fontWeight: 950, cursor: "pointer" }}>
                {editing ? "Kapat" : "Düzenle"}
              </button>
            )}
          </div>
        </div>
        {expanded && totalT > 0 && (
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
            <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,.2)", borderRadius: 10, overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "#fff", borderRadius: 10 }} /></div>
            <span style={{ fontSize: 10, fontWeight: 900 }}>{progress}%</span>
          </div>
        )}
      </div>
      <button onClick={() => setExpanded((value) => !value)} title={expanded ? "Daralt" : "Detayları aç"} style={{ display: "grid", placeItems: "center", width: 28, height: 18, margin: "-2px auto 0", border: 0, borderRadius: "0 0 10px 10px", background: "#F1F5F9", color: accent, cursor: "pointer", fontSize: 13, fontWeight: 950, lineHeight: 1 }}>
        {expanded ? "⌃" : "⌄"}
      </button>
      {expanded && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 7, fontSize: 11 }}>
          <button onClick={onOpenSetup} style={{ border: 0, background: readiness >= Number(project.readinessThreshold || 80) ? "#ECFDF5" : "#FFF1F2", color: readiness >= Number(project.readinessThreshold || 80) ? "#047857" : "#BE123C", borderRadius: 12, padding: "5px 9px", fontSize: 11, fontWeight: 850, cursor: "pointer" }}>
            Proje Sağlığı: %{readiness}
          </button>
          {commissioningPercent !== null && <span style={{ background: "#ECFDF5", color: "#047857", borderRadius: 12, padding: "5px 9px", fontWeight: 850 }}>Devreye Alma: %{commissioningPercent}</span>}
          {overdueC > 0 && <span style={{ background: "#FFF7ED", color: "#EA6C00", borderRadius: 12, padding: "5px 9px", fontWeight: 850 }}>Gecikmiş: {overdueC}</span>}
          {criticalC > 0 && <span style={{ background: "#FFF1F2", color: "#E11D48", borderRadius: 12, padding: "5px 9px", fontWeight: 850 }}>Kritik: {criticalC}</span>}
          {contacts.slice(0, 3).map((contact) => <span key={contact.id} style={{ background: "#F0F9FF", color: "#0369A1", borderRadius: 12, padding: "5px 9px", fontWeight: 800 }}>{contact.name}{contact.title ? ` · ${contact.title}` : ""}</span>)}
        </div>
      )}
      {expanded && editing && canEdit && (
        <div style={{ marginTop: 10, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 16, padding: 13, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9 }}>
            <Field label="Müşteri Adı"><input style={iStyle} value={customer.name || ""} onChange={(event) => updateCustomer({ name: event.target.value })} placeholder="Firma adı" /></Field>
            <Field label="Web Adresi"><input style={iStyle} value={customer.website || ""} onChange={(event) => updateCustomer({ website: event.target.value })} placeholder="https://firma.com" /></Field>
            <Field label="Logo URL">
              <div style={{ display: "grid", gap: 6 }}>
                <input style={iStyle} value={(customer.logoUrl || "").startsWith("data:") ? "" : customer.logoUrl || ""} onChange={(event) => updateCustomer({ logoUrl: event.target.value })} placeholder="https://.../logo.png" />
                <button type="button" onClick={() => fileInput.current?.click()} style={{ border: 0, background: "#EEF2FF", color: "#4338CA", borderRadius: 9, padding: "7px 9px", fontSize: 10, fontWeight: 900, cursor: "pointer", textAlign: "left" }}>veya dosya yükle</button>
              </div>
            </Field>
            <Field label="Kart Rengi"><input type="color" style={{ ...iStyle, padding: 4, height: 42 }} value={accent} onChange={(event) => updateCustomer({ accentColor: event.target.value })} /></Field>
            <Field label="İl"><input style={iStyle} value={location.city || ""} onChange={(event) => updateLocation("city", event.target.value)} /></Field>
            <Field label="İlçe"><input style={iStyle} value={location.district || ""} onChange={(event) => updateLocation("district", event.target.value)} /></Field>
            <Field label="Adres"><input style={iStyle} value={location.address || ""} onChange={(event) => updateLocation("address", event.target.value)} placeholder="Açık adres" /></Field>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {moduleOptions.map((module) => (
              <button key={module} onClick={() => toggleModule(module)} style={{ border: `1px solid ${modules.includes(module) ? accent : "#E2E8F0"}`, background: modules.includes(module) ? `${accent}18` : "#fff", color: modules.includes(module) ? accent : "#64748B", borderRadius: 999, padding: "7px 10px", fontSize: 10, fontWeight: 850, cursor: "pointer" }}>
                {module}
              </button>
            ))}
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
  formatDate = defaultFormatDate,
  readinessScoreForProject = defaultReadinessScore,
}) {
  const total = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.length, 0);
  const done = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.filter((task) => task.status === "Tamamlandı").length, 0);
  const progress = total ? Math.round((done / total) * 100) : 0;
  const overdue = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.filter((task) => delayLvl(task.dueDate, task.status)).length, 0);
  const critical = project.milestones.reduce((sum, milestone) => sum + milestone.tasks.filter((task) => delayLvl(task.dueDate, task.status) === "critical").length, 0);
  const pms = projectResponsibleIds(project).map((id) => people.find((person) => person.id === id)).filter(Boolean);
  const stakeholders = projectStakeholders(project).map((item) => ({ ...item, person: people.find((person) => person.id === item.userId) })).filter((item) => item.person);
  const activeMs = project.milestones.find((milestone) => milestone.status !== "Tamamlandı");
  const customer = project.customerProfile || {};
  const customerName = customer.name || project.customerName || project.name;
  const accent = customer.accentColor || project.color;
  const website = customer.website ? (customer.website.startsWith("http") ? customer.website : `https://${customer.website}`) : "";
  const readiness = readinessScoreForProject(project);
  const responsibleLabel = project.uatAccepted ? "CS" : "PM";

  return (
    <div
      onClick={onOpen}
      style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.04)", overflow: "hidden", transition: "box-shadow .15s, transform .15s" }}
      onMouseEnter={(event) => { event.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.1)"; event.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(event) => { event.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.04)"; event.currentTarget.style.transform = "none"; }}
    >
      <div style={{ background: `linear-gradient(135deg,#0F172A 0%,${accent} 62%,#111827 100%)`, color: "#fff", padding: "12px 13px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
          {customer.logoUrl ? <img src={customer.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5 }} /> : <b style={{ fontSize: 16, color: accent }}>{customerName.slice(0, 2).toUpperCase()}</b>}
        </span>
        <span style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 950, lineHeight: 1.12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.75)" }}>{customerName}</h3>
          <span style={{ display: "flex", gap: 8, marginTop: 5, fontSize: 10, color: "rgba(255,255,255,.86)", overflow: "hidden" }}>
            {pms.length > 0 && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{responsibleLabel}: <b style={{ color: "#fff" }}>{pms.map((pm) => pm.name).join(", ")}</b></span>}
            {website && <a href={website} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} style={{ color: "#fff", fontWeight: 850, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{customer.website}</a>}
          </span>
        </span>
        <span style={{ fontSize: 18, fontWeight: 950, textAlign: "right" }}>{progress}%</span>
      </div>
      <div style={{ padding: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
          <Badge label={project.status} />
        </div>
        {activeMs && <div style={{ fontSize: 11, color: "#4A6CF7", marginBottom: 7, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Aktif: {activeMs.name} - {formatDate(activeMs.dueDate)}</div>}
        <div style={{ display: "flex", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
          {project.uatAccepted && <span style={{ color: "#0369A1", fontSize: 10, fontWeight: 900 }}>UAT alındı · CS devrinde</span>}
          <span style={{ color: readiness >= Number(project.readinessThreshold || 80) ? "#047857" : "#BE123C", fontSize: 10, fontWeight: 850 }}>Proje Sağlığı %{readiness}</span>
          {overdue > 0 && <span style={{ color: "#EA6C00", fontSize: 10, fontWeight: 800 }}>Gecikmiş: {overdue}</span>}
          {critical > 0 && <span style={{ color: "#E11D48", fontSize: 10, fontWeight: 800 }}>Kritik: {critical}</span>}
          {stakeholders.slice(0, 2).map((item) => <span key={item.id} style={{ fontSize: 10, color: "#64748B" }}>{item.role}: {item.person.name}</span>)}
        </div>
        <div style={{ height: 4, background: "#F1F5FF", borderRadius: 10 }}><div style={{ width: `${progress}%`, height: "100%", background: accent, borderRadius: 10 }} /></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 7 }}>
          <div style={{ fontSize: 11, color: "#64748B" }}>{done}/{total} görev</div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 4 }}>
              {[
                ["edit", "#EEF2FF", "#4A6CF7", onEdit, "Düzenle"],
                ["download", "#ECFDF5", "#059669", onReport, "HTML rapor"],
                ["trash", "#FFF1F2", "#E11D48", onDelete, "Sil"],
              ].map(([icon, bg, color, action, title]) => (
                <button key={icon} title={title} aria-label={title} onClick={(event) => { event.stopPropagation(); action(); }} style={{ width: 28, height: 28, border: 0, borderRadius: 7, background: bg, color, display: "grid", placeItems: "center", cursor: "pointer" }}>
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
