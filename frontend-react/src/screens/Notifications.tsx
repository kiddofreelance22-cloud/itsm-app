import React from "react";
import { Bell } from "lucide-react";

export function NotificationsPage() {
  return (
    <div className="dash">
      <div className="dash-main" style={{ width: "100%" }}>
        <header className="dash-hello">
          <h1>Notifications</h1>
          <p>Stay updated on your incidents and requests.</p>
        </header>
        <section className="card dash-panel">
          <div className="dash-panel-head">
            <h2><Bell size={18} style={{ marginRight: 8 }} /> Recent Notifications</h2>
          </div>
          <div className="empty-state">
            No new notifications.
          </div>
        </section>
      </div>
    </div>
  );
}
