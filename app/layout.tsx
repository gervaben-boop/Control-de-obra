import "./globals.css";

export const metadata = {
  title: "Control de Obra",
  description: "Gestión de pendientes de obra"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
