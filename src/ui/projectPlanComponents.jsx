import { Btn } from "./primitives.jsx";
import { Badge, DelayBadge } from "./status.jsx";
import { TaskCard } from "./taskComponents.jsx";

const defaultFormatDate = (value) => value || "-";

export function MilestoneTaskPanel({
  milestone,
  project,
  people,
  isAdmin,
  showDone,
  setShowDone,
  onEdit,
  onDelete,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onCheckTask,
  onTimeTask,
  formatDate = defaultFormatDate,
  formatFullDate = defaultFormatDate,
}) {
  const active = milestone.tasks.filter((task) => task.status !== "Tamamlandı");
  const done = milestone.tasks.filter((task) => task.status === "Tamamlandı");

  const renderTask = (task) => (
    <TaskCard
      key={task.id}
      task={task}
      people={people}
      projectColor={project.color}
      canEdit={isAdmin}
      formatDate={formatDate}
      formatFullDate={formatFullDate}
      onCheck={(checked) => onCheckTask(milestone.id, task.id, checked)}
      onEdit={isAdmin ? () => onEditTask(milestone.id, task) : null}
      onDelete={isAdmin ? () => onDeleteTask(milestone.id, task.id) : null}
      onTime={() => onTimeTask(milestone.id, task)}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{milestone.name}</h3>
        <Badge label={milestone.status} />
        <DelayBadge dateStr={milestone.dueDate} status={milestone.status} />
        {milestone.waitSource && (
          <span style={{ background: "#FFF7ED", color: "#EA6C00", borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
            Bekliyor: {milestone.waitSource}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {isAdmin && (
            <>
              <Btn small variant="secondary" onClick={() => onEdit(milestone)}>Düzenle</Btn>
              <Btn small variant="danger" onClick={() => onDelete(milestone.id)}>Sil</Btn>
              <Btn small onClick={() => onAddTask(milestone.id)}>+ Görev</Btn>
            </>
          )}
        </div>
      </div>

      {active.length === 0 && done.length === 0 && (
        <div style={{ textAlign: "center", padding: 28, color: "#94A3B8", fontSize: 12 }}>Görev yok.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {active.map(renderTask)}
      </div>

      {done.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowDone((value) => !value)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, padding: "0 0 7px", display: "flex", alignItems: "center", gap: 5 }}
          >
            {showDone ? "v" : ">"} Tamamlananlar ({done.length})
          </button>
          {showDone && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{done.map(renderTask)}</div>}
        </div>
      )}
    </div>
  );
}
