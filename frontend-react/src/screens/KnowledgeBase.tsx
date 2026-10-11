import React from "react";
import { BookOpen } from "lucide-react";

export function KnowledgeBasePage() {
  return (
    <div className="dash">
      <div className="dash-main" style={{ width: "100%" }}>
        <header className="dash-hello">
          <h1>Knowledge Base</h1>
          <p>Find helpful articles and how-to guides.</p>
        </header>
        <section className="card dash-panel">
          <div className="dash-panel-head">
            <h2><BookOpen size={18} style={{ marginRight: 8 }} /> Browse Articles</h2>
          </div>
          <div className="empty-state">
            Knowledge base content will be available here soon.
          </div>
        </section>
      </div>
    </div>
  );
}
