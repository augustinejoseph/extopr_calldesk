export const workspacePages = [
  { label: "Overview", href: "/overview", icon: "◎" },
  { label: "Students", href: "/students", icon: "▦" },
  {
    label: "Unassigned pool",
    href: "/unassigned",
    icon: "▤",
    managerOnly: true,
  },
  { label: "Follow-ups", href: "/follow-ups", icon: "◷" },
  { label: "Team", href: "/team", icon: "♙", managerOnly: true },
  { label: "Import students", href: "/imports", icon: "↥", managerOnly: true },
  {
    label: "Duplicate review",
    href: "/duplicates",
    icon: "▱",
    managerOnly: true,
  },
];
