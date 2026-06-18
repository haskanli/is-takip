import { useState } from "react";
import { Btn, iStyle } from "./primitives.jsx";

export function PeopleMultiSelect({ people, value, onChange }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        gap: 6,
        padding: 9,
        border: "1.5px solid #E2E8F0",
        borderRadius: 9,
        background: "#FAFBFC",
      }}
    >
      {people.map((person) => (
        <label
          key={person.id}
          style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={value.includes(person.id)}
            onChange={(event) =>
              onChange(event.target.checked ? [...value, person.id] : value.filter((id) => id !== person.id))
            }
          />
          {person.name}
        </label>
      ))}
    </div>
  );
}

export function MultiChoiceFilter({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          ...iStyle,
          width: "auto",
          minWidth: 170,
          background: value.length ? "#EEF2FF" : "#fff",
          color: value.length ? "#4338CA" : "#475569",
          cursor: "pointer",
          fontWeight: 750,
          textAlign: "left",
        }}
      >
        {label}
        {value.length ? ` (${value.length})` : ""}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            zIndex: 30,
            minWidth: 230,
            maxHeight: 280,
            overflow: "auto",
            background: "#fff",
            border: "1px solid #CBD5E1",
            borderRadius: 11,
            padding: 8,
            boxShadow: "0 16px 35px rgba(15,23,42,.16)",
          }}
        >
          {options.map((option) => (
            <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", fontSize: 11, cursor: "pointer", borderRadius: 7 }}>
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={(event) =>
                  onChange(event.target.checked ? [...value, option.value] : value.filter((item) => item !== option.value))
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{
                width: "100%",
                border: 0,
                borderTop: "1px solid #E2E8F0",
                background: "transparent",
                color: "#E11D48",
                padding: "8px 4px 2px",
                fontSize: 10,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Secimi temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function StakeholderEditor({ people, roles = [], value, onChange, createId }) {
  const add = () => onChange([...value, { id: createId(), userId: "", role: roles[0]?.label || "Urun Yoneticisi" }]);
  const update = (id, data) => onChange(value.map((item) => (item.id === id ? { ...item, ...data } : item)));

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {value.map((item) => (
          <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 7 }}>
            <select style={iStyle} value={item.userId} onChange={(event) => update(item.id, { userId: event.target.value })}>
              <option value="">Kisi secin</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <select style={iStyle} value={item.role} onChange={(event) => update(item.id, { role: event.target.value })}>
              {item.role && !roles.some((role) => role.label === item.role) && <option>{item.role}</option>}
              {roles.map((role) => (
                <option key={role.id} value={role.label}>
                  {role.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}
              style={{ border: 0, borderRadius: 8, background: "#FFF1F2", color: "#E11D48", padding: "0 10px", cursor: "pointer" }}
            >
              x
            </button>
          </div>
        ))}
      </div>
      <Btn small variant="secondary" style={{ marginTop: 7 }} onClick={add}>
        + Proje Rolu Ata
      </Btn>
    </div>
  );
}

export function CustomerContactEditor({ value = [], onChange, createId }) {
  const add = () => onChange([...value, { id: createId(), name: "", title: "", email: "", phone: "" }]);
  const update = (id, data) => onChange(value.map((item) => (item.id === id ? { ...item, ...data } : item)));

  return (
    <div>
      <div style={{ display: "grid", gap: 7 }}>
        {value.map((item) => (
          <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1.2fr 1fr auto", gap: 7 }}>
            {[
              ["name", "Ad Soyad"],
              ["title", "Unvan"],
              ["email", "E-posta"],
              ["phone", "Telefon"],
            ].map(([key, placeholder]) => (
              <input
                key={key}
                type={key === "email" ? "email" : "text"}
                style={iStyle}
                value={item[key] || ""}
                onChange={(event) => update(item.id, { [key]: event.target.value })}
                placeholder={placeholder}
              />
            ))}
            <button
              type="button"
              onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}
              style={{ border: 0, borderRadius: 8, background: "#FFF1F2", color: "#E11D48", padding: "0 10px", cursor: "pointer" }}
            >
              x
            </button>
          </div>
        ))}
      </div>
      <Btn small variant="secondary" style={{ marginTop: 7 }} onClick={add}>
        + Musteri Kontagi
      </Btn>
    </div>
  );
}
