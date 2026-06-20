export function Avatar({ initials, imageUrl = "", size = 28, color = "#4A6CF7" }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "38%",
        background: "var(--accent-ink, #def5f8)",
        border: "2px solid var(--glass-border, rgb(207 224 227 / 68%))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontWeight: 700,
        color: color || "var(--accent, #0b8a94)",
        flexShrink: 0,
        fontFamily: "var(--font-ui, Manrope, system-ui, sans-serif)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <span>{initials}</span>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </div>
  );
}

export function Icon({ name, size = 16 }) {
  const paths = {
    projects: (
      <>
        <path d="M3 6h7l2 2h9v11H3z" />
        <path d="M3 6V4h7l2 2" />
      </>
    ),
    tasks: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="m8 9 2 2 4-4M8 15h8" />
      </>
    ),
    reports: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2" />
        <path d="M3 20c0-4 2-7 6-7s6 3 6 7M15 14c3 0 5 2 5 6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-5 3-8 8-8s8 3 8 8" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7M10 20h4" />
      </>
    ),
    machines: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h6v6H7zM16 9h2M16 13h2M8 22v-3M17 22v-3" />
      </>
    ),
    gantt: (
      <>
        <path d="M4 6h8M4 12h14M4 18h11" />
        <path d="M2 4v4M2 10v4M2 16v4" />
      </>
    ),
    risk: (
      <>
        <path d="M12 3 2 21h20zM12 9v5M12 18h.01" />
      </>
    ),
    ticket: (
      <>
        <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
        <path d="M12 7v10" />
      </>
    ),
    notes: (
      <>
        <path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    admin: (
      <>
        <path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z" />
        <path d="M8 13h8M9 9h6M10 17h4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6l-.03.05a2 2 0 1 1-3.94 0L10 20a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1l-.05-.03a2 2 0 1 1 0-3.94L4 10a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6l.03-.05a2 2 0 1 1 3.94 0L14 4a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.22.36.22.64 0 1l.6.03a2 2 0 1 1 0 3.94L20 14a1.7 1.7 0 0 0-.6 1z" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.projects}
    </svg>
  );
}

export function Modal({ title, onClose, wide, children }) {
  return (
    <div
      className="modal-scrim"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal-panel"
        style={{
          borderRadius: 22,
          padding: "26px 30px",
          width: "100%",
          maxWidth: wide ? 720 : 500,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text, #112327)" }}>{title}</h3>
          <button aria-label="Kapat" onClick={onClose} style={{ background: "rgb(255 255 255 / 58%)", border: "1px solid rgb(207 224 227 / 72%)", borderRadius: 12, cursor: "pointer", fontSize: 18, color: "var(--muted, #5b6f74)", width: 38, height: 38, display: "grid", placeItems: "center", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 70%)" }}>
            x
          </button>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

export const iStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border, #cfe0e3)",
  fontSize: 14,
  color: "var(--text, #112327)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "var(--surface, #ffffff)",
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 70%)",
};

export const lStyle = { fontSize: 11, fontWeight: 800, color: "var(--muted, #5b6f74)", display: "block", marginBottom: 6, letterSpacing: ".025em" };

export const Field = ({ label, children }) => (
  <div style={{ marginBottom: 13 }}>
    <label style={lStyle}>{label}</label>
    {children}
  </div>
);

export const Btn = ({ children, onClick, variant = "primary", small, style: s, disabled, className = "", title, "aria-label": ariaLabel }) => {
  const variants = {
    primary: { background: "var(--accent, #0b8a94)", color: "#fff", boxShadow: "var(--shadow-soft, 0 18px 40px -26px rgb(17 35 39 / 34%))" },
    secondary: { background: "var(--surface, #ffffff)", color: "var(--text, #112327)", borderColor: "var(--border, #cfe0e3)" },
    danger: { background: "color-mix(in srgb, var(--danger, #b93f33) 10%, white)", color: "var(--danger, #b93f33)" },
    ghost: { background: "transparent", color: "var(--muted, #5b6f74)" },
    warning: { background: "color-mix(in srgb, var(--warning, #bf7a12) 12%, white)", color: "var(--warning, #bf7a12)" },
    success: { background: "color-mix(in srgb, var(--success, #19835c) 11%, white)", color: "var(--success, #19835c)" },
  };

  return (
    <button
      className={`btn-base ${className}`.trim()}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{
        borderRadius: 12,
        border: variant === "ghost" ? "1px solid transparent" : "1px solid var(--border, #cfe0e3)",
        cursor: disabled ? "default" : "pointer",
        fontWeight: 600,
        fontSize: small ? 12 : 13,
        padding: small ? "6px 12px" : "10px 17px",
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
        minHeight: small ? 34 : 42,
        ...variants[variant],
        ...s,
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, style }) => (
  <div className="liquid-card" style={{ borderRadius: 18, padding: 16, ...style }}>{children}</div>
);
