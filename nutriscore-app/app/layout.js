import "./globals.css";

export const metadata = {
  title: "Nutriscore",
  description: "Shared nutrition and training tracker for Martin and Laura."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Applies any saved bright/night/forest choice before first paint, so the
            page never flashes the wrong theme on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=JSON.parse(localStorage.getItem("nutriscore-theme")||"null");if(t&&t.mode)document.documentElement.setAttribute("data-theme",t.mode);}catch(e){}})();'
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Public+Sans:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
