import type { Metadata } from "next";
import localFont from "next/font/local";
import { Kalam, Nunito, Fredoka } from "next/font/google";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Handwriting font for the whiteboard — makes it feel like a real teacher wrote it.
const kalam = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-hand",
});

// Two-font system from the viral-app research:
// - Fredoka: bubbly, bold DISPLAY font for greetings, buttons, character names —
//   the Duolingo-energy voice that makes the app feel playful, not clinical.
// - Nunito: rounded but calm BODY font for longer UI text and content.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-round",
});

export const metadata: Metadata = {
  title: "TutorX — the tutor that teaches from your own notes",
  description:
    "Upload your notes. A senior tutor teaches them at the board, tests you with timed mocks from your past questions, marks you instantly, and re-teaches your weak points until you're exam-ready.",
  openGraph: {
    title: "TutorX — teaches you how to pass, from your own material",
    description:
      "Not a summarizer. A real AI tutor: teaches at the board, sets timed mocks, marks instantly, drills your weak points.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "TutorX", description: "The tutor that teaches from your own notes." },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so there's no flash of the
            wrong theme. "default" follows the OS; dark/light are explicit. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tutorx_theme')||'light';var d=t==='dark';document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${kalam.variable} ${nunito.variable} ${fredoka.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
