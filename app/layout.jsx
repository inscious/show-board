import "./globals.css";

export const metadata = {
  title: "L831 Tracker",
  description: "Show schedule, work calendar and OJT tracker for IUPAT Local 831 apprentices.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "L831 Tracker",
  },
};

export const viewport = {
  themeColor: "#0D0F13",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",     // lets the bottom nav clear the home-bar on an iPhone
  maximumScale: 1,          // stops iOS zooming the page when you tap an input
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
