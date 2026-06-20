import { useState } from "react";
import { fieldPlanHours } from "../domain/projectHelpers.js";
import { Btn, Field, Icon, iStyle } from "./primitives.jsx";
import { FieldVisitModal } from "./fieldOperationsComponents.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const DEFAULT_ACTION_TAGS = [
  "Toplantı",
  "Telefon / Görüşme",
  "Yazışma",
  "Sistem Kontrolü",
  "Saha Ziyareti",
  "Takip",
  "Karar",
  "Bilgilendirme",
  "Diğer",
];

function actionTone(item) {
  if (item.source === "field_visit") return item.completed ? "success" : "accent";
  if (item.source === "lesson") return "warning";
  if (item.tag === "Karar") return "success";
  if (item.tag === "Takip") return "warning";
  return "accent";
}

function actionLabel(item) {
  if (item.source === "field_visit") {
    if (item.plan?.workType === "remote") return item.completed ? "UZAKTAN ÇALIŞMA" : "UZAKTAN PLAN";
    return item.completed ? "SAHA ZİYARETİ" : "SAHA PLANI";
  }
  return (item.tag || "Diğer").toLocaleUpperCase("tr-TR");
}

export function ProjectActionsPanel({ project, currentUser, state, setState, isAdmin, canManage }) {
  const actions = ((state.projectActions || {})[project.id]) || [];
  const actionTags = project.actionTags?.length ? project.actionTags : DEFAULT_ACTION_TAGS;
  const personalTodos = (((state.userNotes || {})[currentUser.id]?.todos) || []).filter((todo) => todo.projectId === project.id && !todo.done && !todo.actionId);
  const [visitPlan, setVisitPlan] = useState(null);
  const [text, setText] = useState("");
  const [effortHours, setEffortHours] = useState("");
  const [actionAt, setActionAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedTag, setSelectedTag] = useState(actionTags[0] || "Diğer");
  const [newTag, setNewTag] = useState("");
  const [todoEfforts, setTodoEfforts] = useState({});
  const [showActionForm, setShowActionForm] = useState(false);

  const fieldActions = (state.fieldPlans || [])
    .filter((plan) => plan.projectId === project.id)
    .map((plan) => {
      const person = state.people.find((item) => item.id === plan.userId);
      const completed = plan.status === "completed" || plan.completedAt;
      const time = `${plan.actualStartTime || plan.startTime || ""} - ${plan.actualEndTime || plan.endTime || ""}`;
      const workLabel = plan.workType === "remote" ? "Uzaktan çalışma" : "Saha ziyareti";
      return {
        id: `field-${plan.id}`,
        source: "field_visit",
        tag: plan.workType === "remote" ? "Uzaktan Çalışma" : "Saha Ziyareti",
        authorId: plan.userId,
        authorName: person?.name || "Kullanıcı",
        actionAt: `${plan.date}T${plan.actualStartTime || plan.startTime || "09:00"}:00`,
        text: completed
          ? `${workLabel} gerçekleştirildi (${time}, ${fieldPlanHours(plan)} saat efor).\n${plan.visitNotes || "Çalışma notu girilmedi."}`
          : `${workLabel} planlandı (${time}).${plan.note ? `\n${plan.note}` : ""}`,
        completed,
        plan,
      };
    });

  const lessonActions = (project.lessonsLearned || []).map((item) => ({
    id: `lesson-${item.id}`,
    source: "lesson",
    tag: "Öğrenilmiş Ders",
    authorId: item.authorId,
    authorName: item.authorName || "Kullanıcı",
    actionAt: item.createdAt,
    createdAt: item.createdAt,
    text: [item.title, item.lesson, item.prevention ? `Önleyici aksiyon: ${item.prevention}` : ""].filter(Boolean).join("\n"),
  }));

  const saveActions = (next) => setState((s) => ({ ...s, projectActions: { ...(s.projectActions || {}), [project.id]: next } }));
  const saveTags = (next) => setState((s) => ({ ...s, projects: s.projects.map((item) => (item.id === project.id ? { ...item, actionTags: next } : item)) }));

  const resetForm = () => {
    setText("");
    setEffortHours("");
    setActionAt(new Date().toISOString().slice(0, 16));
    setEditingId(null);
  };

  const addTag = () => {
    const value = newTag.trim();
    if (!value || actionTags.some((tag) => tag.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR"))) return;
    saveTags([...actionTags, value]);
    setSelectedTag(value);
    setNewTag("");
  };

  const submit = () => {
    if (!text.trim()) return;
    const actionDate = new Date(actionAt);
    const actionIso = Number.isNaN(actionDate.getTime()) ? now() : actionDate.toISOString();
    const payload = {
      tag: selectedTag,
      text: text.trim(),
      effortHours: parseFloat(effortHours) || 0,
      actionAt: actionIso,
    };
    if (editingId) {
      saveActions(actions.map((item) => (item.id === editingId ? { ...item, ...payload, updatedAt: now(), updatedBy: currentUser.name } : item)));
    } else {
      saveActions([{ id: uid(), ...payload, createdAt: now(), authorId: currentUser.id, authorName: currentUser.name }, ...actions]);
    }
    resetForm();
    setShowActionForm(false);
  };

  const edit = (item) => {
    setEditingId(item.id);
    setSelectedTag(item.tag || "Diğer");
    setText(item.text);
    setEffortHours(item.effortHours || "");
    setActionAt(new Date(item.actionAt || item.createdAt).toISOString().slice(0, 16));
    setShowActionForm(true);
  };

  const remove = (id) => saveActions(actions.filter((item) => item.id !== id));

  const sendTodoToActions = (todo) => {
    const action = {
      id: uid(),
      tag: "Takip",
      text: todo.action || todo.text,
      effortHours: parseFloat(todoEfforts[todo.id]) || 0,
      actionAt: now(),
      createdAt: now(),
      authorId: currentUser.id,
      authorName: currentUser.name,
      source: "personal_todo",
      todoId: todo.id,
    };
    setState((current) => ({
      ...current,
      projectActions: { ...(current.projectActions || {}), [project.id]: [action, ...(((current.projectActions || {})[project.id]) || [])] },
      userNotes: {
        ...(current.userNotes || {}),
        [currentUser.id]: {
          ...((current.userNotes || {})[currentUser.id]),
          todos: (((current.userNotes || {})[currentUser.id]?.todos) || []).map((item) => (item.id === todo.id ? { ...item, actionId: action.id, actionSentAt: now() } : item)),
        },
      },
    }));
  };

  const shown = [...actions, ...fieldActions, ...lessonActions]
    .filter((item) => (tagFilter === "all" || (item.tag || "Diğer") === tagFilter) && (!filter.trim() || `${item.text} ${item.authorName} ${item.tag || ""}`.toLocaleLowerCase("tr-TR").includes(filter.trim().toLocaleLowerCase("tr-TR"))))
    .sort((a, b) => new Date(b.actionAt || b.createdAt) - new Date(a.actionAt || a.createdAt));

  return (
    <div className="project-actions-panel">
      <div className="project-actions-header unified-page-header">
        <div>
          <h3><Icon name="activity" size={19} />Proje Aksiyonları</h3>
          <p>Görüşme, arama, yazışma ve sistem kontrollerini kolayca kaydedin.</p>
        </div>
        <div className="theme-filter-strip project-actions-toolbar">
          <select style={iStyle} value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">Tüm aksiyon türleri</option>
            {actionTags.map((tag) => <option key={tag}>{tag}</option>)}
          </select>
          <input style={iStyle} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Aksiyonlarda ara..." />
          {canManage && (
            <Btn
              className="compact-tool-button"
              onClick={() => {
                resetForm();
                setSelectedTag(actionTags[0] || "Diğer");
                setShowActionForm((value) => !value);
              }}
            >
              {showActionForm ? "Formu Kapat" : "+ Aksiyon Ekle"}
            </Btn>
          )}
        </div>
      </div>

      {canManage && showActionForm && (
        <div className="ui-section-card action-form-card">
          <div className="action-form-grid">
            <Field label="Aksiyon Türü">
              <select style={iStyle} value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
                {actionTags.map((tag) => <option key={tag}>{tag}</option>)}
              </select>
            </Field>
            <div className="action-new-tag">
              <Field label="Yeni tür ekle">
                <input style={iStyle} value={newTag} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTag()} placeholder="Örn. Eğitim" />
              </Field>
              <Btn small variant="secondary" onClick={addTag}>Ekle</Btn>
            </div>
          </div>
          <Field label="Aksiyon">
            <textarea style={{ ...iStyle, minHeight: 82, resize: "vertical", lineHeight: 1.5 }} value={text} onChange={(event) => setText(event.target.value)} placeholder="Örn. Müşteriyle görüştüm, revize teklif mailini ilettim. Teknik ekipten dönüş bekliyorum." />
          </Field>
          <div className="action-form-footer">
            <div className="action-date-grid">
              <Field label="Aksiyon Tarihi"><input type="datetime-local" style={iStyle} value={actionAt} onChange={(event) => setActionAt(event.target.value)} /></Field>
              <Field label="Efor (Saat, isteğe bağlı)"><input type="number" min="0" step="0.25" style={iStyle} value={effortHours} onChange={(event) => setEffortHours(event.target.value)} placeholder="Örn. 1.5" /></Field>
            </div>
            <div className="action-form-buttons">
              {editingId && <Btn variant="ghost" onClick={resetForm}>İptal</Btn>}
              <Btn disabled={!text.trim()} onClick={submit}>{editingId ? "Aksiyonu Güncelle" : "Aksiyon Ekle"}</Btn>
            </div>
          </div>
        </div>
      )}

      {!canManage && <div className="ui-muted-note action-readonly-note">Aksiyon ekleme yetkisi proje yöneticileri ve sistem yöneticilerindedir.</div>}

      <div className="action-timeline">
        {shown.map((item) => {
          const canEdit = !["field_visit", "lesson"].includes(item.source) && (isAdmin || item.authorId === currentUser.id);
          const tone = actionTone(item);
          return (
            <div key={item.id} className={`ui-section-card action-card is-${tone}`}>
              <span className={`action-dot is-${tone}`} />
              <span className={`ui-chip action-tag-chip ui-chip-${tone === "success" ? "success" : tone === "warning" ? "warning" : "accent"}`}>{actionLabel(item)}</span>
              <div className="action-text">{item.text}</div>
              {item.source !== "field_visit" && Number(item.effortHours) > 0 && <span className="ui-chip ui-chip-accent action-effort-chip">Efor: {item.effortHours} saat</span>}
              <div className="action-meta-row">
                <span className="action-author">{item.authorName}</span>
                <span>·</span>
                <span>{new Date(item.actionAt || item.createdAt).toLocaleString("tr-TR")}</span>
                {item.updatedAt && <span>· Düzenlendi</span>}
                {item.source === "field_visit" && (isAdmin || item.authorId === currentUser.id) && (
                  <button className="inline-text-action is-success" onClick={() => setVisitPlan(item.plan)}>{item.completed ? "Ziyaret ve eforu düzenle" : "Not ve efor gir"}</button>
                )}
                {canEdit && (
                  <span className="action-inline-tools">
                    <button className="inline-text-action" onClick={() => edit(item)}>Düzenle</button>
                    <button className="inline-text-action is-danger" onClick={() => confirm("Aksiyon silinsin mi?") && remove(item.id)}>Sil</button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {!shown.length && <div className="ui-muted-note action-empty">Henüz proje aksiyonu kaydedilmedi.</div>}
      </div>

      {personalTodos.length > 0 && (
        <div className="ui-section-card action-todo-card">
          <div className="task-section-title">Bu projeye bağlı kişisel To-Do'larım</div>
          <div className="action-todo-list">
            {personalTodos.map((todo) => (
              <div key={todo.id} className="action-todo-row">
                <span>{todo.action || todo.text}</span>
                <input type="number" min="0" step=".25" title="Efor saati" value={todoEfforts[todo.id] || ""} onChange={(event) => setTodoEfforts((current) => ({ ...current, [todo.id]: event.target.value }))} placeholder="Efor" style={{ ...iStyle, width: 80, padding: "6px 8px", fontSize: 11 }} />
                <button onClick={() => sendTodoToActions(todo)}>Aksiyona Gönder</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {visitPlan && (
        <FieldVisitModal
          plan={visitPlan}
          project={project}
          currentUser={currentUser}
          onClose={() => setVisitPlan(null)}
          onSave={(data) => {
            setState((s) => ({
              ...s,
              fieldPlans: (s.fieldPlans || []).map((plan) => (plan.id === visitPlan.id ? { ...plan, ...data, status: "completed", completedAt: plan.completedAt || now(), updatedAt: now() } : plan)),
            }));
            setVisitPlan(null);
          }}
        />
      )}
    </div>
  );
}
