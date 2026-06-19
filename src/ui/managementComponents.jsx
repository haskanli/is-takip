import { useState } from "react";
import { Avatar } from "./primitives.jsx";

export function OrganizationPanel({ people, roles = [], onEdit }) {
  const [view, setView] = useState("tree");
  const grouped = roles.map((level) => ({
    ...level,
    people: people.filter((person) => person.orgLevel === level.id),
  }));
  const unassigned = people.filter((person) => !person.orgLevel);

  const Person = ({ person }) => {
    const manager = people.find((item) => item.id === person.managerId);
    return (
      <button
        className="org-person-card"
        onClick={() => onEdit?.(person)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          textAlign: "left",
          cursor: onEdit ? "pointer" : "default",
          minWidth: 0,
        }}
      >
        <Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={30} color={person.isAdmin ? "var(--danger)" : "var(--accent)"} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: "block", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</b>
          {manager && <span style={{ display: "block", fontSize: 9, color: "var(--muted)", marginTop: 2 }}>Yönetici: {manager.name}</span>}
        </span>
      </button>
    );
  };

  const roots = people.filter((person) => !person.managerId || !people.some((item) => item.id === person.managerId));
  const TreeNode = ({ person, depth = 0 }) => {
    const children = people.filter((item) => item.managerId === person.id);
    return (
      <div style={{ marginLeft: depth ? 18 : 0, borderLeft: depth ? "2px solid var(--glass-border)" : "none", paddingLeft: depth ? 12 : 0, marginBottom: 8 }}>
        <Person person={person} />
        {children.length > 0 && <div style={{ marginTop: 7 }}>{children.map((child) => <TreeNode key={child.id} person={child} depth={depth + 1} />)}</div>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 9 }}>
        <div className="segmented-control">
          {[
            ["tree", "Ağaç"],
            ["levels", "Seviyeler"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={view === id ? "is-active" : ""}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "tree" ? (
        <div className="soft-panel" style={{ padding: 12 }}>
          {roots.map((person) => <TreeNode key={person.id} person={person} />)}
          {!roots.length && <div style={{ fontSize: 11, color: "var(--muted)" }}>Organizasyon ağacı oluşturulamadı.</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {grouped.map((level) => (
            <div key={level.id} className="org-level-row" style={{ display: "grid", gridTemplateColumns: "minmax(150px,190px) 1fr", gap: 10, alignItems: "stretch" }}>
              <div className="org-level-badge">
                <b style={{ fontSize: 11 }}>{level.label}</b>
                <span style={{ fontSize: 10 }}>{level.people.length}</span>
              </div>
              <div className="org-level-people">
                {level.people.map((person) => <Person key={person.id} person={person} />)}
                {!level.people.length && <div style={{ fontSize: 10, color: "var(--muted)", padding: 10 }}>Bu seviyeye kişi atanmadı.</div>}
              </div>
            </div>
          ))}
          {unassigned.length > 0 && (
            <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 7 }}>Hiyerarşisi atanmayanlar</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 7 }}>
                {unassigned.map((person) => <Person key={person.id} person={person} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
