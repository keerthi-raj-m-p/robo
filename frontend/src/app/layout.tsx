import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROBOTIC ARM - Control System",
  description: "Industrial-grade real-time robotic arm control system with 6-DOF joint control, gesture recognition, program editor, I/O monitoring, and live telemetry dashboard.",
  keywords: ["robotic arm", "ESP32", "servo control", "PCA9685", "real-time", "industrial"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
