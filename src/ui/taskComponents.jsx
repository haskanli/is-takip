import { useState } from "react";
import { Avatar, Btn, Field, Icon, Modal, iStyle } from "./primitives.jsx";
import { PeopleMultiSelect } from "./formControls.jsx";
import {
  Badge,
  DelayBadge,
  PRIORITIES,
  PRIORITY_COLORS,
  STATUSES,
  delayLvl,
} from "./status.jsx";

const defaultFormatDate = (value) => value || "";
const defaultFormatFullDate = (value) => value || "";
const defaultCreateId = () => Math.random().toString(36).slice(2, 9);
const defaultGetTimestamp = () => new Date().toISOString();
const defaultTodayString = () => new Date().toISOString().slice(0, 10);
const defaultCurrentTimeString = () => new Date().toTimeString().slice(0, 5);
const DEFAULT_WAIT_OPTIONS = ["PM", "Müşteri", "ERP", "Tedarikçi", "Teknik", "Ürün-Teknoloji", "Yönetim", "Diğer"];
const DEFAULT_RESPONSIBILITY_GROUPS = ["Proje Ekibi", "Ürün Ekibi", "Yazılım Ekibi", "Müşteri", "Tedarikçi", "Diğer"];

export function TaskCard({
  task,
  people,
  projectColor,
  onCheck,
  onStatusChange,
  onEdit,
  onDelete,
  onTime,
  onOpen,
  showProject,
  projectName,
  canEdit,
  formatDate = defaultFormatDate,
  formatFullDate = defaultFormatFullDate,
}) {
  const assignee = people.find((person) => person.id === task.assignee);
  const delayLevel = delayLvl(task.dueDate, task.status);
  const isDone = task.status === "Tamamlandı";

  return (
    <div
      className="compact-list-card"
      style={{
        padding: "12px 15px",
        borderColor:
          delayLevel === "critical"
            ? "color-mix(in srgb, var(--danger) 34%, var(--border))"
            : delayLevel === "normal"
              ? "color-mix(in srgb, var(--warning) 34%, var(--border))"
              : "var(--glass-border, #cfe0e3)",
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        opacity: isDone ? 0.72 : 1,
      }}
    >
      {canEdit ? (
        <input
          type="checkbox"
          checked={isDone}
          onChange={(event) => onCheck && onCheck(event.target.checked)}
          style={{ marginTop: 3, width: 15, height: 15, cursor: "pointer", accentColor: "var(--accent, #0b8a94)" }}
        />
      ) : (
        <span
          style={{
            marginTop: 3,
            width: 15,
            height: 15,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
          }}
        >
          {isDone ? "✓" : "○"}
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={onOpen}
            style={{
              border: 0,
              background: "transparent",
              padding: 0,
              fontWeight: 600,
              fontSize: 13,
              textAlign: "left",
              cursor: onOpen ? "pointer" : "default",
              textDecoration: isDone ? "line-through" : "none",
              color: isDone ? "var(--muted, #5b6f74)" : "var(--text, #112327)",
            }}
          >
            {task.title}
          </button>
          <Badge label={task.status} />
          <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_COLORS[task.priority] }}>
            +{task.priority}
          </span>
          <DelayBadge dateStr={task.dueDate} status={task.status} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
          {assignee && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Avatar
                initials={assignee.avatar}
                imageUrl={assignee.avatarUrl}
                size={17}
                color={projectColor || "var(--accent, #0b8a94)"}
              />
              <span style={{ fontSize: 11, color: "var(--muted, #5b6f74)" }}>{assignee.name}</span>
            </div>
          )}
          {task.startDate && (
            <span style={{ fontSize: 11, color: "var(--muted, #5b6f74)" }}>
              Başl: {formatDate(task.startDate)}
              {task.startTime ? ` ${task.startTime}` : ""}
            </span>
          )}
          {task.dueDate && (
            <span style={{ fontSize: 11, color: delayLevel ? "var(--danger, #b93f33)" : "var(--muted, #5b6f74)" }}>
              {task.startDate ? "Bit:" : "Termin:"} {formatDate(task.dueDate)}
              {task.dueTime ? ` ${task.dueTime}` : ""}
            </span>
          )}
          {(task.timeEntries || []).length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent, #0b8a94)",
                fontWeight: 600,
                background: "var(--accent-ink, #def5f8)",
                borderRadius: 6,
                padding: "1px 6px",
              }}
            >
              {(task.timeEntries || []).reduce((total, entry) => total + (parseFloat(entry.hours) || 0), 0)} saat
            </span>
          )}
          {task.estimatedHours && (
            <span
              style={{
                fontSize: 11,
                color: "var(--success, #19835c)",
                fontWeight: 600,
                background: "rgb(25 131 92 / 10%)",
                borderRadius: 6,
                padding: "1px 6px",
              }}
            >
              Plan: {task.estimatedHours} sa
            </span>
          )}
          {task.responsibilityGroup && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent, #0b8a94)",
                fontWeight: 700,
                background: "var(--accent-ink, #def5f8)",
                borderRadius: 6,
                padding: "1px 6px",
              }}
            >
              {task.responsibilityGroup}
            </span>
          )}
          {task.waitSource && (
            <span style={{ fontSize: 11, color: "var(--warning, #bf7a12)", fontWeight: 600 }}>Bekliyor: {task.waitSource}</span>
          )}
          {task.waitReason && ["Bekliyor", "Engellendi"].includes(task.status) && (
            <span
              style={{
                fontSize: 11,
                color: "var(--warning, #bf7a12)",
                background: "rgb(191 122 18 / 11%)",
                borderRadius: 6,
                padding: "1px 6px",
              }}
            >
              {task.waitReason}
            </span>
          )}
          {task.link &&
            (() => {
              const jiraMatch = String(task.link).match(/([A-Z][A-Z0-9]+-[0-9]+)/);
              return (
                <a
                  href={task.link}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    fontSize: 11,
                    color: "var(--accent, #0b8a94)",
                    background: "var(--accent-ink, #def5f8)",
                    borderRadius: 6,
                    padding: "1px 7px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {jiraMatch ? jiraMatch[1] : "Jira"}
                </a>
              );
            })()}
          {showProject && projectName && (
            <span style={{ fontSize: 11, color: "var(--accent, #0b8a94)", background: "var(--accent-ink, #def5f8)", borderRadius: 6, padding: "1px 6px" }}>
              {projectName}
            </span>
          )}
          {task.notes && <span className="text-wrap-safe" style={{ fontSize: 11, color: "var(--muted, #5b6f74)", fontStyle: "italic" }}>"{task.notes}"</span>}
        </div>

        {(task.waitingHistory || []).length > 0 && (
          <details style={{ marginTop: 7 }}>
            <summary style={{ fontSize: 10, color: "var(--muted, #5b6f74)", cursor: "pointer", fontWeight: 700 }}>
              Bekleme geçmişi ({task.waitingHistory.length})
            </summary>
            <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
              {task.waitingHistory
                .slice()
                .reverse()
                .map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      fontSize: 10,
                      color: "var(--muted, #5b6f74)",
                      background: "rgb(246 250 251 / 76%)",
                      borderRadius: 7,
                      padding: "6px 8px",
                    }}
                  >
                    <b>{entry.source}</b> · {entry.reason} · {formatFullDate(entry.startAt)} -{" "}
                    {entry.endAt ? formatFullDate(entry.endAt) : "Devam ediyor"}
                  </div>
                ))}
            </div>
          </details>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {onStatusChange && (
          <select
            onClick={(event) => event.stopPropagation()}
            value={task.status || "Bekliyor"}
            onChange={(event) => onStatusChange(event.target.value)}
            style={{ ...iStyle, width: 145, fontSize: 11, background: "rgb(246 250 251 / 76%)", padding: "5px 8px" }}
          >
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        )}
        {onTime && (
          <Btn small variant="ghost" onClick={onTime} style={{ color: "var(--accent, #0b8a94)" }}>
            Efor
          </Btn>
        )}
        {canEdit && onEdit && (
          <Btn small variant="ghost" onClick={onEdit} style={{ display: "inline-flex", alignItems: "center", padding: "5px 7px" }}>
            <Icon name="edit" size={15} />
          </Btn>
        )}
        {canEdit && onDelete && (
          <Btn small variant="danger" onClick={onDelete}>
            x
          </Btn>
        )}
      </div>
    </div>
  );
}

export function TaskModal({
  title,
  initial,
  onClose,
  onSave,
  people,
  waitOptions = DEFAULT_WAIT_OPTIONS,
  responsibilityGroups = DEFAULT_RESPONSIBILITY_GROUPS,
  milestone = null,
}) {
  const [form, setForm] = useState({
    title: "",
    status: "Bekliyor",
    priority: "Orta",
    assignee: "",
    responsibilityGroup: "Proje Ekibi",
    startDate: "",
    dueDate: "",
    estimatedHours: "",
    notes: "",
    waitSource: "",
    waitReason: "",
    link: "",
    ...initial,
  });
  const update = (key, value) => setForm((state) => ({ ...state, [key]: value }));
  const exceedsMilestoneDue = Boolean(form.dueDate && milestone?.dueDate && new Date(form.dueDate) > new Date(milestone.dueDate));

  const save = () => {
    if (!form.title.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Görev Başlığı *">
        <input style={iStyle} value={form.title} onChange={(event) => update("title", event.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Durum">
          <select style={iStyle} value={form.status} onChange={(event) => update("status", event.target.value)}>
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Öncelik">
          <select style={iStyle} value={form.priority} onChange={(event) => update("priority", event.target.value)}>
            {PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Sorumlu Kişi">
          <select style={iStyle} value={form.assignee} onChange={(event) => update("assignee", event.target.value)}>
            <option value="">- Seç -</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sorumluluk Grubu">
          <select
            style={iStyle}
            value={form.responsibilityGroup}
            onChange={(event) => update("responsibilityGroup", event.target.value)}
          >
            {responsibilityGroups.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Planlanan Efor (Saat)">
        <input
          type="number"
          min="0"
          step="0.5"
          style={iStyle}
          value={form.estimatedHours || ""}
          onChange={(event) => update("estimatedHours", event.target.value)}
          placeholder="Örn. 8"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Hedef Başlangıç">
          <input type="date" style={iStyle} value={form.startDate || ""} onChange={(event) => update("startDate", event.target.value)} />
        </Field>
        <Field label="Başlangıç Saati">
          <input type="time" style={iStyle} value={form.startTime || ""} onChange={(event) => update("startTime", event.target.value)} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Hedef Bitiş">
          <input type="date" style={iStyle} value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
        </Field>
        <Field label="Hedef Saat">
          <input type="time" style={iStyle} value={form.dueTime || ""} onChange={(event) => update("dueTime", event.target.value)} />
        </Field>
      </div>
      {exceedsMilestoneDue && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, marginBottom: 13 }}>
          Uyarı: görev termini milestone termininden ileri. Milestone termini: {milestone.dueDate}
        </div>
      )}      <Field label="Bekleme Kaynağı">
        <select style={iStyle} value={form.waitSource} onChange={(event) => update("waitSource", event.target.value)}>
          <option value="">- Yok -</option>
          {waitOptions.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </select>
      </Field>
      {["Bekliyor", "Engellendi"].includes(form.status) && (
        <Field label="Bekleme Sebebi">
          <textarea
            style={{ ...iStyle, minHeight: 70, resize: "vertical" }}
            value={form.waitReason || ""}
            onChange={(event) => update("waitReason", event.target.value)}
            placeholder="Neyi, kimden ve hangi tarihe kadar bekliyoruz?"
          />
        </Field>
      )}
      <Field label="Notlar">
        <input style={iStyle} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
      </Field>
      <Field label="Jira Linki">
        <input
          style={iStyle}
          value={form.link || ""}
          onChange={(event) => update("link", event.target.value)}
          placeholder="https://sirket.atlassian.net/browse/PROJ-123"
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 7 }}>
        <Btn variant="ghost" onClick={onClose}>
          İptal
        </Btn>
        <Btn onClick={save}>Kaydet</Btn>
      </div>
    </Modal>
  );
}

export function PersonalTaskModal({
  title,
  initial,
  onClose,
  onSave,
  people,
  isAdmin,
  currentUser,
  projects = [],
  waitOptions = DEFAULT_WAIT_OPTIONS,
  todayString = defaultTodayString,
  currentTimeString = defaultCurrentTimeString,
  lockStartAt = false,
}) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    title: "",
    projectId: "",
    status: "Bekliyor",
    priority: "Orta",
    assignee: isAdmin ? "" : currentUser.id,
    assigneeIds: initial?.assignee ? [initial.assignee] : [],
    supportAssigneeIds: [],
    startDate: todayString(),
    startTime: currentTimeString(),
    dueDate: todayString(),
    dueTime: currentTimeString(),
    estimatedHours: "",
    notes: "",
    waitSource: "",
    recurring: false,
    frequency: "weekly",
    nextRunDate: "",
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((state) => ({ ...state, [key]: value }));

  const save = async () => {
    if (!form.title.trim()) return;
    if (isAdmin && !editing && !form.assigneeIds.length) {
      setError("En az bir kişi seçmelisiniz.");
      return;
    }
    if (form.recurring && !form.nextRunDate) {
      setError("Periyodik görev için ilk tekrar tarihini seçmelisiniz.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        recurrence: {
          enabled: !editing && form.recurring,
          frequency: form.frequency,
          nextRunDate: form.nextRunDate,
        },
      });
      onClose();
    } catch (errorValue) {
      setError(errorValue.message || "Görev kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Görev Başlığı *">
        <input style={iStyle} value={form.title} onChange={(event) => update("title", event.target.value)} />
      </Field>
      <Field label="İlişkili Proje">
        <select style={iStyle} value={form.projectId || ""} onChange={(event) => update("projectId", event.target.value)}>
          <option value="">- Projesiz / Genel iş -</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Durum">
          <select style={iStyle} value={form.status} onChange={(event) => update("status", event.target.value)}>
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Öncelik">
          <select style={iStyle} value={form.priority} onChange={(event) => update("priority", event.target.value)}>
            {PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </Field>
      </div>

      {isAdmin ? (
        editing ? (
          <Field label="Atanan Kişi">
            <select style={iStyle} value={form.assignee} onChange={(event) => update("assignee", event.target.value)}>
              <option value="">- Seç -</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Atanacak Kişiler *">
            <PeopleMultiSelect people={people} value={form.assigneeIds} onChange={(value) => update("assigneeIds", value)} />
          </Field>
        )
      ) : (
        <div
          style={{
            background: "#F1F5FF",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 13,
            fontSize: 12,
            color: "#4A6CF7",
          }}
        >
          Görev size atanacak: <b>{currentUser.name}</b>
        </div>
      )}

      {isAdmin && !editing && (
        <Field label="Destek Sorumluları">
          <PeopleMultiSelect
            people={people.filter((person) => !form.assigneeIds.includes(person.id))}
            value={form.supportAssigneeIds}
            onChange={(value) => update("supportAssigneeIds", value)}
          />
        </Field>
      )}

      <Field label="Planlanan Efor (Saat)">
        <input
          type="number"
          min="0"
          step="0.5"
          style={iStyle}
          value={form.estimatedHours || ""}
          onChange={(event) => update("estimatedHours", event.target.value)}
          placeholder="Örn. 4"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Hedef Başlangıç">
          <input type="date" disabled={lockStartAt && !editing} style={{ ...iStyle, background: lockStartAt && !editing ? "#F1F5F9" : iStyle.background }} value={form.startDate || ""} onChange={(event) => update("startDate", event.target.value)} />
        </Field>
        <Field label="Başlangıç Saati">
          <input type="time" disabled={lockStartAt && !editing} style={{ ...iStyle, background: lockStartAt && !editing ? "#F1F5F9" : iStyle.background }} value={form.startTime || ""} onChange={(event) => update("startTime", event.target.value)} />
        </Field>
      </div>
      {lockStartAt && !editing && <div style={{ fontSize: 10, color: "#64748B", margin: "-6px 0 10px" }}>Yönetici atamalarında başlangıç tarih ve saati atama anı olarak kilitlenir.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="Hedef Bitiş">
          <input type="date" style={iStyle} value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
        </Field>
        <Field label="Hedef Saat">
          <input type="time" style={iStyle} value={form.dueTime || ""} onChange={(event) => update("dueTime", event.target.value)} />
        </Field>
      </div>
      <Field label="Bekleme Kaynağı">
        <select style={iStyle} value={form.waitSource} onChange={(event) => update("waitSource", event.target.value)}>
          <option value="">- Yok -</option>
          {waitOptions.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </select>
      </Field>
      <Field label="Notlar">
        <input style={iStyle} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
      </Field>

      {!editing && (
        <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: 12, marginBottom: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <input type="checkbox" checked={form.recurring} onChange={(event) => update("recurring", event.target.checked)} /> Periyodik
            takip görevi
          </label>
          {form.recurring && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 11 }}>
              <Field label="Sıklık">
                <select style={iStyle} value={form.frequency} onChange={(event) => update("frequency", event.target.value)}>
                  <option value="daily">Her gün</option>
                  <option value="weekly">Her hafta</option>
                  <option value="monthly">Her ay</option>
                </select>
              </Field>
              <Field label="İlk Tekrar Tarihi">
                <input type="date" style={iStyle} value={form.nextRunDate} onChange={(event) => update("nextRunDate", event.target.value)} />
              </Field>
            </div>
          )}
        </div>
      )}

      {error && <div style={{ color: "#DC2626", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 7 }}>
        <Btn variant="ghost" onClick={onClose}>
          İptal
        </Btn>
        <Btn disabled={saving} onClick={save}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Btn>
      </div>
    </Modal>
  );
}

export function TaskDetailModal({
  task,
  people,
  currentUser,
  onClose,
  onUpdate,
  createId = defaultCreateId,
  getTimestamp = defaultGetTimestamp,
  formatDate = defaultFormatDate,
}) {
  const [comment, setComment] = useState("");
  const assignee = people.find((person) => person.id === task.assignee);
  const comments = task.comments || [];
  const linkedProjectName = task.projectName || task.project?.name || "";

  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    onUpdate({
      comments: [
        ...comments,
        {
          id: createId(),
          text,
          userId: currentUser.id,
          userName: currentUser.name,
          ts: getTimestamp(),
        },
      ],
    });
    setComment("");
  };

  return (
    <Modal title="Görev Detayı" onClose={onClose} wide>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 15, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <h2 style={{ fontSize: 18, margin: "0 0 5px", lineHeight: 1.25, wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {task.title}
          </h2>
          <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {assignee?.name || "Atanmamış"}
            {linkedProjectName ? ` · ${linkedProjectName}` : ""} · Termin: {formatDate(task.dueDate) || "Belirtilmedi"}
            {task.dueTime ? ` ${task.dueTime}` : ""}
            {task.firstSeenAt ? ` · İlk bakış: ${new Date(task.firstSeenAt).toLocaleString("tr-TR")}` : ""}
          </div>
        </div>
        {task.assignmentRole && (
          <span
            style={{
              background: task.assignmentRole === "Destek Sorumlusu" ? "#F0F9FF" : "#EEF2FF",
              color: task.assignmentRole === "Destek Sorumlusu" ? "#0369A1" : "#4338CA",
              borderRadius: 999,
              padding: "7px 10px",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            {task.assignmentRole}
          </span>
        )}
        <select style={{ ...iStyle, width: 180 }} value={task.status || "Bekliyor"} onChange={(event) => onUpdate({ status: event.target.value })}>
          {STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </div>

      {task.notes && (
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 10,
            padding: 13,
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 16,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {task.notes}
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 9 }}>Yorumlar ({comments.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto", marginBottom: 12 }}>
        {comments.map((item) => (
          <div key={item.id} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: "#64748B", marginBottom: 4, flexWrap: "wrap" }}>
              <b style={{ color: "#334155", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                {item.userName || people.find((person) => person.id === item.userId)?.name || "Kullanıcı"}
              </b>
              <span>{item.ts ? new Date(item.ts).toLocaleString("tr-TR") : ""}</span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "anywhere" }}>{item.text}</div>
          </div>
        ))}
        {!comments.length && <div style={{ fontSize: 12, color: "#94A3B8" }}>Henüz yorum eklenmedi.</div>}
      </div>

      <textarea
        style={{ ...iStyle, minHeight: 80, resize: "vertical" }}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Bu görevle ilgili yorumunuzu yazın..."
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 9 }}>
        <Btn variant="ghost" onClick={onClose}>
          Kapat
        </Btn>
        <Btn onClick={addComment}>Yorum Ekle</Btn>
      </div>
    </Modal>
  );
}

export function TimeLogModal({
  task,
  currentUser,
  onClose,
  onSave,
  createId = defaultCreateId,
  getTimestamp = defaultGetTimestamp,
  formatDate = defaultFormatDate,
}) {
  const entries = task.timeEntries || [];
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const total = entries.reduce((sum, entry) => sum + (parseFloat(entry.hours) || 0), 0);
  const planned = parseFloat(task.estimatedHours) || 0;

  const add = () => {
    const parsedHours = parseFloat(hours);
    if (!parsedHours || parsedHours <= 0) {
      alert("Geçerli saat girin.");
      return;
    }
    onSave([
      ...entries,
      {
        id: createId(),
        hours: parsedHours,
        date,
        note,
        user: currentUser.name,
        userId: currentUser.id,
        ts: getTimestamp(),
      },
    ]);
    setHours("");
    setNote("");
  };

  const remove = (id) => onSave(entries.filter((entry) => entry.id !== id));

  return (
    <Modal title={`Süre Girişi — ${task.title}`} onClose={onClose} wide>
      <div
        style={{
          background: "#F5F3FF",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>
          Toplam Harcanan{planned ? ` / Planlanan ${planned} saat` : ""}
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: planned && total > planned ? "#E11D48" : "#7C3AED" }}>
          {total} saat
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10, marginBottom: 10 }}>
        <Field label="Saat *">
          <input
            type="number"
            step="0.5"
            min="0"
            style={iStyle}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            placeholder="2.5"
          />
        </Field>
        <Field label="Tarih">
          <input type="date" style={iStyle} value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>

      <Field label="Açıklama">
        <input
          style={iStyle}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ne yapıldı?"
        />
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <Btn onClick={add}>+ Süre Ekle</Btn>
      </div>

      {entries.length > 0 && (
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 11,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Kayıtlar ({entries.length})
          </div>
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 13px",
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1.5px solid #E2E8F0",
                  marginBottom: 5,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 14, color: "#7C3AED", minWidth: 55 }}>{entry.hours} sa</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#1E293B" }}>{entry.note || "—"}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>
                    {entry.user} · {formatDate(entry.date)}
                  </div>
                </div>
                <button
                  onClick={() => remove(entry.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 14 }}
                >
                  x
                </button>
              </div>
            ))}
        </div>
      )}
    </Modal>
  );
}
