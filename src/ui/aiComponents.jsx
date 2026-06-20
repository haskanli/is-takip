import { useState } from "react";
import { apiHeaders, apiUrl } from "../api";
import { Btn, Field, Icon, iStyle } from "./primitives.jsx";

export function AIWorkspace({ projects = [], initialProjectId = "", embedded = false }) {
  const [scope, setScope] = useState(initialProjectId ? "project" : "portfolio");
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || "");
  const [question, setQuestion] = useState("En kritik riskleri, gecikmeleri ve öncelikli aksiyonları yorumla.");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async () => {
    if (!question.trim() || (scope === "project" && !projectId)) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/ai/project-insight"), {
        method: "POST",
        headers: await apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          scope,
          projectId: scope === "project" ? projectId : undefined,
          question: question.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "AI yanıtı alınamadı.");
      setAnswer(body.answer);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`theme-work-page ai-theme-page ${embedded ? "is-embedded" : ""}`} style={{ padding: embedded ? 0 : "clamp(18px,4vw,30px)", flex: 1, overflow: "auto", background: embedded ? "transparent" : "var(--page-bg, transparent)" }}>
      <div className="ai-page-inner" style={{ maxWidth: 980, margin: embedded ? 0 : "0 auto" }}>
        {!embedded && (
          <div className="unified-page-header ai-page-header" style={{ marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="activity" size={21} />
                AI Assistant
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Proje ve portföy verilerinden risk, gecikme ve öncelikli aksiyon yorumu üretir.
              </p>
            </div>
          </div>
        )}

        <div className="unified-filter-row ai-filter-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, marginBottom: 14 }}>
          <Field label="Analiz Kapsamı">
            <select style={iStyle} value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="portfolio">Tüm erişilebilir projeler</option>
              <option value="project">Tek proje</option>
            </select>
          </Field>
          <Field label="Proje">
            <select disabled={scope !== "project"} style={{ ...iStyle, opacity: scope === "project" ? 1 : 0.55 }} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Proje seçin</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="soft-panel ai-main-card" style={{ borderRadius: 18, padding: "clamp(14px,3vw,20px)" }}>
          <div className="ui-muted-note" style={{ background: "var(--surface-soft)", borderRadius: 12, padding: "10px 12px", fontSize: 11, color: "var(--muted)", marginBottom: 13 }}>
            Uzaktan erişim parolaları ve doküman içerikleri AI analizine gönderilmez. Sonuçlar karar desteğidir; kaynak kayıtlarla doğrulanmalıdır.
          </div>
          <Field label="Sorunuz">
            <textarea
              style={{ ...iStyle, minHeight: 120, resize: "vertical", lineHeight: 1.55 }}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") ask();
              }}
            />
          </Field>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>Ctrl + Enter ile analiz edebilirsiniz.</span>
            <Btn disabled={loading || !question.trim() || (scope === "project" && !projectId)} onClick={ask}>
              {loading ? "Analiz ediliyor..." : "Yorumla"}
            </Btn>
          </div>
          {error && <div className="ui-chip ui-chip-danger ai-message" style={{ marginTop: 12, width: "100%", justifyContent: "flex-start" }}>{error}</div>}
          {answer && <div className="ai-answer-card" style={{ marginTop: 14, padding: 16, borderRadius: 14, background: "var(--surface-soft)", border: "1px solid var(--border)", whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.75 }}>{answer}</div>}
        </div>
      </div>
    </div>
  );
}
