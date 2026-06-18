import { Avatar, Btn, Icon, iStyle } from "./primitives.jsx";
import {
  Badge,
  DelayBadge,
  PRIORITY_COLORS,
  STATUSES,
  delayLvl,
} from "./status.jsx";

const defaultFormatDate = (value) => value || "";
const defaultFormatFullDate = (value) => value || "";

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
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "11px 15px",
        border: `1.5px solid ${
          delayLevel === "critical" ? "#FCA5A5" : delayLevel === "normal" ? "#FED7AA" : "#E2E8F0"
        }`,
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        opacity: isDone ? 0.75 : 1,
      }}
    >
      {canEdit ? (
        <input
          type="checkbox"
          checked={isDone}
          onChange={(event) => onCheck && onCheck(event.target.checked)}
          style={{ marginTop: 3, width: 15, height: 15, cursor: "pointer", accentColor: "#4A6CF7" }}
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
              color: isDone ? "#94A3B8" : "#1E293B",
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
                color={projectColor || "#4A6CF7"}
              />
              <span style={{ fontSize: 11, color: "#64748B" }}>{assignee.name}</span>
            </div>
          )}
          {task.startDate && (
            <span style={{ fontSize: 11, color: "#94A3B8" }}>
              Başl: {formatDate(task.startDate)}
              {task.startTime ? ` ${task.startTime}` : ""}
            </span>
          )}
          {task.dueDate && (
            <span style={{ fontSize: 11, color: delayLevel ? "#E11D48" : "#94A3B8" }}>
              {task.startDate ? "Bit:" : "Termin:"} {formatDate(task.dueDate)}
              {task.dueTime ? ` ${task.dueTime}` : ""}
            </span>
          )}
          {(task.timeEntries || []).length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "#7C3AED",
                fontWeight: 600,
                background: "#F5F3FF",
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
                color: "#0369A1",
                fontWeight: 600,
                background: "#F0F9FF",
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
                color: "#4338CA",
                fontWeight: 700,
                background: "#EEF2FF",
                borderRadius: 6,
                padding: "1px 6px",
              }}
            >
              {task.responsibilityGroup}
            </span>
          )}
          {task.waitSource && (
            <span style={{ fontSize: 11, color: "#EA6C00", fontWeight: 600 }}>Bekliyor: {task.waitSource}</span>
          )}
          {task.waitReason && ["Bekliyor", "Engellendi"].includes(task.status) && (
            <span
              style={{
                fontSize: 11,
                color: "#9A3412",
                background: "#FFF7ED",
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
                    color: "#0052CC",
                    background: "#DEEBFF",
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
            <span style={{ fontSize: 11, color: "#4A6CF7", background: "#F1F5FF", borderRadius: 6, padding: "1px 6px" }}>
              {projectName}
            </span>
          )}
          {task.notes && <span style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic" }}>"{task.notes}"</span>}
        </div>

        {(task.waitingHistory || []).length > 0 && (
          <details style={{ marginTop: 7 }}>
            <summary style={{ fontSize: 10, color: "#64748B", cursor: "pointer", fontWeight: 700 }}>
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
                      color: "#475569",
                      background: "#F8FAFC",
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
            style={{ ...iStyle, width: 145, fontSize: 11, background: "#F8FAFC", padding: "5px 8px" }}
          >
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        )}
        {onTime && (
          <Btn small variant="ghost" onClick={onTime} style={{ color: "#7C3AED" }}>
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
