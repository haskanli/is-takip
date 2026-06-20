import { useMemo, useState } from "react";
import { Btn, Field, Icon, iStyle } from "./primitives.jsx";

const customerName = (project) =>
  project?.customerProfile?.name || project?.customerName || project?.name || "Müşteri";

const customerLocation = (project) => ({
  ...(project?.location || {}),
  ...(project?.customerProfile?.location || {}),
});

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

const mapsLink = (location = {}) => {
  const query = [location.address, location.district, location.city, location.country]
    .filter(Boolean)
    .join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
};

const uniqueCustomerContacts = (project) =>
  (project?.raciContacts || [])
    .filter((contact) => contact.side === "Müşteri")
    .filter(
      (contact, index, list) =>
        !normalizeEmail(contact.email) ||
        list.findIndex((item) => normalizeEmail(item.email) === normalizeEmail(contact.email)) === index,
    );

export function CustomersPage({ state, setState, onInviteUser, onPreviewCustomer }) {
  const projects = state.projects || [];
  const [openCards, setOpenCards] = useState({});
  const [search, setSearch] = useState("");
  const listedProjects = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return projects;
    return projects.filter((project) =>
      `${customerName(project)} ${project.name || ""} ${project.customerProfile?.website || ""} ${project.location?.city || ""} ${project.customerProfile?.location?.city || ""}`
        .toLocaleLowerCase("tr-TR")
        .includes(q),
    );
  }, [projects, search]);

  const updateProjectCustomer = (projectId, data) => {
    setState((current) => ({
      ...current,
      projects: (current.projects || []).map((project) =>
        project.id === projectId
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

  const uploadLogo = (projectId, file) => {
    readImageAsDataUrl(file, (logoUrl) => updateProjectCustomer(projectId, { logoUrl }));
  };

  const accessKeys = (project) => new Set([project?.id, project?.customerId].filter(Boolean));
  const customerUsersForProject = (project) =>
    (state.people || []).filter(
      (person) => person.userType === "customer" && accessKeys(project).has(person.customerId),
    );

  const enableAccess = (project, contact) => {
    if (!project || !contact?.name || !contact?.email) return;
    const users = customerUsersForProject(project);
    const existing = users.find((person) => normalizeEmail(person.email) === normalizeEmail(contact.email));
    if (existing) return;
    onInviteUser({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      title: contact.title || "",
      company: contact.company || customerName(project),
      userType: "customer",
      roleKey: "customer_viewer",
      customerId: project.id,
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

  const ToggleHeader = ({ projectId, section, icon, title, desc }) => {
    const key = `${projectId}:${section}`;
    const open = Boolean(openCards[key]);
    return (
      <button
        type="button"
        onClick={() => setOpenCards((current) => ({ ...current, [key]: !open }))}
        style={{
          width: "100%",
          border: 0,
          background: open ? "#EEF2FF" : "#F8FAFC",
          borderRadius: 12,
          padding: "11px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ color: open ? "#4338CA" : "#64748B", display: "flex" }}><Icon name={icon} size={17} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 12, color: "#172033" }}>{title}</b>
          <small style={{ color: "#64748B", fontSize: 10 }}>{desc}</small>
        </span>
        <b style={{ color: "#64748B", fontSize: 18 }}>{open ? "−" : "+"}</b>
      </button>
    );
  };

  return (
    <div className="theme-work-page customers-theme-page" style={{ padding: "22px clamp(14px,4vw,30px)", flex: 1, overflow: "auto" }}>
      <div className="unified-page-header customers-page-header" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Müşteriler</h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "#64748B", lineHeight: 1.55 }}>
            Her proje bir müşteri alanıdır. Tüm müşteriler burada listelenir; bilgiler ve RACI kontakları kart içinden açılır.
          </p>
        </div>
        <div className="unified-filter-row customers-filter-row" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ ...iStyle, width: 240, background: "#fff" }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Müşteri, proje, şehir ara"
          />
          <span style={{ background: "#EEF2FF", color: "#4338CA", borderRadius: 999, padding: "7px 11px", fontSize: 11, fontWeight: 900 }}>
            {listedProjects.length}/{projects.length} müşteri
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        {listedProjects.map((project) => {
          const name = customerName(project);
          const logo = project.customerProfile?.logoUrl;
          const accent = project.customerProfile?.accentColor || project.color || "#4A6CF7";
          const users = customerUsersForProject(project);
          const contacts = uniqueCustomerContacts(project);
          const location = customerLocation(project);
          const mapUrl = mapsLink(location);
          const infoOpen = Boolean(openCards[`${project.id}:info`]);
          const raciOpen = Boolean(openCards[`${project.id}:raci`]);

          return (
            <section key={project.id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderTop: `4px solid ${accent}`, borderRadius: 18, padding: 15, boxShadow: "0 10px 26px rgba(15,23,42,.055)", display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 52, height: 52, borderRadius: 16, background: "#F8FAFC", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0, border: "1px solid #E2E8F0" }}>
                  {logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5 }} /> : <b style={{ color: accent, fontSize: 17 }}>{name.slice(0, 2).toLocaleUpperCase("tr-TR")}</b>}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</b>
                  <small style={{ color: "#64748B", fontSize: 11, lineHeight: 1.45 }}>
                    {project.name} · {users.length} portal kullanıcısı · {contacts.length} RACI kontağı
                  </small>
                </span>
                <Btn small variant="secondary" onClick={() => onPreviewCustomer(project.id)}>Gör</Btn>
              </div>

              <ToggleHeader projectId={project.id} section="info" icon="projects" title="Müşteri alanı bilgileri" desc="Logo, web sitesi, vurgu rengi ve lokasyon" />
              {infoOpen && (
                <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, padding: 13, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
                    <Field label="Müşteri / Firma Adı">
                      <input style={iStyle} value={name} onChange={(event) => updateProjectCustomer(project.id, { name: event.target.value })} />
                    </Field>
                    <Field label="Web Sitesi">
                      <input style={iStyle} value={project.customerProfile?.website || ""} onChange={(event) => updateProjectCustomer(project.id, { website: event.target.value })} placeholder="https://..." />
                    </Field>
                    <Field label="Vurgu Rengi">
                      <input type="color" style={{ ...iStyle, padding: 4 }} value={accent} onChange={(event) => updateProjectCustomer(project.id, { accentColor: event.target.value })} />
                    </Field>
                  </div>

                  <Field label="Logo">
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
                      <input style={iStyle} value={(project.customerProfile?.logoUrl || "").startsWith("data:") ? "" : project.customerProfile?.logoUrl || ""} onChange={(event) => updateProjectCustomer(project.id, { logoUrl: event.target.value })} placeholder="https://.../logo.png" />
                      <label style={{ border: 0, background: "#EEF2FF", color: "#4338CA", borderRadius: 9, padding: "8px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                        Yükle
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(event) => uploadLogo(project.id, event.target.files?.[0])} />
                      </label>
                    </div>
                  </Field>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                    <Field label="Adres">
                      <input style={iStyle} value={location.address || ""} onChange={(event) => updateProjectCustomer(project.id, { location: { ...location, address: event.target.value } })} placeholder="Cadde, sokak, tesis" />
                    </Field>
                    <Field label="İlçe">
                      <input style={iStyle} value={location.district || ""} onChange={(event) => updateProjectCustomer(project.id, { location: { ...location, district: event.target.value } })} />
                    </Field>
                    <Field label="İl">
                      <input style={iStyle} value={location.city || ""} onChange={(event) => updateProjectCustomer(project.id, { location: { ...location, city: event.target.value } })} />
                    </Field>
                    <Field label="Ülke">
                      <input style={iStyle} value={location.country || ""} onChange={(event) => updateProjectCustomer(project.id, { location: { ...location, country: event.target.value } })} placeholder="Türkiye" />
                    </Field>
                  </div>
                  {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noreferrer" style={{ color: "#4338CA", fontSize: 11, fontWeight: 900, textDecoration: "none" }}>
                      Haritada aç
                    </a>
                  )}
                </div>
              )}

              <ToggleHeader projectId={project.id} section="raci" icon="people" title="RACI kontakları ve portal erişimi" desc="Müşteri kontaklarını görüntüle, erişim aç/kapat" />
              {raciOpen && (
                <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, padding: 13, display: "grid", gap: 8 }}>
                  {contacts.map((contact) => {
                    const user = users.find((person) => normalizeEmail(person.email) === normalizeEmail(contact.email));
                    return (
                      <div key={contact.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 11px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, fontSize: 12 }}>
                        <span style={{ minWidth: 0 }}>
                          <b style={{ display: "block" }}>{contact.name}</b>
                          <small style={{ color: "#64748B", lineHeight: 1.45 }}>
                            {contact.title || contact.raci || "Müşteri kontağı"}
                            {contact.department ? ` · ${contact.department}` : ""}
                            {contact.email ? ` · ${contact.email}` : ""}
                            {contact.phone ? ` · ${contact.phone}` : ""}
                          </small>
                          {contact.scope && <small style={{ display: "block", color: "#94A3B8", marginTop: 3 }}>{contact.scope}</small>}
                        </span>
                        {contact.email ? (
                          user ? (
                            <Btn small variant="danger" onClick={() => disableAccess(user.id)}>Erişimi Kapat</Btn>
                          ) : (
                            <Btn small onClick={() => enableAccess(project, contact)}>Portal Erişimi Aç</Btn>
                          )
                        ) : (
                          <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 800 }}>E-posta yok</span>
                        )}
                      </div>
                    );
                  })}
                  {!contacts.length && (
                    <div style={{ color: "#94A3B8", fontSize: 11, padding: 18, border: "1px dashed #CBD5E1", borderRadius: 12 }}>
                      Bu projede müşteri tarafında RACI kontağı yok.
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#64748B", lineHeight: 1.5 }}>
                    Kontak eklemek için proje içindeki <b>Proje Bilgileri → RACI ve Kontaklar</b> alanını kullanın.
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {!listedProjects.length && (
        <div style={{ marginTop: 18, padding: 34, textAlign: "center", color: "#94A3B8", border: "1px dashed #CBD5E1", borderRadius: 16, background: "#fff" }}>
          Aramaya uygun müşteri bulunamadı.
        </div>
      )}
    </div>
  );
}
