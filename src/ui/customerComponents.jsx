import { useMemo, useState } from "react";
import { Btn, Field, iStyle } from "./primitives.jsx";

export function CustomersPage({ state, setState, onInviteUser, onPreviewCustomer }) {
  const projects = state.projects || [];
  const [selectedId, setSelectedId] = useState(projects[0]?.id || "");
  const [userForm, setUserForm] = useState({ name: "", email: "", phone: "" });
  const selectedProject = projects.find((project) => project.id === selectedId) || null;
  const accessKeys = useMemo(
    () => new Set([selectedProject?.id, selectedProject?.customerId].filter(Boolean)),
    [selectedProject],
  );
  const customerUsers = (state.people || []).filter(
    (person) => person.userType === "customer" && accessKeys.has(person.customerId),
  );
  const customerName = (project) =>
    project?.customerProfile?.name || project?.customerName || project?.name || "Müşteri";

  const updateProjectCustomer = (data) => {
    if (!selectedProject) return;
    setState((current) => ({
      ...current,
      projects: (current.projects || []).map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              customerId: project.customerId || project.id,
              customerProfile: {
                ...(project.customerProfile || {}),
                ...data,
              },
            }
          : project,
      ),
    }));
  };

  const inviteUser = () => {
    if (!selectedProject || !userForm.name.trim() || !userForm.email.trim()) return;
    onInviteUser({
      ...userForm,
      userType: "customer",
      roleKey: "customer_viewer",
      customerId: selectedProject.id,
      isAdmin: false,
      ticketOnly: false,
      role: "Müşteri Kullanıcısı",
      active: true,
    });
    setUserForm({ name: "", email: "", phone: "" });
  };

  return (
    <div style={{ padding: "22px 26px", flex: 1, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Müşteri Portalı</h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "#64748B", lineHeight: 1.55 }}>
            Her proje bir müşteri alanıdır. Müşteri kullanıcıları yalnızca seçili projenin durumunu, planını, eğitimlerini,
            makinelerini ve müşteri görünür ticketlarını takip eder.
          </p>
        </div>
        {selectedProject && <Btn variant="secondary" onClick={() => onPreviewCustomer(selectedProject.id)}>Müşteri Gibi Gör</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,.85fr) minmax(0,1.15fr)", gap: 14 }}>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          {projects.map((project) => {
            const name = customerName(project);
            const logo = project.customerProfile?.logoUrl;
            const accent = project.customerProfile?.accentColor || project.color || "#4A6CF7";
            const users = (state.people || []).filter(
              (person) =>
                person.userType === "customer" &&
                [project.id, project.customerId].filter(Boolean).includes(person.customerId),
            ).length;
            return (
              <button
                key={project.id}
                onClick={() => setSelectedId(project.id)}
                style={{
                  border: `1.5px solid ${selectedId === project.id ? accent : "#E2E8F0"}`,
                  borderRadius: 15,
                  background: "#fff",
                  padding: 14,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  gap: 11,
                  alignItems: "center",
                }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 13, background: "#F8FAFC", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                  {logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <b style={{ color: accent }}>{name.slice(0, 2).toUpperCase()}</b>}
                </span>
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 13 }}>{name}</b>
                  <small style={{ color: "#64748B" }}>{project.name} · {users} müşteri kullanıcısı</small>
                </span>
              </button>
            );
          })}
          {!projects.length && <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", border: "1px dashed #CBD5E1", borderRadius: 14 }}>Henüz proje yok.</div>}
        </div>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          {selectedProject ? (
            <>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Müşteri Alanı Bilgileri</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                  <Field label="Müşteri / Firma Adı">
                    <input
                      style={iStyle}
                      value={customerName(selectedProject)}
                      onChange={(event) => updateProjectCustomer({ name: event.target.value })}
                    />
                  </Field>
                  <Field label="Web Sitesi">
                    <input
                      style={iStyle}
                      value={selectedProject.customerProfile?.website || ""}
                      onChange={(event) => updateProjectCustomer({ website: event.target.value })}
                      placeholder="https://..."
                    />
                  </Field>
                  <Field label="Logo URL">
                    <input
                      style={iStyle}
                      value={selectedProject.customerProfile?.logoUrl || ""}
                      onChange={(event) => updateProjectCustomer({ logoUrl: event.target.value })}
                      placeholder="https://.../logo.png"
                    />
                  </Field>
                  <Field label="Vurgu Rengi">
                    <input
                      type="color"
                      style={{ ...iStyle, padding: 4 }}
                      value={selectedProject.customerProfile?.accentColor || selectedProject.color || "#4A6CF7"}
                      onChange={(event) => updateProjectCustomer({ accentColor: event.target.value })}
                    />
                  </Field>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#64748B", lineHeight: 1.55 }}>
                  Bu bilgiler proje kartvizitinde ve müşteri portalında kullanılır. Müşteri kullanıcısı bu projeye bağlanır;
                  ayrıca ayrı bir müşteri portföy kaydı oluşturmanız gerekmez.
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Müşteri Kullanıcıları</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9 }}>
                  <Field label="Ad Soyad"><input style={iStyle} value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></Field>
                  <Field label="E-posta"><input type="email" style={iStyle} value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></Field>
                  <Field label="Telefon"><input style={iStyle} value={userForm.phone} onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })} /></Field>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}><Btn onClick={inviteUser}>Kullanıcı Davet Et</Btn></div>
                <div style={{ display: "grid", gap: 7 }}>
                  {customerUsers.map((person) => (
                    <div key={person.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "9px 10px", background: "#F8FAFC", borderRadius: 10, fontSize: 12 }}>
                      <b>{person.name}</b><span style={{ color: "#64748B" }}>{person.email}</span>
                    </div>
                  ))}
                  {!customerUsers.length && <div style={{ color: "#94A3B8", fontSize: 11 }}>Bu projeye bağlı müşteri kullanıcısı yok.</div>}
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", border: "1px dashed #CBD5E1", borderRadius: 14 }}>Müşteri portalı için bir proje seçin.</div>
          )}
        </div>
      </div>
    </div>
  );
}
