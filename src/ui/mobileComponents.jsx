import { useState } from "react";
import { Icon } from "./primitives.jsx";
import { Btn, Field, Modal, iStyle } from "./primitives.jsx";

const DEFAULT_QUICK_ACTION_TAGS = ["Takip", "Toplantı", "Telefon/Görüşme", "Yazışma", "Sistem Kontrolü", "Saha Ziyareti", "Eğitim"];

export function QuickTodoModal({ projects, onClose, onSave }) {
  const [form, setForm] = useState({ projectId: "", customer: "", dueDate: "", action: "" });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selected = projects.find((project) => project.id === form.projectId);

  return (
    <Modal title="Hızlı To-Do" onClose={onClose}>
      <Field label="Proje / Müşteri">
        <select style={iStyle} value={form.projectId} onChange={(event) => update("projectId", event.target.value)}>
          <option value="">Genel / proje yok</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </Field>
      {!selected && (
        <Field label="Müşteri">
          <input style={iStyle} value={form.customer} onChange={(event) => update("customer", event.target.value)} placeholder="Müşteri adı" />
        </Field>
      )}
      <Field label="Termin">
        <input type="date" style={iStyle} value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
      </Field>
      <Field label="Aksiyon">
        <textarea style={{ ...iStyle, minHeight: 100, resize: "vertical" }} value={form.action} onChange={(event) => update("action", event.target.value)} placeholder="Ne yapılacak?" />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 7 }}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn disabled={!form.action.trim()} onClick={() => onSave({ ...form, customer: selected?.name || form.customer })}>Kaydet</Btn>
      </div>
    </Modal>
  );
}

export function QuickActionModal({ projects, onClose, onSave, actionTags = DEFAULT_QUICK_ACTION_TAGS }) {
  const [form, setForm] = useState({ projectId: projects[0]?.id || "", tag: "Takip", text: "", effortHours: "" });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal title="Hızlı Aksiyon" onClose={onClose}>
      <Field label="Proje">
        <select style={iStyle} value={form.projectId} onChange={(event) => update("projectId", event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Aksiyon Türü">
          <select style={iStyle} value={form.tag} onChange={(event) => update("tag", event.target.value)}>
            {actionTags.map((tag) => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
        </Field>
        <Field label="Efor (opsiyonel)">
          <input type="number" min="0" step=".25" style={iStyle} value={form.effortHours} onChange={(event) => update("effortHours", event.target.value)} />
        </Field>
      </div>
      <Field label="Not">
        <textarea style={{ ...iStyle, minHeight: 120, resize: "vertical" }} value={form.text} onChange={(event) => update("text", event.target.value)} placeholder="Ne yaptınız, kiminle görüştünüz, sonraki aksiyon nedir?" />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 7 }}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn disabled={!form.projectId || !form.text.trim()} onClick={() => onSave(form)}>Kaydet</Btn>
      </div>
    </Modal>
  );
}

export function MobileFeedCard({ title, actionLabel, onAction, children }) {
  return (
    <section style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 20, padding: 14, marginBottom: 12, boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{title}</h3>
        {actionLabel && (
          <button onClick={onAction} style={{ border: 0, background: "#EEF2FF", color: "#4338CA", borderRadius: 10, padding: "6px 9px", fontSize: 10, fontWeight: 900, cursor: "pointer" }}>
            {actionLabel}
          </button>
        )}
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </section>
  );
}

export function MobileFeedRow({ color, icon, title, meta, onClick }) {
  return (
    <button onClick={onClick} style={{ border: 0, background: "#F8FAFC", borderRadius: 14, padding: 10, display: "flex", gap: 10, alignItems: "center", textAlign: "left", cursor: "pointer" }}>
      <span style={{ width: 34, height: 34, borderRadius: 12, background: color + "16", color, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={16} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b style={{ display: "block", fontSize: 12, lineHeight: 1.35, wordBreak: "break-word", overflowWrap: "anywhere" }}>{title}</b>
        <small style={{ display: "block", fontSize: 10, color: "#94A3B8", marginTop: 2, lineHeight: 1.35, wordBreak: "break-word", overflowWrap: "anywhere" }}>{meta}</small>
      </span>
    </button>
  );
}

export function EmptyMobileRow({ text }) {
  return <div style={{ padding: "14px 10px", fontSize: 11, color: "#94A3B8", textAlign: "center", background: "#F8FAFC", borderRadius: 14 }}>{text}</div>;
}

export function MobileQuickSheet({ onClose, onSelect, isAdminMode = false }) {
  const options = isAdminMode
    ? [
        ["assign", "tasks", "Görev Ata", "Ekip üyesine görev ve hedef saat ata", "#111827"],
        ["fieldops", "calendar", "Saha Planı", "Ziyaret veya uzaktan çalışma planla", "#0F766E"],
      ]
    : [
        ["todo", "ticket", "To-Do", "Kişisel aksiyon ve termin ekle", "#DB2777"],
        ["action", "activity", "Aksiyon", "Projeye görüşme, not veya efor gir", "#2563EB"],
        ["ticket", "ticket", "Ticket", "Müşteri talebi veya problem kaydı aç", "#EA6C00"],
        ["fieldops", "calendar", "Saha Planı", "Ziyaret veya uzaktan çalışma planla", "#0F766E"],
      ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 980, background: "rgba(15,23,42,.38)", display: "flex", alignItems: "flex-end", padding: 12 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", background: "#fff", borderRadius: 26, padding: 16, boxShadow: "0 -18px 55px rgba(15,23,42,.22)" }}>
        <div style={{ width: 44, height: 5, borderRadius: 99, background: "#CBD5E1", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <b style={{ fontSize: 16 }}>Hızlı Ekle</b>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>Ne eklemek istiyorsun?</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: "#F1F5F9", borderRadius: 12, width: 34, height: 34, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
          {options.map(([id, icon, title, desc, color]) => (
            <button key={id} onClick={() => onSelect(id)} style={{ border: "1px solid #E2E8F0", background: "linear-gradient(180deg,#fff,#F8FAFC)", borderRadius: 18, padding: 14, textAlign: "left", cursor: "pointer", minHeight: 122 }}>
              <span style={{ width: 42, height: 42, borderRadius: 15, background: color + "16", color, display: "grid", placeItems: "center", marginBottom: 10 }}>
                <Icon name={icon} size={20} />
              </span>
              <b style={{ display: "block", fontSize: 14, color: "#111827" }}>{title}</b>
              <span style={{ display: "block", fontSize: 10, color: "#64748B", lineHeight: 1.35, marginTop: 4 }}>{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileBottomNav({ view, onNavigate, onQuick, onProfile, deadlineCount, taskCount, isAdminMode = false }) {
  const items = [
    ["dashboard", "home", "Ana"],
    ["projects", "projects", "Projeler"],
    ["quick", "plus", isAdminMode ? "Görev Ata" : "Ekle"],
    ["mytasks", "tasks", isAdminMode ? "Atadıklarım" : "İşler", taskCount],
    ["tickets", "ticket", "Ticket"],
  ];

  return (
    <div style={{ position: "fixed", left: 10, right: 10, bottom: 10, zIndex: 920, background: "rgba(255,255,255,.92)", backdropFilter: "blur(18px)", border: "1px solid rgba(226,232,240,.9)", borderRadius: 24, padding: "8px 9px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", boxShadow: "0 18px 45px rgba(15,23,42,.18)" }}>
      {items.map(([id, icon, label, badge]) => {
        const active = view === id;
        return (
          <button key={id} onClick={() => (id === "quick" ? onQuick() : onNavigate(id))} style={{ border: 0, background: "transparent", display: "grid", placeItems: "center", gap: 3, color: active ? "#4338CA" : "#64748B", fontSize: 9, fontWeight: 900, cursor: "pointer", position: "relative", padding: 0 }}>
            <span style={{ width: id === "quick" ? 58 : 34, height: id === "quick" ? 58 : 34, borderRadius: id === "quick" ? 20 : 14, display: "grid", placeItems: "center", background: id === "quick" ? "linear-gradient(135deg,#4A6CF7,#7C3AED)" : active ? "#EEF2FF" : "transparent", color: id === "quick" ? "#fff" : active ? "#4338CA" : "#64748B", transform: id === "quick" ? "translateY(-16px)" : "none", boxShadow: id === "quick" ? "0 14px 28px rgba(79,70,229,.32)" : "none", fontSize: id === "quick" ? 28 : undefined, fontWeight: 900 }}>
              {id === "quick" ? "+" : <Icon name={icon} size={17} />}
            </span>
            <span style={{ marginTop: id === "quick" ? -8 : 0 }}>{label}</span>
            {badge > 0 && <b style={{ position: "absolute", top: 2, right: "24%", minWidth: 16, height: 16, borderRadius: 8, display: "grid", placeItems: "center", background: "#E11D48", color: "#fff", fontSize: 8, border: "2px solid #fff" }}>{badge}</b>}
          </button>
        );
      })}
    </div>
  );
}

export function MobileFeatureMenuPage({ isAdmin, onNavigate }) {
  const items = [
    ["tickets", "ticket", "Ticketlar", "Müşteri talepleri ve durum takibi", "#EA6C00"],
    ["reports", "reports", "Raporlar", "HTML/XLSX raporlar ve özetler", "#4A6CF7"],
    ["ai", "activity", "AI Tool", "Proje veya portföy yorumu", "#7C3AED"],
    ["fieldops", "calendar", "Saha Yönetimi", "Planlar ve ziyaretler", "#0F766E"],
    ["deadlines", "clock", "Termin Uyarıları", "Gecikmeler ve yaklaşan işler", "#E11D48"],
    ["reminders", "bell", "Hatırlatıcılar", "Slack bildirimleri için zamanlayıcı kur", "#7C3AED"],
    ["todos", "tasks", "To-Do", "Kişisel aksiyonlar", "#DB2777"],
    ["people", "people", "Ekip", "Organizasyon ve kişiler", "#0369A1"],
    ...(isAdmin ? [["customers", "people", "Müşteri Görünümü", "Müşteri portalını ve proje erişimini kontrol et", "#0F766E"]] : []),
    ...(isAdmin
      ? [
          ["admin", "admin", "Yönetici", "KPI ve yönetim paneli", "#111827"],
          ["import", "download", "Import Merkezi", "Şablon ve veri aktarımı", "#059669"],
          ["mailcenter", "mail", "Mail Merkezi", "Şablonlar ve otomasyon", "#4338CA"],
        ]
      : []),
  ];

  return (
    <div style={{ minHeight: "100%", background: "#F8FAFC", padding: "18px 14px 92px", overflow: "auto" }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Tüm Özellikler</h2>
        <div style={{ fontSize: 12, color: "#64748B" }}>Web tarafındaki ana alanlara mobilde de buradan erişebilirsiniz.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        {items.map(([targetView, icon, title, desc, color]) => (
          <button key={targetView} onClick={() => onNavigate(targetView)} style={{ border: "1px solid #E2E8F0", background: "#fff", borderRadius: 18, padding: 14, textAlign: "left", cursor: "pointer", minHeight: 122, boxShadow: "0 8px 22px rgba(15,23,42,.04)" }}>
            <span style={{ width: 38, height: 38, borderRadius: 13, background: color + "16", color, display: "grid", placeItems: "center", marginBottom: 10 }}>
              <Icon name={icon} size={18} />
            </span>
            <b style={{ display: "block", fontSize: 13, color: "#111827" }}>{title}</b>
            <span style={{ display: "block", fontSize: 10, color: "#64748B", lineHeight: 1.35, marginTop: 4 }}>{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
