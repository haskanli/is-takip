import { useState } from "react";
import { Btn, Field, iStyle } from "./primitives.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);

export function CustomersPage({ state, setState, onInviteUser, onPreviewCustomer }) {
  const customers = state.customers || [];
  const [selectedId, setSelectedId] = useState(customers[0]?.id || "");
  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    website: "",
    accentColor: "#4A6CF7",
    contacts: "",
  });
  const [userForm, setUserForm] = useState({ name: "", email: "", phone: "" });
  const selected = customers.find((customer) => customer.id === selectedId) || null;
  const linkedProjects = (state.projects || []).filter((project) => project.customerId === selectedId);
  const customerUsers = (state.people || []).filter((person) => person.userType === "customer" && person.customerId === selectedId);

  const saveCustomer = () => {
    if (!form.name.trim()) return;
    const customer = {
      id: selected?.id || uid(),
      ...form,
      name: form.name.trim(),
      contacts: form.contacts
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      updatedAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      customers: selected
        ? (current.customers || []).map((item) => (item.id === selected.id ? customer : item))
        : [...(current.customers || []), customer],
    }));
    setSelectedId(customer.id);
  };

  const editCustomer = (customer) => {
    setSelectedId(customer.id);
    setForm({
      name: customer.name || "",
      logoUrl: customer.logoUrl || "",
      website: customer.website || "",
      accentColor: customer.accentColor || "#4A6CF7",
      contacts: (customer.contacts || []).join("\n"),
    });
  };

  const newCustomer = () => {
    setSelectedId("");
    setForm({ name: "", logoUrl: "", website: "", accentColor: "#4A6CF7", contacts: "" });
    setUserForm({ name: "", email: "", phone: "" });
  };

  const assignProject = (projectId, customerId) => {
    setState((current) => ({
      ...current,
      projects: (current.projects || []).map((project) =>
        project.id === projectId
          ? {
              ...project,
              customerId,
              customerProfile: {
                ...(project.customerProfile || {}),
                ...(customerId
                  ? {
                      name: customers.find((customer) => customer.id === customerId)?.name || project.customerProfile?.name || "",
                      logoUrl: customers.find((customer) => customer.id === customerId)?.logoUrl || project.customerProfile?.logoUrl || "",
                      website: customers.find((customer) => customer.id === customerId)?.website || project.customerProfile?.website || "",
                    }
                  : {}),
              },
            }
          : project,
      ),
    }));
  };

  const inviteUser = () => {
    if (!selectedId || !userForm.name.trim() || !userForm.email.trim()) return;
    onInviteUser({
      ...userForm,
      userType: "customer",
      roleKey: "customer_viewer",
      customerId: selectedId,
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
          <h2 style={{ margin: 0, fontSize: 22 }}>Müşteriler</h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "#64748B" }}>
            Satın alan firmaları, müşteri kullanıcılarını ve müşteri portalı proje kapsamını yönetin.
          </p>
        </div>
        <Btn variant="secondary" onClick={newCustomer}>+ Yeni Müşteri</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,.8fr) minmax(0,1.2fr)", gap: 14 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {customers.map((customer) => (
            <button
              key={customer.id}
              onClick={() => editCustomer(customer)}
              style={{
                border: `1.5px solid ${selectedId === customer.id ? customer.accentColor || "#4A6CF7" : "#E2E8F0"}`,
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
                {customer.logoUrl ? <img src={customer.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <b style={{ color: customer.accentColor || "#4A6CF7" }}>{customer.name?.slice(0, 2).toUpperCase()}</b>}
              </span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: "block", fontSize: 13 }}>{customer.name}</b>
                <small style={{ color: "#64748B" }}>{(state.projects || []).filter((project) => project.customerId === customer.id).length} proje · {customer.website || "web yok"}</small>
              </span>
            </button>
          ))}
          {!customers.length && <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", border: "1px dashed #CBD5E1", borderRadius: 14 }}>Henüz müşteri yok.</div>}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{selected ? "Müşteri Bilgileri" : "Yeni Müşteri"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              <Field label="Firma Adı"><input style={iStyle} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Web Sitesi"><input style={iStyle} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://..." /></Field>
              <Field label="Logo URL"><input style={iStyle} value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} placeholder="https://.../logo.png" /></Field>
              <Field label="Vurgu Rengi"><input type="color" style={{ ...iStyle, padding: 4 }} value={form.accentColor} onChange={(event) => setForm({ ...form, accentColor: event.target.value })} /></Field>
            </div>
            <Field label="Kontaklar / Notlar"><textarea style={{ ...iStyle, minHeight: 72, resize: "vertical" }} value={form.contacts} onChange={(event) => setForm({ ...form, contacts: event.target.value })} placeholder="Her satıra bir kontak veya not" /></Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              {selected && <Btn variant="secondary" onClick={() => onPreviewCustomer(selected.id)}>Müşteri Gibi Gör</Btn>}
              <Btn onClick={saveCustomer}>{selected ? "Güncelle" : "Müşteri Oluştur"}</Btn>
            </div>
          </div>

          {selected && (
            <>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Projeler</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {(state.projects || []).map((project) => (
                    <label key={project.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: 10, border: "1px solid #E2E8F0", borderRadius: 11, fontSize: 12 }}>
                      <input type="checkbox" checked={project.customerId === selected.id} onChange={(event) => assignProject(project.id, event.target.checked ? selected.id : "")} />
                      <span style={{ flex: 1 }}>{project.name}</span>
                      {project.connectedSupplier && <small style={{ color: "#0F766E", fontWeight: 800 }}>Connected Supplier</small>}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#64748B" }}>{linkedProjects.length} proje müşteri portalında görünür.</div>
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
                  {!customerUsers.length && <div style={{ color: "#94A3B8", fontSize: 11 }}>Bu müşteriye bağlı kullanıcı yok.</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
