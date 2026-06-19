import { useMemo, useRef, useState } from "react";
import { Btn, Field, iStyle } from "./primitives.jsx";

const customerName = (project) =>
  project?.customerProfile?.name || project?.customerName || project?.name || "Müşteri";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const readImageAsDataUrl = (file, callback) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 360;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/webp", 0.82));
    };
    img.onerror = () => callback(String(reader.result || ""));
    img.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
};

export function CustomersPage({ state, setState, onInviteUser, onPreviewCustomer }) {
  const projects = state.projects || [];
  const [selectedId, setSelectedId] = useState(projects[0]?.id || "");
  const selectedProject = projects.find((project) => project.id === selectedId) || null;
  const fileInput = useRef(null);
  const accessKeys = useMemo(
    () => new Set([selectedProject?.id, selectedProject?.customerId].filter(Boolean)),
    [selectedProject],
  );
  const customerUsers = (state.people || []).filter(
    (person) => person.userType === "customer" && accessKeys.has(person.customerId),
  );
  const customerContacts = (selectedProject?.raciContacts || [])
    .filter((contact) => contact.side === "Müşteri" && normalizeEmail(contact.email))
    .filter((contact, index, list) => list.findIndex((item) => normalizeEmail(item.email) === normalizeEmail(contact.email)) === index);

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

  const uploadLogo = (file) => {
    readImageAsDataUrl(file, (logoUrl) => updateProjectCustomer({ logoUrl }));
  };

  const enableAccess = (contact) => {
    if (!selectedProject || !contact?.name || !contact?.email) return;
    const existing = customerUsers.find((person) => normalizeEmail(person.email) === normalizeEmail(contact.email));
    if (existing) return;
    onInviteUser({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      title: contact.title || "",
      company: contact.company || customerName(selectedProject),
      userType: "customer",
      roleKey: "customer_viewer",
      customerId: selectedProject.id,
      isAdmin: false,
      ticketOnly: false,
      role: "Müşteri Kullanıcısı",
      active: true,
      raciContactId: contact.id,
    });
  };

  const disableAccess = (personId) => {
    setState((current) => ({
      ...current,
      people: (current.people || []).filter((person) => person.id !== personId),
    }));
  };

  return (
    <div style={{ padding: "22px 26px", flex: 1, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Müşteri Portalı</h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "#64748B", lineHeight: 1.55 }}>
            Her proje bir müşteri alanıdır. Portal kullanıcıları RACI’de e-postası olan müşteri kontaklarından açılır.
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
                  <small style={{ color: "#64748B" }}>{project.name} · {users} portal kullanıcısı</small>
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
                    <input style={iStyle} value={customerName(selectedProject)} onChange={(event) => updateProjectCustomer({ name: event.target.value })} />
                  </Field>
                  <Field label="Web Sitesi">
                    <input style={iStyle} value={selectedProject.customerProfile?.website || ""} onChange={(event) => updateProjectCustomer({ website: event.target.value })} placeholder="https://..." />
                  </Field>
                  <Field label="Logo">
                    <div style={{ display: "grid", gap: 6 }}>
                      <input style={iStyle} value={(selectedProject.customerProfile?.logoUrl || "").startsWith("data:") ? "" : selectedProject.customerProfile?.logoUrl || ""} onChange={(event) => updateProjectCustomer({ logoUrl: event.target.value })} placeholder="https://.../logo.png" />
                      <button type="button" onClick={() => fileInput.current?.click()} style={{ border: 0, background: "#EEF2FF", color: "#4338CA", borderRadius: 9, padding: "7px 9px", fontSize: 10, fontWeight: 900, cursor: "pointer", textAlign: "left" }}>veya dosya yükle</button>
                      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(event) => uploadLogo(event.target.files?.[0])} />
                    </div>
                  </Field>
                  <Field label="Vurgu Rengi">
                    <input type="color" style={{ ...iStyle, padding: 4 }} value={selectedProject.customerProfile?.accentColor || selectedProject.color || "#4A6CF7"} onChange={(event) => updateProjectCustomer({ accentColor: event.target.value })} />
                  </Field>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#64748B", lineHeight: 1.55 }}>
                  Kontak eklemek için proje içindeki <b>Proje Bilgileri → RACI ve Kontaklar</b> alanını kullanın. E-posta girilen müşteri kontakları aşağıda portal erişimi için listelenir.
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>RACI Kontaklarından Portal Erişimi</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {customerContacts.map((contact) => {
                    const user = customerUsers.find((person) => normalizeEmail(person.email) === normalizeEmail(contact.email));
                    return (
                      <div key={contact.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 11px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, fontSize: 12 }}>
                        <span style={{ minWidth: 0 }}>
                          <b style={{ display: "block" }}>{contact.name}</b>
                          <small style={{ color: "#64748B" }}>{contact.title || contact.raci || "Müşteri kontağı"} · {contact.email}</small>
                        </span>
                        {user ? (
                          <Btn small variant="danger" onClick={() => disableAccess(user.id)}>Erişimi Kapat</Btn>
                        ) : (
                          <Btn small onClick={() => enableAccess(contact)}>Portal Erişimi Aç</Btn>
                        )}
                      </div>
                    );
                  })}
                  {!customerContacts.length && <div style={{ color: "#94A3B8", fontSize: 11, padding: 18, border: "1px dashed #CBD5E1", borderRadius: 12 }}>Bu projede e-postası olan müşteri RACI kontağı yok.</div>}
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
