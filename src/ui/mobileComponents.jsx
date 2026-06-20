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
    <section className="liquid-card" style={{ borderRadius: 20, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{title}</h3>
        {actionLabel && (
          <button className="btn-base" onClick={onAction} style={{ border: "1px solid var(--border, #cfe0e3)", background: "var(--surface, #ffffff)", color: "var(--accent, #0b8a94)", borderRadius: 10, padding: "6px 9px", fontSize: 10, fontWeight: 900, cursor: "pointer" }}>
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
    <button className="btn-base" onClick={onClick} style={{ border: "1px solid var(--border, #cfe0e3)", background: "var(--surface-soft, #f6fafb)", borderRadius: 14, padding: 10, display: "flex", gap: 10, alignItems: "center", textAlign: "left", cursor: "pointer" }}>
      <span style={{ width: 34, height: 34, borderRadius: 12, background: color + "16", color, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={16} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b style={{ display: "block", fontSize: 12, lineHeight: 1.35, wordBreak: "break-word", overflowWrap: "anywhere" }}>{title}</b>
        <small style={{ display: "block", fontSize: 10, color: "var(--muted, #5b6f74)", marginTop: 2, lineHeight: 1.35, wordBreak: "break-word", overflowWrap: "anywhere" }}>{meta}</small>
      </span>
    </button>
  );
}

export function EmptyMobileRow({ text }) {
  return <div style={{ padding: "14px 10px", fontSize: 11, color: "var(--muted, #5b6f74)", textAlign: "center", background: "var(--surface-soft, #f6fafb)", borderRadius: 14 }}>{text}</div>;
}

export function MobileQuickSheet({ onClose, onSelect, isAdminMode = false }) {
  const options = isAdminMode
    ? [
        ["assign", "tasks", "Görev Ata", "Ekip üyesine görev ve hedef saat ata", "var(--text)"],
        ["fieldops", "calendar", "Saha Planı", "Ziyaret veya uzaktan çalışma planla", "var(--accent)"],
      ]
    : [
        ["todo", "ticket", "To-Do", "Kişisel aksiyon ve termin ekle", "#DB2777"],
        ["action", "activity", "Aksiyon", "Projeye görüşme, not veya efor gir", "var(--accent)"],
        ["ticket", "ticket", "Ticket", "Müşteri talebi veya problem kaydı aç", "var(--warning)"],
        ["fieldops", "calendar", "Saha Planı", "Ziyaret veya uzaktan çalışma planla", "var(--accent)"],
      ];

  return (
    <div className="modal-scrim" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 980, display: "flex", alignItems: "flex-end", padding: 12 }}>
      <div className="glass-surface" onClick={(event) => event.stopPropagation()} style={{ width: "100%", borderRadius: 28, padding: 16, boxShadow: "0 -22px 62px -36px rgb(17 35 39 / 64%)" }}>
        <div style={{ width: 44, height: 5, borderRadius: 99, background: "var(--muted)", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <b style={{ fontSize: 16 }}>Hızlı Ekle</b>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Ne eklemek istiyorsun?</div>
          </div>
          <button className="btn-base" onClick={onClose} style={{ border: "1px solid var(--border, #cfe0e3)", background: "var(--surface, #ffffff)", color: "var(--muted, #5b6f74)", borderRadius: 12, width: 34, height: 34, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
          {options.map(([id, icon, title, desc, color]) => (
            <button className="liquid-card" key={id} onClick={() => onSelect(id)} style={{ borderRadius: 18, padding: 14, textAlign: "left", cursor: "pointer", minHeight: 122 }}>
              <span style={{ width: 42, height: 42, borderRadius: 15, background: color + "16", color, display: "grid", placeItems: "center", marginBottom: 10 }}>
                <Icon name={icon} size={20} />
              </span>
              <b style={{ display: "block", fontSize: 14, color: "var(--text)" }}>{title}</b>
              <span style={{ display: "block", fontSize: 10, color: "var(--muted)", lineHeight: 1.35, marginTop: 4 }}>{desc}</span>
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
    <div className="glass-surface mobile-bottom-nav">
      {items.map(([id, icon, label, badge]) => {
        const active = view === id;
        const quick = id === "quick";
        return (
          <button key={id} className={`mobile-bottom-nav-button ${active ? "is-active" : ""} ${quick ? "is-quick" : ""}`} onClick={() => (quick ? onQuick() : onNavigate(id))}>
            <span className={`mobile-bottom-nav-icon ${active ? "is-active" : ""} ${quick ? "is-quick" : ""}`}>
              {quick ? "+" : <Icon name={icon} size={16} />}
            </span>
            <span className="mobile-bottom-nav-label">{label}</span>
            {badge > 0 && <b className="mobile-bottom-badge">{badge}</b>}
          </button>
        );
      })}
    </div>
  );
}

export function MobileFeatureMenuPage({ isAdmin, onNavigate }) {
  const items = [
    ["tickets", "ticket", "Ticketlar", "Müşteri talepleri ve durum takibi", "var(--warning)"],
    ["reports", "reports", "Raporlar", "HTML/XLSX raporlar ve özetler", "var(--accent)"],
    ["ai", "activity", "AI Tool", "Proje veya portföy yorumu", "var(--accent)"],
    ["fieldops", "calendar", "Saha Yönetimi", "Planlar ve ziyaretler", "var(--accent)"],
    ["deadlines", "clock", "Termin Uyarıları", "Gecikmeler ve yaklaşan işler", "var(--danger)"],
    ["reminders", "bell", "Hatırlatıcılar", "Slack bildirimleri için zamanlayıcı kur", "var(--accent)"],
    ["todos", "tasks", "To-Do", "Kişisel aksiyonlar", "#DB2777"],
    ["people", "people", "Ekip", "Organizasyon ve kişiler", "var(--accent)"],
    ...(isAdmin ? [["customers", "people", "Müşteri Görünümü", "Müşteri portalını ve proje erişimini kontrol et", "var(--accent)"]] : []),
    ...(isAdmin
      ? [
          ["admin", "admin", "Yönetici", "KPI ve yönetim paneli", "var(--text)"],
          ["import", "download", "Import Merkezi", "Şablon ve veri aktarımı", "var(--success)"],
          ["mailcenter", "mail", "Mail Merkezi", "Şablonlar ve otomasyon", "var(--accent)"],
        ]
      : []),
  ];

  return (
    <div className="theme-work-page mobile-feature-menu-page" style={{ minHeight: "100%", background: "var(--surface-soft)", padding: "18px 14px 92px", overflow: "auto" }}>
      <div className="unified-page-header mobile-feature-header" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Tüm Özellikler</h2>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Web tarafındaki ana alanlara mobilde de buradan erişebilirsiniz.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        {items.map(([targetView, icon, title, desc, color]) => (
          <button className="mobile-feature-card" key={targetView} onClick={() => onNavigate(targetView)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 18, padding: 14, textAlign: "left", cursor: "pointer", minHeight: 122, boxShadow: "0 8px 22px rgba(15,23,42,.04)" }}>
            <span style={{ width: 38, height: 38, borderRadius: 13, background: color + "16", color, display: "grid", placeItems: "center", marginBottom: 10 }}>
              <Icon name={icon} size={18} />
            </span>
            <b style={{ display: "block", fontSize: 13, color: "var(--text)" }}>{title}</b>
            <span style={{ display: "block", fontSize: 10, color: "var(--muted)", lineHeight: 1.35, marginTop: 4 }}>{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
