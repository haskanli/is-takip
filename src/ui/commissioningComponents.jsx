import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { commissioningMachines } from "../domain/projectHelpers.js";
import { Btn, Field, iStyle } from "./primitives.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().slice(0, 10);
const safeFileName = (value) => String(value || "rapor").replace(/[^a-zA-Z0-9_-]/g, "_");
const downloadXlsx = (rows, fileName, sheetName = "Rapor") => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, fileName);
};

const COMMISSIONING_LEVELS = [
  { label: "Sektör", childKey: "productionCenters", childLabel: "Üretim Merkezi" },
  { label: "Üretim Merkezi", childKey: "workplaces", childLabel: "İşyeri" },
  { label: "İşyeri", childKey: "lines", childLabel: "Hat" },
  { label: "Hat", childKey: "machines", childLabel: "Makine" },
];

const commissioningRows = (sectors = []) =>
  sectors.flatMap((sector) =>
    (sector.productionCenters || []).flatMap((center) =>
      (center.workplaces || []).flatMap((workplace) =>
        (workplace.lines || []).flatMap((line) =>
          (line.machines || []).map((machine) => ({
            sector: sector.name,
            productionCenter: center.name,
            workplace: workplace.name,
            line: line.name,
            machine,
          }))
        )
      )
    )
  );

const commissioningTreeFromRows = (rows = []) => {
  const sectors = [];
  const getOrCreate = (list, name, childKey) => {
    let item = list.find((entry) => entry.name === name);
    if (!item) {
      item = { id: uid(), name, [childKey]: [] };
      list.push(item);
    }
    return item;
  };

  rows.forEach((row) => {
    if (!row.sector || !row.productionCenter || !row.workplace || !row.line || !row.machine?.name) return;
    const sector = getOrCreate(sectors, row.sector, "productionCenters");
    const center = getOrCreate(sector.productionCenters, row.productionCenter, "workplaces");
    const workplace = getOrCreate(center.workplaces, row.workplace, "lines");
    const line = getOrCreate(workplace.lines, row.line, "machines");
    line.machines.push({
      id: uid(),
      code: "",
      type: "physical",
      commissioned: false,
      commissionedAt: "",
      note: "",
      ...row.machine,
    });
  });

  return sectors;
};

const updateCommissioningNodes = (nodes, id, updater, level = 0) =>
  (nodes || []).map((node) => {
    if (node.id === id) return updater(node);
    const childKey = COMMISSIONING_LEVELS[level]?.childKey;
    return childKey && node[childKey]
      ? { ...node, [childKey]: updateCommissioningNodes(node[childKey], id, updater, level + 1) }
      : node;
  });

const removeCommissioningNode = (nodes, id, level = 0) =>
  (nodes || [])
    .filter((node) => node.id !== id)
    .map((node) => {
      const childKey = COMMISSIONING_LEVELS[level]?.childKey;
      return childKey && node[childKey]
        ? { ...node, [childKey]: removeCommissioningNode(node[childKey], id, level + 1) }
        : node;
    });

export function CommissioningPanel({ project, canEdit, onChange }) {
  const sectors = project.commissioningTree || [];
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState("");
  const [form, setForm] = useState({
    sector: "",
    productionCenter: "",
    workplace: "",
    line: "",
    name: "",
    code: "",
    type: "physical",
    commissioned: false,
    note: "",
  });
  const fileRef = useRef(null);
  const machines = commissioningMachines(sectors);
  const rows = commissioningRows(sectors);
  const commissioned = machines.filter((machine) => machine.commissioned).length;
  const physical = machines.filter((machine) => machine.type !== "virtual").length;
  const virtual = machines.filter((machine) => machine.type === "virtual").length;
  const percent = machines.length ? Math.round((commissioned / machines.length) * 100) : 0;
  const visibleRows = rows.filter((row) => filter === "all" || (filter === "done" ? row.machine.commissioned : !row.machine.commissioned));

  const update = (id, updater) => onChange(updateCommissioningNodes(sectors, id, updater));
  const remove = (id) => onChange(removeCommissioningNode(sectors, id));

  const resetForm = () => {
    setEditingMachineId("");
    setForm({ sector: "", productionCenter: "", workplace: "", line: "", name: "", code: "", type: "physical", commissioned: false, note: "" });
  };

  const addMachine = () => {
    if (!form.sector.trim() || !form.productionCenter.trim() || !form.workplace.trim() || !form.line.trim() || !form.name.trim()) return;
    const machine = {
      id: editingMachineId || uid(),
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      commissioned: form.commissioned,
      commissionedAt: form.commissioned ? rows.find((row) => row.machine.id === editingMachineId)?.machine.commissionedAt || todayStr() : "",
      note: form.note.trim(),
    };
    const nextRows = [
      ...rows.filter((row) => row.machine.id !== editingMachineId),
      { sector: form.sector.trim(), productionCenter: form.productionCenter.trim(), workplace: form.workplace.trim(), line: form.line.trim(), machine },
    ];
    onChange(commissioningTreeFromRows(nextRows));
    resetForm();
    setShowForm(false);
  };

  const editMachine = (row) => {
    setEditingMachineId(row.machine.id);
    setForm({
      sector: row.sector,
      productionCenter: row.productionCenter,
      workplace: row.workplace,
      line: row.line,
      name: row.machine.name || "",
      code: row.machine.code || "",
      type: row.machine.type || "physical",
      commissioned: Boolean(row.machine.commissioned),
      note: row.machine.note || "",
    });
    setShowForm(true);
  };

  const exportExcel = () => {
    const data = [["Sektör", "Üretim Merkezi", "İşyeri", "Hat", "Makine Kodu", "Makine Adı", "Tip", "Devreye Alındı", "Devreye Alma Tarihi", "Açıklama"]];
    rows.forEach((row) =>
      data.push([
        row.sector,
        row.productionCenter,
        row.workplace,
        row.line,
        row.machine.code || "",
        row.machine.name,
        row.machine.type === "virtual" ? "Sanal" : "Fiziksel",
        row.machine.commissioned ? "Evet" : "Hayır",
        row.machine.commissionedAt || "",
        row.machine.note || "",
      ])
    );
    downloadXlsx(data, `${safeFileName(project.name)}-devreye-alma.xlsx`, "Devreye Alma");
  };

  const importExcel = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        const imported = data
          .map((item) => ({
            sector: String(item["Sektör"] || item.Sektor || "").trim(),
            productionCenter: String(item["Üretim Merkezi"] || item["Uretim Merkezi"] || "").trim(),
            workplace: String(item["İşyeri"] || item.Isyeri || "").trim(),
            line: String(item.Hat || "").trim(),
            machine: {
              name: String(item["Makine Adı"] || item["Makine Adi"] || "").trim(),
              code: String(item["Makine Kodu"] || "").trim(),
              type: String(item.Tip || "").toLocaleLowerCase("tr-TR") === "sanal" ? "virtual" : "physical",
              commissioned: ["evet", "true", "1"].includes(String(item["Devreye Alındı"] || item["Devreye Alindi"] || "").toLocaleLowerCase("tr-TR")),
              commissionedAt: String(item["Devreye Alma Tarihi"] || ""),
              note: String(item["Açıklama"] || item.Aciklama || ""),
            },
          }))
          .filter((row) => row.machine.name);
        onChange(commissioningTreeFromRows([...rows, ...imported]));
      } catch (error) {
        alert(`Excel okunamadı: ${error.message}`);
      }
      event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="commissioning-panel">
      <div className="commissioning-header unified-page-header">
        <div>
          <h3>Toplu Devreye Alma Takibi</h3>
          <p>Tüm hiyerarşi tek listede; filtreleyin, işaretleyin veya Excel ile yönetin.</p>
        </div>
        <div className="page-header-actions">
          <Btn small variant="secondary" onClick={exportExcel}>Excel Dışa Aktar</Btn>
          {canEdit && (
            <>
              <Btn small variant="secondary" onClick={() => fileRef.current?.click()}>Excel İçe Aktar</Btn>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importExcel} />
              <Btn
                small
                onClick={() => {
                  resetForm();
                  setShowForm((value) => !value);
                }}
              >
                {showForm ? "Formu Kapat" : "+ Kayıt Ekle"}
              </Btn>
            </>
          )}
        </div>
      </div>

      <div className="commissioning-stats">
        {[
          ["İlerleme", `${percent}%`, "accent"],
          ["Devrede", `${commissioned}/${machines.length}`, "success"],
          ["Fiziksel", physical, "accent"],
          ["Sanal", virtual, "accent"],
          ["Bekleyen", machines.length - commissioned, "warning"],
        ].map(([label, value, tone]) => (
          <div key={label} className={`ui-section-card commissioning-stat is-${tone}`}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>

      <div className="commissioning-progress">
        <div style={{ width: `${percent}%` }} />
      </div>

      <div className="theme-filter-strip commissioning-filter">
        {[
          ["all", "Tümü"],
          ["pending", "Devreye Alınacak"],
          ["done", "Devreye Alınan"],
        ].map(([id, label]) => (
          <button key={id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {showForm && (
        <div className="ui-section-card commissioning-form">
          <div className="task-section-title">{editingMachineId ? "Makine Kaydını Düzenle" : "Yeni Makine Kaydı"}</div>
          <div className="commissioning-form-grid">
            {[
              ["sector", "Sektör"],
              ["productionCenter", "Üretim Merkezi"],
              ["workplace", "İşyeri"],
              ["line", "Hat"],
              ["name", "Makine Adı"],
              ["code", "Makine Kodu"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input style={iStyle} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
              </Field>
            ))}
            <Field label="Tip">
              <select style={iStyle} value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                <option value="physical">Fiziksel</option>
                <option value="virtual">Sanal</option>
              </select>
            </Field>
          </div>
          <Field label="Açıklama">
            <input style={iStyle} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </Field>
          <div className="commissioning-form-actions">
            <label>
              <input type="checkbox" checked={form.commissioned} onChange={(event) => setForm((current) => ({ ...current, commissioned: event.target.checked }))} /> Devreye alındı
            </label>
            <Btn onClick={addMachine}>{editingMachineId ? "Değişiklikleri Kaydet" : "Kaydet"}</Btn>
          </div>
        </div>
      )}

      <div className="ui-section-card commissioning-table-shell">
        <table>
          <thead>
            <tr>{["Durum", "Sektör", "Üretim Merkezi", "İşyeri", "Hat", "Makine", "Tip", "Açıklama", ""].map((label) => <th key={label}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.machine.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(row.machine.commissioned)}
                    disabled={!canEdit}
                    onChange={(event) => update(row.machine.id, (current) => ({ ...current, commissioned: event.target.checked, commissionedAt: event.target.checked ? todayStr() : "" }))}
                  />
                </td>
                {[row.sector, row.productionCenter, row.workplace, row.line].map((value, index) => <td key={index}>{value}</td>)}
                <td>
                  <div className="commissioning-machine-name">{row.machine.name}</div>
                  <span>{row.machine.code || "Kod yok"}</span>
                </td>
                <td><span className={row.machine.type === "virtual" ? "ui-chip ui-chip-warning" : "ui-chip ui-chip-accent"}>{row.machine.type === "virtual" ? "Sanal" : "Fiziksel"}</span></td>
                <td>
                  {canEdit ? (
                    <input style={{ ...iStyle, padding: "6px 8px", fontSize: 10 }} value={row.machine.note || ""} onChange={(event) => update(row.machine.id, (current) => ({ ...current, note: event.target.value }))} />
                  ) : (
                    <span>{row.machine.note || "-"}</span>
                  )}
                </td>
                <td>
                  {canEdit && (
                    <div className="commissioning-row-actions">
                      <button onClick={() => editMachine(row)}>Düzenle</button>
                      <button className="is-danger" onClick={() => confirm("Makine silinsin mi?") && remove(row.machine.id)}>Sil</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!visibleRows.length && <div className="ui-muted-note commissioning-empty">Bu filtrede kayıt bulunmuyor.</div>}
    </div>
  );
}
