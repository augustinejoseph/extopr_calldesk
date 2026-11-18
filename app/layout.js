import "./globals.css";
export const metadata = {
  title: "Extopr CallDesk",
  description: "Your team’s student calling workspace",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CallDesk" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#155d48",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
