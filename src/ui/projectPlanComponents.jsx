import { useState } from "react";
import { Btn } from "./primitives.jsx";
import { Badge, DelayBadge, delayLvl } from "./status.jsx";
import { TaskCard } from "./taskComponents.jsx";

const defaultFormatDate = (value) => value || "-";
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";

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
      onTime={isAdmin ? () => onTimeTask(milestone.id, task) : null}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{milestone.name}</h3>
        <Badge label={milestone.status} />
        <DelayBadge dateStr={milestone.dueDate} status={milestone.status} />
        {milestone.waitSource && (
          <span className="ui-chip ui-chip-warning">
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
      {milestone.successCriteria && (
        <div className="ui-muted-note" style={{ padding: "9px 11px", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
          <b>Başarı kriteri / müşteri kazancı:</b> {milestone.successCriteria}
        </div>
      )}

      {active.length === 0 && done.length === 0 && (
        <div className="ui-muted-note" style={{ textAlign: "center", padding: 28, fontSize: 12 }}>Görev yok.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {active.map(renderTask)}
      </div>

      {done.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowDone((value) => !value)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, padding: "0 0 7px", display: "flex", alignItems: "center", gap: 5 }}
          >
            {showDone ? "v" : ">"} Tamamlananlar ({done.length})
          </button>
          {showDone && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{done.map(renderTask)}</div>}
        </div>
      )}
    </div>
  );
}

export function TemplatePicker({ templates = [], onSelect, onSkip }) {
  const [sel, setSel] = useState(null);
  return <div className="template-picker-panel">
    <div style={{ marginBottom:16, fontSize:13, color:"var(--muted)" }}>Başlangıç şablonu seçin veya boş devam edin:</div>
    <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
      {templates.map(t => <div key={t.id} onClick={() => setSel(t.id)}
        style={{ padding:"14px 16px", borderRadius:12, border:`2px solid ${sel===t.id?t.color:"var(--border)"}`, cursor:"pointer", background:sel===t.id?"var(--accent-ink)":"var(--surface)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:10, height:10, borderRadius:"50%", background:t.color, flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13 }}>{t.name}</div>
          <span style={{ marginLeft:"auto", fontSize:11, color:"var(--muted)" }}>{t.milestones.length} milestone</span>
        </div>
        <div style={{ fontSize:12, color:"var(--muted)", marginTop:4, marginLeft:20 }}>{t.description}</div>
        {sel===t.id && <div style={{ marginTop:10, marginLeft:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", marginBottom:5 }}>Milestonelar:</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {t.milestones.map((m,i) => <span key={i} style={{ background:t.color+"22", color:t.color, borderRadius:8, padding:"2px 9px", fontSize:11, fontWeight:600 }}>{m.name}</span>)}
          </div>
        </div>}
      </div>)}
    </div>
    <div style={{ display:"flex", justifyContent:"space-between" }}>
      <Btn variant="ghost" onClick={onSkip}>Şablon Olmadan Devam</Btn>
      <Btn disabled={!sel} onClick={() => sel&&onSelect(templates.find(t=>t.id===sel))}>Bu Şablonu Kullan</Btn>
    </div>
  </div>;
}

// ─── Gantt ──────────────────────────────────────────────────────────────────
export function GanttChart({ project, compact }) {
  const [expanded, setExpanded] = useState(null);
  const ms = project.milestones;
  if (!ms.length) return <div className="ui-muted-note" style={{ padding:40, textAlign:"center" }}>Milestone yok.</div>;

  const allDates = [
    ...ms.map(m => m.startDate || project.startDate).filter(Boolean),
    ...ms.map(m => m.dueDate).filter(Boolean),
  ].filter(Boolean);
  if (!allDates.length) return <div className="ui-muted-note" style={{ padding:40, textAlign:"center" }}>Tarih bilgisi eksik.</div>;

  const minDate = new Date(Math.min(...allDates.map(d => new Date(d))));
  const maxDate = new Date(Math.max(...allDates.map(d => new Date(d))));
  // Add padding so bars don't touch edges
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 3);
  const total = Math.max(1, (maxDate - minDate) / 86400000);
  const todayOff = (new Date() - minDate) / 86400000;

  const pct = (d) => {
    if (!d) return 0;
    return Math.max(0, Math.min(99, (new Date(d) - minDate) / 86400000 / total * 100));
  };
  const wPct = (s, e) => {
    if (!s || !e) return 2;
    const w = (new Date(e) - new Date(s)) / 86400000 / total * 100;
    return Math.max(2, w);
  };

  const months = [];
  let cur = new Date(minDate); cur.setDate(1);
  while (cur <= maxDate) {
    months.push({ label: cur.toLocaleDateString("tr-TR", { month:"short", year:"2-digit" }), pct: pct(cur.toISOString().slice(0,10)) });
    cur.setMonth(cur.getMonth() + 1);
  }

  const isNarrow = typeof window !== "undefined" && window.innerWidth <= 768;
  const labelW = compact ? 110 : isNarrow ? 96 : 150;
  const taskLabelW = isNarrow ? 96 : 140;
  const summaryW = isNarrow ? 34 : 50;
  const rowH = 28;
  const bgs = ["#FFFFFF", "#F8FAFF"];

  const barColor = (m) => {
    const dl = delayLvl(m.dueDate, m.status);
    if (m.status === "Tamamland\u0131") return "var(--success)";
    if (dl === "critical") return "var(--danger)";
    if (dl === "normal") return "var(--warning)";
    return project.color;
  };

  return (
    <div className="project-gantt-panel" style={{ overflowX:"auto" }}>
      <div style={{ minWidth: isNarrow ? "100%" : 520 }}>
        <div style={{ fontSize:10, color:"var(--muted)", marginBottom:8 }}>
          Milestone tıklayın → hedeflenen/gerçekleşen + görev satırları
        </div>
        {/* Month labels */}
        <div style={{ display:"flex", marginLeft:labelW, marginBottom:4, position:"relative", height:16 }}>
          {months.map((m, i) => (
            <div key={i} style={{ position:"absolute", left:`${m.pct}%`, fontSize:9, color:"var(--muted)", fontWeight:600, whiteSpace:"nowrap" }}>{m.label}</div>
          ))}
        </div>
        {/* Today line header */}
        <div style={{ display:"flex", marginLeft:labelW, marginBottom:2, position:"relative", height:2 }}>
          <div style={{ flex:1, position:"relative", height:2, background:"var(--accent-ink)", borderRadius:1 }}>
            {todayOff >= 0 && todayOff <= total && (
              <div style={{ position:"absolute", left:`${todayOff/total*100}%`, top:-2, bottom:-2, width:2, background:"var(--danger)", opacity:0.5 }} />
            )}
          </div>
        </div>

        {ms.map((m, mi) => {
          const s = m.startDate || project.startDate;
          const e = m.dueDate;
          if (!s || !e) return null;
          const bc = barColor(m);
          const done = m.tasks.filter(t => t.status === "Tamamland\u0131").length;
          const isExp = expanded === m.id;

          return (
            <div key={m.id} style={{ marginBottom: isExp ? 2 : 3 }}>
              {/* Milestone row */}
              <div onClick={() => setExpanded(isExp ? null : m.id)}
                style={{ display:"flex", alignItems:"center", padding:"2px 0", cursor:"pointer" }}>
                <div style={{ width:labelW, flexShrink:0, fontSize:compact ? 10 : 11, fontWeight:700, paddingRight:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--text)" }} title={m.name}>
                  {isExp ? "▾" : "▸"} {m.name}
                </div>
                <div style={{ flex:1, position:"relative", height:rowH, background: bgs[mi % 2], borderRadius:6, border:`1px solid #E8EDF5` }}>
                  {/* Today line */}
                  {todayOff >= 0 && todayOff <= total && (
                    <div style={{ position:"absolute", left:`${todayOff/total*100}%`, top:0, bottom:0, width:1.5, background:"var(--danger)", zIndex:4, opacity:0.7 }} />
                  )}
                  {/* Planned bar (dashed outline) */}
                  <div style={{
                    position:"absolute", left:`${pct(s)}%`, width:`${wPct(s,e)}%`,
                    top:4, height:rowH-8, background:bc+"22",
                    border:`1.5px dashed ${bc}`, borderRadius:4, zIndex:1
                  }} />
                  {/* Actual bar (solid) - only if actual dates exist */}
                  {m.actualStart && (
                    <div style={{
                      position:"absolute",
                      left:`${pct(m.actualStart)}%`,
                      width:`${wPct(m.actualStart, m.actualEnd || new Date().toISOString().slice(0,10))}%`,
                      top:4, height:rowH-8, background:bc, borderRadius:4, zIndex:2, overflow:"hidden",
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      <span title={`${fmt(m.actualStart)} → ${fmt(m.actualEnd||e)}`} style={{ display:"block",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",fontSize:9, color:"#fff", fontWeight:700, padding:"0 4px", whiteSpace:"nowrap",textShadow:"0 1px 2px rgba(0,0,0,.45)" }}>
                        {m.status === "Tamamland\u0131" ? "✓ " : ""}{fmt(e)}
                      </span>
                    </div>
                  )}
                  {/* If no actual, show solid planned bar with label */}
                  {!m.actualStart && (
                    <div style={{
                      position:"absolute", left:`${pct(s)}%`, width:`${wPct(s,e)}%`,
                      top:4, height:rowH-8, background:bc, borderRadius:4, zIndex:2, overflow:"hidden",
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      <span title={`${fmt(s)} → ${fmt(e)}`} style={{ display:"block",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",fontSize:9, color:"#fff", fontWeight:700, padding:"0 4px", whiteSpace:"nowrap",textShadow:"0 1px 2px rgba(0,0,0,.45)" }}>
                        {m.status === "Tamamland\u0131" ? "✓ " : ""}{fmt(s)} → {fmt(e)}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ width:summaryW, textAlign:"right", paddingLeft:6, fontSize:10, color:"var(--muted)" }}>{done}/{m.tasks.length}</div>
              </div>

              {/* Expanded: comparison + tasks */}
              {isExp && (
                <div style={{ marginLeft:labelW, background:"var(--accent-ink)", borderRadius:"0 0 10px 10px", padding:"8px 8px 10px", border:"1px solid color-mix(in srgb, var(--accent) 22%, var(--border))", borderTop:"none", marginBottom:4 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--accent)", marginBottom:8 }}>
                    Hedef: {fmt(s)} → {fmt(e)} &nbsp;|&nbsp; {m.actualStart ? `Gerçekleşen: ${fmt(m.actualStart)} → ${fmt(m.actualEnd)||"devam"}` : "Gerçekleşen tarih girilmemiş (Milestone Düzenle)"}
                  </div>
                  {/* Task Gantt rows */}
                  {m.tasks.filter(t => t.dueDate).length > 0 ? (
                    <div>
                      <div style={{ fontSize:9, fontWeight:700, color:"var(--accent)", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Görev Planı</div>
                      {m.tasks.filter(t => t.dueDate).map(t => {
                        const tdl = delayLvl(t.dueDate, t.status);
                        const tc = t.status === "Tamamland\u0131" ? "var(--success)" : tdl === "critical" ? "var(--danger)" : tdl === "normal" ? "var(--warning)" : project.color;
                        const hasRange = t.startDate && t.dueDate && new Date(t.startDate) < new Date(t.dueDate);
                        const barLeft = hasRange ? pct(t.startDate) : Math.max(0, pct(t.dueDate) - 1);
                        const barWidth = hasRange ? wPct(t.startDate, t.dueDate) : 2;
                        const donePct = t.status === "Tamamland\u0131" ? 100 : 0;
                        return (
                          <div key={t.id} style={{ display:"flex", alignItems:"center", marginBottom:5 }}>
                            <div style={{ width:taskLabelW, flexShrink:0, fontSize:9, color:"var(--muted)", paddingRight:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: t.status==="Tamamland\u0131"?400:500 }} title={t.title}>
                              {t.status==="Tamamland\u0131" ? "✓ " : ""}{t.title}
                            </div>
                            <div style={{ flex:1, position:"relative", height:20, background:"#fff", borderRadius:4, border:"1px solid #E8EDF5", overflow:"hidden" }}>
                              {/* Today line */}
                              {todayOff >= 0 && todayOff <= total && (
                                <div style={{ position:"absolute", left:`${todayOff/total*100}%`, top:0, bottom:0, width:1, background:"var(--danger)", opacity:0.4, zIndex:3 }} />
                              )}
                              {/* Task bar background */}
                              <div style={{
                                position:"absolute",
                                left:`${barLeft}%`,
                                width:`${barWidth}%`,
                                top:3, height:14,
                                background: tc + "33",
                                border:`1px solid ${tc}66`,
                                borderRadius:4,
                                zIndex:1,
                                minWidth:4
                              }} />
                              {/* Progress fill */}
                              {hasRange && donePct > 0 && (
                                <div style={{
                                  position:"absolute",
                                  left:`${barLeft}%`,
                                  width:`${barWidth * donePct / 100}%`,
                                  top:3, height:14,
                                  background: tc,
                                  borderRadius:4,
                                  zIndex:2
                                }} />
                              )}
                              {/* If no range: diamond marker at due date */}
                              {!hasRange && (
                                <div style={{
                                  position:"absolute",
                                  left:`${pct(t.dueDate)}%`,
                                  top:4, width:12, height:12,
                                  background:tc,
                                  transform:"translateX(-50%) rotate(45deg)",
                                  zIndex:2,
                                  borderRadius:2
                                }} title={`${t.title}: ${fmt(t.dueDate)}`} />
                              )}
                              {/* Date label inside bar if wide enough */}
                              {hasRange && barWidth > 8 && (
                                <div style={{
                                  position:"absolute",
                                  left:`${barLeft}%`,
                                  width:`${barWidth}%`,
                                  top:3, height:14,
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  zIndex:3, pointerEvents:"none"
                                }}>
                                  <span style={{ fontSize:8, color: donePct>50?"#fff":tc, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden" }}>
                                    {fmt(t.startDate)}→{fmt(t.dueDate)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div style={{ width:56, fontSize:8, color: tdl ? "var(--danger)" : "var(--muted)", paddingLeft:5, whiteSpace:"nowrap", textAlign:"right" }}>
                              {hasRange ? fmt(t.dueDate) : fmt(t.dueDate)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:"var(--muted)" }}>Bu milestone'da tarihli görev yok.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Today label */}
        {todayOff >= 0 && todayOff <= total && (
          <div style={{ position:"relative", height:14, marginLeft:labelW }}>
            <div style={{ position:"absolute", left:`${todayOff/total*100}%`, fontSize:9, color:"var(--danger)", fontWeight:700, transform:"translateX(-50%)", whiteSpace:"nowrap" }}>▲ BUGÜN</div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display:"flex", gap:14, marginTop:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:24, height:8, borderRadius:3, border:`1.5px dashed ${project.color}`, background:project.color+"22" }} />
            <span style={{ fontSize:10, color:"var(--muted)" }}>Hedeflenen</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:24, height:8, borderRadius:3, background:project.color }} />
            <span style={{ fontSize:10, color:"var(--muted)" }}>Gerçekleşen</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:2, height:16, background:"var(--danger)", borderRadius:2 }} />
            <span style={{ fontSize:10, color:"var(--muted)" }}>Bugün</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanListTable({ project, people }) {
  const [expandedMs, setExpandedMs] = useState({});
  const toggle = (id) => setExpandedMs(s => ({ ...s, [id]: !s[id] }));
  const findName = (id) => people.find(p => p.id === id)?.name || "—";
  const thStyle = { padding:"8px 12px", textAlign:"left", fontWeight:700, color:"var(--muted)", borderBottom:"1px solid var(--border)", fontSize:11 };
  const tdStyle = (extra={}) => ({ padding:"8px 12px", borderBottom:"1px solid var(--accent-ink)", fontSize:12, ...extra });
  const bgs = ["#FAFBFF", "#F5F9FF"];

  // Flatten rows: milestone rows + optional task rows
  const rows = [];
  project.milestones.forEach((m, mi) => {
    const done = m.tasks.filter(t => t.status === "Tamamlandı").length;
    const pct = m.tasks.length ? Math.round(done / m.tasks.length * 100) : 0;
    const isExp = !!expandedMs[m.id];
    const bg = bgs[mi % 2];
    rows.push(
      <tr key={m.id} style={{ background: bg, cursor:"pointer" }} onClick={() => toggle(m.id)}>
        <td style={{ ...tdStyle(), width:28, color:"var(--muted)", fontWeight:700 }}>{isExp ? "▾" : "▸"}</td>
        <td style={{ ...tdStyle(), fontWeight:700 }}>{m.name}</td>
        <td style={tdStyle({ color:"var(--muted)" })}>{fmt(m.startDate)}</td>
        <td style={tdStyle({ color:"var(--muted)" })}>{fmt(m.dueDate)}</td>
        <td style={tdStyle({ color: m.actualStart ? "var(--text)" : "var(--muted)" })}>{fmt(m.actualStart) || "—"}</td>
        <td style={tdStyle({ color: m.actualEnd ? "var(--text)" : "var(--muted)" })}>{fmt(m.actualEnd) || "—"}</td>
        <td style={tdStyle()}><Badge label={m.status} /></td>
        <td style={tdStyle()}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:60, height:6, background:"var(--accent-ink)", borderRadius:4 }}>
              <div style={{ width:`${pct}%`, height:"100%", background: project.color, borderRadius:4 }} />
            </div>
            <span style={{ fontSize:11, color:"var(--muted)" }}>{done}/{m.tasks.length}</span>
          </div>
        </td>
      </tr>
    );
    if (isExp) {
      m.tasks.forEach(t => {
        const dl = delayLvl(t.dueDate, t.status);
        rows.push(
          <tr key={t.id} style={{ background:"color-mix(in srgb, var(--surface-soft) 70%, white 30%)" }}>
            <td style={{ ...tdStyle(), color:"var(--muted)" }}></td>
            <td style={{ ...tdStyle(), paddingLeft:28 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:11, color:"var(--text)" }}>{t.title}</span>
                {t.link && (() => {
                  const jm = String(t.link).match(/([A-Z][A-Z0-9]+-[0-9]+)/);
                  return <a href={t.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="ui-chip ui-chip-info" style={{ fontSize:10, textDecoration:"none" }}>{jm ? jm[1] : "Jira"}</a>;
                })()}
              </div>
            </td>
            <td style={tdStyle({ color:t.startDate?"var(--muted)":"color-mix(in srgb, var(--muted) 62%, white 38%)" })}>{fmt(t.startDate)}</td>
            <td style={tdStyle({ color: dl ? "var(--danger)" : "var(--muted)" })}>{fmt(t.dueDate)}</td>
            <td style={tdStyle({ color:"var(--muted)" })}>—</td>
            <td style={tdStyle({ color:"var(--muted)" })}>—</td>
            <td style={tdStyle()}><Badge label={t.status} /></td>
            <td style={tdStyle({ color:"var(--muted)", fontSize:11 })}>{findName(t.assignee)}</td>
          </tr>
        );
      });
    }
  });

  return (
    <div className="ui-section-card project-plan-list-card" style={{ marginTop:24, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", fontWeight:800, fontSize:13 }}>Plan Listesi</div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
          <thead>
            <tr style={{ background:"var(--surface-soft)" }}>
              {["","Milestone / Görev","Hedef Başl.","Hedef Bitiş","Gerç. Başl.","Gerç. Bitiş","Durum","İlerleme"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}
