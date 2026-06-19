import { useMemo, useState } from "react";
import { Avatar, Btn, Field, Icon, iStyle } from "./primitives.jsx";
import { PeopleMultiSelect } from "./formControls.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "-";
const datetimeLocalValue = (date = new Date(Date.now() + 60 * 60 * 1000)) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const localToIso = (value) => (value ? new Date(value).toISOString() : "");

const reminderStatus = (reminder) => {
  if (reminder.status === "sent") return ["Gönderildi", "#059669", "#ECFDF5"];
  if (reminder.status === "failed") return ["Hata", "#E11D48", "#FFF1F2"];
  if (reminder.status === "cancelled") return ["İptal", "#64748B", "#F1F5F9"];
  if (reminder.status === "skipped") return ["Atlandı", "#EA6C00", "#FFF7ED"];
  if (reminder.scheduledAt && new Date(reminder.scheduledAt) < new Date()) return ["Bekleyen gönderim", "#EA6C00", "#FFF7ED"];
  return ["Planlandı", "#4A6CF7", "#EEF2FF"];
};

const taskKey = (task) => [task.source, task.projectId || "", task.milestoneId || "", task.id].join(":");
const reminderTaskRefs = (reminder) =>
  Array.isArray(reminder.taskRefs)
    ? reminder.taskRefs
    : Array.isArray(reminder.tasks)
      ? reminder.tasks
      : [];

const selectedTaskRefs = (options, selectedKeys) =>
  options
    .filter((task) => selectedKeys.includes(taskKey(task)))
    .map((task) => ({
      source: task.source,
      taskId: task.id,
      projectId: task.projectId || "",
      milestoneId: task.milestoneId || "",
    }));

export function RemindersPage({ state, setState, currentUser, isAdmin }) {
  const people = (state.people || []).filter((person) => person.active !== false && person.userType !== "customer");
  const visiblePeople = isAdmin ? people : people.filter((person) => person.id === currentUser.id);
  const taskOptions = useMemo(() => {
    const personal = (state.personalTasks || [])
      .filter((task) => isAdmin || task.assignee === currentUser.id || task.createdBy === currentUser.id)
      .map((task) => ({
        ...task,
        source: "personal",
        projectName: state.projects?.find((project) => project.id === task.projectId)?.name || "Genel Görev",
      }));
    const projectTasks = (state.projects || []).flatMap((project) =>
      (project.milestones || []).flatMap((milestone) =>
        (milestone.tasks || [])
          .filter((task) => isAdmin || task.assignee === currentUser.id)
          .map((task) => ({
            ...task,
            source: "project",
            projectId: project.id,
            projectName: project.name,
            milestoneId: milestone.id,
            milestoneName: milestone.name,
          })),
      ),
    );
    return [...personal, ...projectTasks].sort((a, b) =>
      `${a.dueDate || "9999"}-${a.title || ""}`.localeCompare(`${b.dueDate || "9999"}-${b.title || ""}`, "tr"),
    );
  }, [state.personalTasks, state.projects, currentUser.id, isAdmin]);

  const [form, setForm] = useState({
    title: "",
    note: "",
    scheduledAt: datetimeLocalValue(),
    recipientIds: [currentUser.id],
    taskKeys: [],
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const linkedTasks = taskOptions.filter((task) => form.taskKeys.includes(taskKey(task)));
  const suggestedRecipients = [
    ...new Set([
      ...form.recipientIds,
      ...linkedTasks.map((task) => task.assignee).filter(Boolean),
    ]),
  ];
  const visibleReminders = (state.reminders || [])
    .filter((reminder) => isAdmin || reminder.createdBy === currentUser.id || (reminder.recipientIds || []).includes(currentUser.id))
    .sort((a, b) => String(b.scheduledAt || "").localeCompare(String(a.scheduledAt || "")));

  const save = () => {
    const title = form.title.trim() || (linkedTasks.length ? "Görev hatırlatması" : "Kişisel hatırlatma");
    const reminder = {
      id: uid(),
      title,
      note: form.note.trim(),
      scheduledAt: localToIso(form.scheduledAt),
      recipientIds: suggestedRecipients,
      taskRefs: selectedTaskRefs(taskOptions, form.taskKeys),
      status: "scheduled",
      createdAt: now(),
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      deliveryLog: [],
    };
    setState((current) => ({
      ...current,
      reminders: [reminder, ...(current.reminders || [])],
      notifications: [
        {
          id: uid(),
          ts: now(),
          userId: currentUser.id,
          msg: `Hatırlatıcı planlandı: ${title}`,
          type: "reminder_created",
          reminderId: reminder.id,
          read: false,
        },
        ...(current.notifications || []),
      ],
    }));
    setForm({
      title: "",
      note: "",
      scheduledAt: datetimeLocalValue(),
      recipientIds: [currentUser.id],
      taskKeys: [],
    });
  };
  const updateReminder = (id, patch) =>
    setState((current) => ({
      ...current,
      reminders: (current.reminders || []).map((reminder) =>
        reminder.id === id ? { ...reminder, ...patch, updatedAt: now() } : reminder,
      ),
    }));
  const removeReminder = (id) =>
    setState((current) => ({
      ...current,
      reminders: (current.reminders || []).filter((reminder) => reminder.id !== id),
    }));

  return (
    <div className="theme-work-page reminders-page">
      <div className="theme-page-heading reminders-hero">
        <div>
          <h2 style={{ margin: 0, fontSize: 22, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="bell" size={22} /> Hatırlatıcılar
          </h2>
          <p style={{ margin: "5px 0 0", color: "#64748B", fontSize: 13 }}>
            Kişisel not, görev veya ekip işi için zamanlı Slack bildirimi planlayın.
          </p>
        </div>
        <span className="ui-chip ui-chip-accent" style={{ borderRadius: 999, padding: "7px 11px", fontSize: 11, fontWeight: 900 }}>
          {visibleReminders.filter((item) => !["sent", "cancelled"].includes(item.status)).length} aktif
        </span>
      </div>

      <div className="reminders-layout">
        <section className="reminders-form">
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>Yeni Hatırlatıcı</div>
          <Field label="Başlık">
            <input style={iStyle} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Örn. Test sonucunu kontrol et" />
          </Field>
          <Field label="Planlanan zaman">
            <input type="datetime-local" className="reminder-datetime-input" style={iStyle} value={form.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} />
          </Field>
          <Field label="Alıcılar">
            <PeopleMultiSelect people={visiblePeople} value={suggestedRecipients} onChange={(value) => update("recipientIds", value)} />
            {linkedTasks.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#64748B" }}>
                Görev sorumluları alıcı listesine otomatik eklenir.
              </div>
            )}
          </Field>
          <Field label="Bağlı görevler (opsiyonel)">
            <div className="reminder-task-list">
              {taskOptions.map((task) => {
                const key = taskKey(task);
                return (
                  <label key={key} className="reminder-task-option">
                    <input
                      type="checkbox"
                      checked={form.taskKeys.includes(key)}
                      onChange={(event) => update("taskKeys", event.target.checked ? [...form.taskKeys, key] : form.taskKeys.filter((item) => item !== key))}
                    />
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</b>
                      <small style={{ color: "#64748B" }}>{task.projectName}{task.dueDate ? ` · Termin ${fmtDateTime(task.dueDate)}` : ""}</small>
                    </span>
                  </label>
                );
              })}
              {!taskOptions.length && <div style={{ fontSize: 11, color: "#94A3B8", padding: 10 }}>Seçilebilir görev yok.</div>}
            </div>
          </Field>
          <Field label="Not">
            <textarea style={{ ...iStyle, minHeight: 95, resize: "vertical" }} value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="Slack mesajında görünecek kısa not" />
          </Field>
          <Btn disabled={!form.scheduledAt || (!form.title.trim() && !form.note.trim() && !form.taskKeys.length)} onClick={save} style={{ width: "100%" }}>
            Hatırlatıcıyı Planla
          </Btn>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          {visibleReminders.map((reminder) => {
            const [label, color, bg] = reminderStatus(reminder);
            const recipientNames = (reminder.recipientIds || [])
              .map((id) => state.people?.find((person) => person.id === id))
              .filter(Boolean);
            const tasks = reminderTaskRefs(reminder)
              .map((ref) => taskOptions.find((task) => task.id === (ref.taskId || ref.id) && task.projectId === (ref.projectId || task.projectId)))
              .filter(Boolean);
            const canModify = isAdmin || reminder.createdBy === currentUser.id;
            return (
              <article key={reminder.id} className="reminder-card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, background: bg, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="bell" size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <b style={{ fontSize: 14, color: "#172033", overflowWrap: "anywhere" }}>{reminder.title}</b>
                      <span style={{ background: bg, color, borderRadius: 999, padding: "3px 8px", fontSize: 9, fontWeight: 900 }}>{label}</span>
                    </div>
                    <div style={{ color: "#64748B", fontSize: 11, marginTop: 4 }}>
                      {fmtDateTime(reminder.scheduledAt)} · Oluşturan: {reminder.createdByName || "-"}
                    </div>
                    {reminder.note && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#334155", lineHeight: 1.45, overflowWrap: "anywhere" }}>{reminder.note}</p>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
                      {recipientNames.map((person) => (
                        <span key={person.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 750 }}>
                          <Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={18} /> {person.name}
                        </span>
                      ))}
                    </div>
                    {tasks.length > 0 && (
                      <div style={{ marginTop: 9, display: "grid", gap: 5 }}>
                        {tasks.map((task) => (
                          <div key={taskKey(task)} style={{ background: "#F8FAFC", borderRadius: 9, padding: "7px 9px", fontSize: 11, color: "#334155" }}>
                            <b>{task.title}</b> <span style={{ color: "#64748B" }}>· {task.projectName || "Genel Görev"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(reminder.deliveryLog || []).length > 0 && (
                      <details style={{ marginTop: 9 }}>
                        <summary style={{ cursor: "pointer", fontSize: 10, color: "#64748B", fontWeight: 800 }}>Gönderim geçmişi</summary>
                        <div style={{ display: "grid", gap: 5, marginTop: 7 }}>
                          {(reminder.deliveryLog || []).slice(0, 3).map((entry) => (
                            <div key={entry.id} style={{ fontSize: 10, color: "#64748B", background: "#F8FAFC", borderRadius: 8, padding: 8 }}>
                              <b>{fmtDateTime(entry.at)}</b> · {(entry.delivery || []).filter((item) => item.sent).length} başarılı · {(entry.delivery || []).filter((item) => item.error || item.skipped).length} atlandı/hata
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  {canModify && (
                    <div className="reminder-actions">
                      {!["sent", "cancelled"].includes(reminder.status) && <Btn small variant="warning" onClick={() => updateReminder(reminder.id, { status: "cancelled" })}>İptal</Btn>}
                      <Btn small variant="danger" onClick={() => removeReminder(reminder.id)}>Sil</Btn>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {!visibleReminders.length && (
            <div className="reminders-empty" style={{ padding: 36, color: "var(--muted)", textAlign: "center" }}>
              Henüz hatırlatıcı yok.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
