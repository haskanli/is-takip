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
        onClick={() => onEdit?.(person)}
        style={{
          border: "1px solid #E2E8F0",
          background: "#fff",
          borderRadius: 11,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 9,
          textAlign: "left",
          cursor: onEdit ? "pointer" : "default",
          minWidth: 0,
        }}
      >
        <Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={30} color={person.isAdmin ? "#E11D48" : "#4A6CF7"} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: "block", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</b>
          {manager && <span style={{ display: "block", fontSize: 9, color: "#94A3B8", marginTop: 2 }}>Yönetici: {manager.name}</span>}
        </span>
      </button>
    );
  };

  const roots = people.filter((person) => !person.managerId || !people.some((item) => item.id === person.managerId));
  const TreeNode = ({ person, depth = 0 }) => {
    const children = people.filter((item) => item.managerId === person.id);
    return (
      <div style={{ marginLeft: depth ? 18 : 0, borderLeft: depth ? "2px solid #CBD5E1" : "none", paddingLeft: depth ? 12 : 0, marginBottom: 8 }}>
        <Person person={person} />
        {children.length > 0 && <div style={{ marginTop: 7 }}>{children.map((child) => <TreeNode key={child.id} person={child} depth={depth + 1} />)}</div>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 9 }}>
        <div style={{ display: "flex", background: "#E2E8F0", padding: 3, borderRadius: 9 }}>
          {[
            ["tree", "Ağaç"],
            ["levels", "Seviyeler"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                border: 0,
                borderRadius: 7,
                padding: "6px 9px",
                fontSize: 10,
                fontWeight: 800,
                cursor: "pointer",
                background: view === id ? "#fff" : "transparent",
                color: view === id ? "#4A6CF7" : "#64748B",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "tree" ? (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 13, padding: 12 }}>
          {roots.map((person) => <TreeNode key={person.id} person={person} />)}
          {!roots.length && <div style={{ fontSize: 11, color: "#94A3B8" }}>Organizasyon ağacı oluşturulamadı.</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {grouped.map((level) => (
            <div key={level.id} className="org-level-row" style={{ display: "grid", gridTemplateColumns: "minmax(150px,190px) 1fr", gap: 10, alignItems: "stretch" }}>
              <div
                style={{
                  background: `linear-gradient(135deg,#172033,${level.rank < 4 ? "#3730A3" : "#334155"})`,
                  color: "#fff",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <b style={{ fontSize: 11 }}>{level.label}</b>
                <span style={{ fontSize: 10, color: "#CBD5E1" }}>{level.people.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 7, background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 12, padding: 7 }}>
                {level.people.map((person) => <Person key={person.id} person={person} />)}
                {!level.people.length && <div style={{ fontSize: 10, color: "#94A3B8", padding: 10 }}>Bu seviyeye kişi atanmadı.</div>}
              </div>
            </div>
          ))}
          {unassigned.length > 0 && (
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", marginBottom: 7 }}>HİYERARŞİSİ ATANMAYANLAR</div>
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
