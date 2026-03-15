import './globals.css';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          <main className="flex-grow container mx-auto px-6 py-10">
            {children}
          </main>
          <footer className="border-t py-10 bg-muted/30 text-center text-sm text-muted-foreground">
            <p className="font-bold mb-1">CBGPU Computing Service</p>
            <p>© {currentYear} CBGPU. All rights reserved.</p>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}