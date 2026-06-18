export const STATUS_COLORS = {
  "Ba\u015flamad\u0131": { bg: "#F8FAFC", text: "#94A3B8", dot: "#94A3B8" },
  Bekliyor: { bg: "#F1F5FF", text: "#4A6CF7", dot: "#4A6CF7" },
  "Devam Ediyor": { bg: "#FFF7ED", text: "#EA6C00", dot: "#EA6C00" },
  "Tamamland\u0131": { bg: "#ECFDF5", text: "#059669", dot: "#059669" },
  Engellendi: { bg: "#FFF1F2", text: "#E11D48", dot: "#E11D48" },
};

export const PRIORITY_COLORS = {
  "D\u00fc\u015f\u00fck": "#94A3B8",
  Orta: "#EA6C00",
  "Y\u00fcksek": "#E11D48",
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
  const color = STATUS_COLORS[label] || { bg: "#F1F5FF", text: "#4A6CF7", dot: "#4A6CF7" };
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
        background: level === "critical" ? "#FFF1F2" : "#FFF7ED",
        color: level === "critical" ? "#E11D48" : "#EA6C00",
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
