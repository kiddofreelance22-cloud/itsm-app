export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  department: string;
  phone: string;
  location: string;
  avatarColor: string;
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  date: string;
  colorDot: "blue" | "green" | "orange";
}

export interface KnowledgeArticle {
  id: string;
  title: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}
