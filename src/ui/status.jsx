export const STATUS_COLORS = {
  "Ba\u015flamad\u0131": { bg: "var(--surface-soft)", text: "var(--muted)", dot: "var(--muted)" },
  Bekliyor: { bg: "var(--accent-ink)", text: "var(--accent)", dot: "var(--accent)" },
  "Devam Ediyor": { bg: "color-mix(in srgb, var(--warning) 10%, white 90%)", text: "var(--warning)", dot: "var(--warning)" },
  "Tamamland\u0131": { bg: "color-mix(in srgb, var(--success) 10%, white 90%)", text: "var(--success)", dot: "var(--success)" },
  Engellendi: { bg: "color-mix(in srgb, var(--danger) 9%, white 91%)", text: "var(--danger)", dot: "var(--danger)" },
};

export const PRIORITY_COLORS = {
  "D\u00fc\u015f\u00fck": "var(--muted)",
  Orta: "var(--warning)",
  "Y\u00fcksek": "var(--danger)",
};

export const STATUSES = Object.keys(STATUS_COLORS);
export const PRIORITIES = Object.keys(PRIORITY_COLORS);

export const daysDiff = (date) =>
  !date
    ? 0
    : Math.floor(
        (new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
          86400000,
      );

export const delayLvl = (date, status) => {
  if (!date || status === "Tamamland\u0131") return null;
  const diff = daysDiff(date);
  if (diff <= 0) return null;
  return diff >= 7 ? "critical" : "normal";
};

export function Badge({ label }) {
  const color = STATUS_COLORS[label] || { bg: "var(--accent-ink)", text: "var(--accent)", dot: "var(--accent)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: color.bg,
        color: color.text,
        borderRadius: 20,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color.dot }} />
      {label}
    </span>
  );
}

export function DelayBadge({ dateStr, status }) {
  const level = delayLvl(dateStr, status);
  if (!level) return null;

  return (
    <span
      style={{
        background: level === "critical" ? "color-mix(in srgb, var(--danger) 9%, white 91%)" : "color-mix(in srgb, var(--warning) 10%, white 90%)",
        color: level === "critical" ? "var(--danger)" : "var(--warning)",
        borderRadius: 20,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {level === "critical" ? "Kritik" : "Gecikti"} ({daysDiff(dateStr)}g)
    </span>
  );
}
