import { useState } from "react";
import { Btn, Field, Modal, iStyle } from "./primitives.jsx";

const RISK_STATUSES = ["Açık", "İzleniyor", "Kapatıldı"];
const LEGACY_LEVELS = ["Düşük", "Orta", "Yüksek"];
const SCALE = [
  [1, "Çok düşük"],
  [2, "Düşük"],
  [3, "Orta"],
  [4, "Yüksek"],
  [5, "Çok yüksek"],
];

export const riskScore = (risk) => (Number(risk?.impact) || 0) * (Number(risk?.probability) || 0);
export const riskLevel = (risk) => {
  const score = riskScore(risk);
  if (score >= 16) return "Kritik";
  if (score >= 10) return "Yüksek";
  if (score >= 5) return "Orta";
  return "Düşük";
};
export const riskAction = (risk) => {
  const level = riskLevel(risk);
  if (level === "Kritik") return "Acil azaltma planı, yönetici eskalasyonu ve tarihli aksiyon gerekir.";
  if (level === "Yüksek") return "Azaltma aksiyonu açılmalı, sorumlu ve kontrol tarihi belirlenmeli.";
  if (level === "Orta") return "İzleme planı ve tetikleyici koşullar netleştirilmeli.";
  return "Kabul edilebilir; periyodik izleme yeterli.";
};

const levelColors = {
  Düşük: { bg: "color-mix(in srgb, var(--success) 10%, white 90%)", text: "var(--success)" },
  Orta: { bg: "color-mix(in srgb, var(--warning) 10%, white 90%)", text: "var(--warning)" },
  Yüksek: { bg: "color-mix(in srgb, var(--danger) 9%, white 91%)", text: "var(--danger)" },
  Kritik: { bg: "var(--danger)", text: "#fff" },
};

export function RiskPanel({ risks = [], milestones = [], onAdd, onUpdate, onDelete, canEdit }) {
  const milestoneName = (id) => milestones.find((item) => item.id === id)?.name || "";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Riskler & Engeller</span>
        {canEdit && <Btn small variant="warning" onClick={onAdd}>+ Risk Ekle</Btn>}
      </div>
      {risks.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 0" }}>Risk yok.</div>}
      {risks.map((risk) => {
        const normalized = {
          ...risk,
          impact: risk.impact || (risk.level === "Yüksek" ? 4 : risk.level === "Düşük" ? 2 : 3),
          probability: risk.probability || 3,
        };
        const level = riskLevel(normalized);
        const colors = levelColors[level] || levelColors.Orta;
        return (
          <div key={risk.id} style={{ background: "var(--surface-soft)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1.5px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: 12 }}>{risk.title}</span>
                <span style={{ background: colors.bg, color: colors.text, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{level} · {riskScore(normalized)}</span>
                <span style={{ background: "var(--accent-ink)", color: "var(--accent)", borderRadius: 12, padding: "2px 8px", fontSize: 11 }}>{risk.status || "Açık"}</span>
                {risk.milestoneId && <span style={{ background: "var(--surface-soft)", color: "var(--accent)", borderRadius: 12, padding: "2px 8px", fontSize: 11 }}>{milestoneName(risk.milestoneId)}</span>}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 5 }}>
                Etki {normalized.impact}/5 · Olasılık {normalized.probability}/5
              </div>
              <div style={{ fontSize: 11, color: "var(--text)", marginTop: 5, lineHeight: 1.45 }}>{riskAction(normalized)}</div>
              {risk.note && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{risk.note}</div>}
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <select value={risk.status || "Açık"} onChange={(event) => onUpdate(risk.id, { status: event.target.value })} style={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--border)", padding: "3px 6px" }}>
                  {RISK_STATUSES.map((item) => <option key={item}>{item}</option>)}
                </select>
                <Btn small variant="danger" onClick={() => onDelete(risk.id)}>x</Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RiskModal({ onClose, onSave, milestones = [] }) {
  const [form, setForm] = useState({ title: "", level: "Orta", impact: 3, probability: 3, status: "Açık", milestoneId: "", note: "" });
  const update = (key, value) => setForm((state) => ({ ...state, [key]: value }));
  const preview = { ...form, impact: Number(form.impact), probability: Number(form.probability) };
  return (
    <Modal title="Risk Ekle" onClose={onClose}>
      <Field label="Başlık *"><input style={iStyle} value={form.title} onChange={(event) => update("title", event.target.value)} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Etki">
          <select style={iStyle} value={form.impact} onChange={(event) => update("impact", event.target.value)}>
            {SCALE.map(([value, label]) => <option key={value} value={value}>{value} - {label}</option>)}
          </select>
        </Field>
        <Field label="Olasılık">
          <select style={iStyle} value={form.probability} onChange={(event) => update("probability", event.target.value)}>
            {SCALE.map(([value, label]) => <option key={value} value={value}>{value} - {label}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Durum">
          <select style={iStyle} value={form.status} onChange={(event) => update("status", event.target.value)}>
            {RISK_STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Milestone (opsiyonel)">
          <select style={iStyle} value={form.milestoneId} onChange={(event) => update("milestoneId", event.target.value)}>
            <option value="">- Bağlama -</option>
            {milestones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ background: "var(--surface-soft)", border: "1px solid var(--border)", borderRadius: 10, padding: 11, fontSize: 11, color: "var(--text)", marginBottom: 13 }}>
        <b>{riskLevel(preview)} risk · Skor {riskScore(preview)}</b>
        <div style={{ marginTop: 4 }}>{riskAction(preview)}</div>
      </div>
      <Field label="Not"><textarea style={{ ...iStyle, minHeight: 70, resize: "vertical" }} value={form.note} onChange={(event) => update("note", event.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 7 }}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={() => { if (!form.title.trim()) return; onSave({ ...form, impact: Number(form.impact), probability: Number(form.probability), level: riskLevel(form) }); onClose(); }}>Kaydet</Btn>
      </div>
    </Modal>
  );
}
